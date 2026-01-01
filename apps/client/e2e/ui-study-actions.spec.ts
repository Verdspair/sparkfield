import { expect, test, type Page } from '@playwright/test';
import { deferred, english, fail, me, mockUiPage, ok, profile } from './support/mockUi.js';

const check = english.items.find((item) => item.stepRole === 'resource_check')!;
const practice = english.items.find((item) => item.stepRole === 'practice')!;
const kinds = ['material', 'practice', 'resource_check', 'remediation', 'verification'];
function session(kind = 'resource_check', locked = false) {
  const item = kind === 'practice' ? practice : check;
  return {
    sessionId: 'study-session', mode: 'standard', nodeIndex: 0, plannedSeconds: 300,
    pausedClockAllowed: true, expiresAtIso: '2099-01-01T00:00:00Z', stepIndex: kinds.indexOf(kind),
    steps: kinds.map((step) => ({ kind: step, plannedSeconds: 60, active: true, questionCount: 1 })),
    currentStep: { kind, materials: [], questions: [item],
      corrections: kind === 'remediation' ? [{ questionId: check.questionId, explanationMd: check.explanationMd }] : [],
      lockedQuestionIds: locked ? [item.questionId] : [] }, completed: false, result: null,
  };
}
const feedback = (kind = 'resource_check') => ({
  questionId: kind === 'practice' ? practice.questionId : check.questionId,
  isCorrect: true, isSkipped: false, quality: { numerator: '1', denominator: '1' },
  explanationMd: '已核验解析', stepResults: [],
});
async function openStudy(page: Page) {
  await page.goto('/');
  await page.getByTestId('bottom-dock-nav').getByText('学习', { exact: true }).click();
  await page.getByTestId('direct-standalone-study-btn').click();
  await expect(page.getByTestId('standalone-learning-overlay')).toBeVisible();
}

test('failed advance preserves feedback and offers retry without reopening locked answer', async ({ browser }) => {
  let advances = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/learning/standalone/start': (route) => ok(route, session()),
    'POST /api/learning/standalone/submit': (route) => {
      const body = route.request().postDataJSON();
      if (body.action === 'advance') {
        advances += 1;
        return advances === 1 ? fail(route) : ok(route, { ...session('verification'), currentStep: { ...session('verification').currentStep, questions: [] } });
      }
      return ok(route, { feedback: feedback(), session: session('resource_check', true) });
    },
  });
  await openStudy(page);
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await expect(page.getByTestId('question-feedback-box')).toBeVisible();
  await page.getByTestId('advance-step-btn').click();
  await expect(page.getByText(/AUDIT_FAILURE/)).toBeVisible();
  await expect(page.getByTestId('question-feedback-box')).toBeVisible();
  await expect(page.getByTestId('advance-step-btn')).toBeEnabled();
  await expect(page.getByTestId('submit-answer-btn')).toHaveCount(0);
  await page.getByTestId('advance-step-btn').click();
  await expect(page.getByTestId('question-step-card')).toHaveAttribute('data-step-kind', 'verification');
  expect(advances).toBe(2);
  expect(errors).toEqual([]);
  await context.close();
});

test('pending submission is single flight and closing discards its late response', async ({ browser }) => {
  const release = deferred();
  const started = deferred();
  let submits = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/learning/standalone/start': (route) => ok(route, session('practice')),
    'POST /api/learning/standalone/submit': async (route) => {
      submits += 1; started.resolve(); await release.promise;
      return ok(route, { feedback: feedback('practice'), session: session('practice', true) });
    },
  });
  await openStudy(page);
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await started.promise;
  const disabled = await page.getByTestId('submit-answer-btn').isDisabled();
  await page.getByTestId('close-standalone-learning-btn').click();
  const response = page.waitForResponse((res) => res.url().includes('/api/learning/standalone/submit'));
  release.resolve();
  await response;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByTestId('learning-home-page')).toBeVisible();
  await expect(page.getByTestId('standalone-learning-overlay')).toHaveCount(0);
  expect(disabled).toBe(true);
  expect(submits).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('remediation displays corrections, not a locked resource question to resubmit', async ({ browser }) => {
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/learning/standalone/start': (route) => ok(route, session('remediation', true)),
    'POST /api/learning/standalone/submit': (route) => ok(route, { ...session('verification'), currentStep: { ...session('verification').currentStep, questions: [] } }),
  });
  await openStudy(page);
  await expect(page.getByTestId('question-step-card')).toContainText(check.explanationMd);
  await expect(page.getByTestId('submit-answer-btn')).toHaveCount(0);
  await expect(page.getByTestId('advance-step-btn')).toBeVisible();
  await page.getByTestId('advance-step-btn').click();
  await expect(page.getByTestId('question-step-card')).toHaveAttribute('data-step-kind', 'verification');
  expect(errors).toEqual([]);
  await context.close();
});

test('editing or exporting authoring sources invalidates the previous compiled draft', async ({ browser }) => {
  const admin = { ...me, profile: { ...profile, role: 'admin' } };
  const compiled = { ok: true, draftId: 'old-draft', pack: english, manifest: english.manifest, diagnostics: [] };
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/me': (route) => ok(route, admin),
    'GET /api/admin/packs': (route) => ok(route, [{ manifest: english.manifest, isActive: true }]),
    'GET /api/admin/analytics/anonymous-error-rates': (route) => ok(route, []),
    'GET /api/admin/users': (route) => ok(route, []),
    'POST /api/admin/packs/compile-preview': (route) => ok(route, compiled),
    [`GET /api/admin/packs/${english.manifest.packId}/${english.manifest.coursePackVersion}/export`]: (route) => ok(route, {
      meta: { ...english.manifest, knowledgeGraph: english.manifest.knowledgeGraph }, csvText: 'exported source', mdText: '',
    }),
  });
  await page.goto('/');
  await page.getByTestId('bottom-dock-nav').getByText('我的', { exact: true }).click();
  await page.getByTestId('open-admin-workbench-btn').click();
  await page.getByTestId('pack-step-2').click();
  await page.getByTestId('compile-pack-btn').click();
  await page.getByTestId('pack-step-5').click();
  await expect(page.getByTestId('publish-pack-draft-btn')).toBeEnabled();
  await page.getByTestId('pack-step-2').click();
  await page.getByTestId('pack-csv-editor').fill('changed source');
  await page.getByTestId('pack-step-5').click();
  await expect(page.getByTestId('publish-pack-draft-btn')).toBeDisabled();
  await page.getByTestId('pack-step-2').click();
  await page.getByTestId('compile-pack-btn').click();
  await page.getByTestId('pack-step-5').click();
  await expect(page.getByTestId('publish-pack-draft-btn')).toBeEnabled();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByTestId('pack-csv-editor')).toHaveValue('exported source');
  await page.getByTestId('pack-step-5').click();
  await expect(page.getByTestId('publish-pack-draft-btn')).toBeDisabled();
  expect(errors).toEqual([]);
  await context.close();
});

test('a compile response cannot restore a draft after the source was changed', async ({ browser }) => {
  const release = deferred();
  const started = deferred();
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/me': (route) => ok(route, { ...me, profile: { ...profile, role: 'admin' } }),
    'GET /api/admin/packs': (route) => ok(route, []),
    'GET /api/admin/analytics/anonymous-error-rates': (route) => ok(route, []),
    'GET /api/admin/users': (route) => ok(route, []),
    'POST /api/admin/packs/compile-preview': async (route) => {
      started.resolve(); await release.promise;
      return ok(route, { ok: true, draftId: 'old-draft', pack: english, manifest: english.manifest, diagnostics: [] });
    },
  });
  await page.goto('/');
  await page.getByTestId('bottom-dock-nav').getByText('我的', { exact: true }).click();
  await page.getByTestId('open-admin-workbench-btn').click();
  await page.getByTestId('pack-step-2').click();
  await page.getByTestId('compile-pack-btn').click();
  await started.promise;
  await page.getByTestId('pack-csv-editor').fill('changed while compiling');
  release.resolve();
  await page.waitForLoadState('networkidle');
  await page.getByTestId('pack-step-5').click();
  await expect(page.getByTestId('publish-pack-draft-btn')).toBeDisabled();
  expect(errors).toEqual([]);
  await context.close();
});

test('saving a cohort and then restoring its original value sends both updates', async ({ browser }) => {
  const groups: Array<string | null> = [];
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/me': (route) => ok(route, { ...me, profile: { ...profile, role: 'admin' } }),
    'GET /api/admin/packs': (route) => ok(route, []),
    'GET /api/admin/analytics/anonymous-error-rates': (route) => ok(route, []),
    'GET /api/admin/users': (route) => ok(route, [{ id: 'student-1', username: 'student', nickname: '同学', role: 'player', cohort_group: 'A' }]),
    'PATCH /api/admin/users/student-1/cohort-group': (route) => {
      groups.push(route.request().postDataJSON().cohortGroup);
      return ok(route, { ok: true });
    },
  });
  await page.goto('/');
  await page.getByTestId('bottom-dock-nav').getByText('我的', { exact: true }).click();
  await page.getByTestId('open-admin-workbench-btn').click();
  await page.getByTestId('wb-tab-users').click();
  const field = page.getByPlaceholder('分组标识', { exact: true });
  await field.fill('B');
  await field.blur();
  await expect.poll(() => groups).toEqual(['B']);
  await expect(page.getByText('已更新 同学 的分组', { exact: true })).toBeVisible();
  await field.fill('A');
  await field.blur();
  await expect.poll(() => groups).toEqual(['B', 'A']);
  expect(errors).toEqual([]);
  await context.close();
});

test('all six question types keep their typed submissions and practice hint state', async ({ browser }) => {
  const base = { ...practice, stepRole: 'practice', hintMd: '先审题再作答', stepsRubric: [] };
  const questions = [
    { ...base, questionId: 'single', questionType: 'single_choice' },
    { ...base, questionId: 'multi', questionType: 'multi_choice' },
    { ...base, questionId: 'pairs', questionType: 'matching', matchingLeft: ['左甲', '左乙'], matchingRight: ['右甲', '右乙'] },
    { ...base, questionId: 'fill', questionType: 'short_fill' },
    { ...base, questionId: 'number', questionType: 'numeric' },
    { ...base, questionId: 'steps', questionType: 'multi_step_numeric', stepsRubric: [
      { stepId: 'first', prompt: '第一步', weightShare: 0.5 }, { stepId: 'second', prompt: '第二步', weightShare: 0.5 },
    ] },
  ];
  const state = { ...session('practice'), currentStep: { ...session('practice').currentStep, questions } };
  const submissions: Array<{ questionId: string; submission: { answer: unknown; hintUsed: boolean } }> = [];
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/learning/standalone/start': (route) => ok(route, state),
    'POST /api/learning/standalone/submit': (route) => {
      const body = route.request().postDataJSON(); submissions.push(body);
      return ok(route, { feedback: { ...feedback('practice'), questionId: body.questionId }, session: state });
    },
  });
  await openStudy(page);
  await page.getByTestId('toggle-hint-btn').click();
  await expect(page.getByTestId('practice-hint-content')).toBeVisible();
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await page.getByTestId('advance-step-btn').click();
  await page.getByTestId('option-A').click();
  await page.getByTestId('option-B').click();
  await page.getByTestId('submit-answer-btn').click();
  await page.getByTestId('advance-step-btn').click();
  await page.getByTestId('match-left-0').click();
  await page.getByRole('button', { name: '右甲', exact: true }).click();
  await page.getByTestId('match-left-1').click();
  await page.getByRole('button', { name: '右乙', exact: true }).click();
  await page.getByTestId('submit-answer-btn').click();
  await page.getByTestId('advance-step-btn').click();
  await page.getByTestId('short-fill-input').fill('can learn');
  await page.getByTestId('submit-answer-btn').click();
  await page.getByTestId('advance-step-btn').click();
  await page.getByTestId('numeric-input').fill('4.5 kg');
  await page.getByTestId('submit-answer-btn').click();
  await page.getByTestId('advance-step-btn').click();
  await page.getByTestId('multistep-input-first').fill('2');
  await page.getByTestId('multistep-input-second').fill('3');
  await page.getByTestId('submit-answer-btn').click();
  await expect(page.getByTestId('question-feedback-box')).toBeVisible();
  expect(submissions.map((body) => body.questionId)).toEqual(['single', 'multi', 'pairs', 'fill', 'number', 'steps']);
  expect(submissions.map((body) => body.submission.answer)).toEqual([
    'A', ['A', 'B'], { 左甲: '右甲', 左乙: '右乙' }, 'can learn', '4.5 kg', { first: '2', second: '3' },
  ]);
  expect(submissions.map((body) => body.submission.hintUsed)).toEqual([true, false, false, false, false, false]);
  expect(errors).toEqual([]);
  await context.close();
});
