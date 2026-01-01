import { expect, test } from '@playwright/test';
import { mockUiPage, fail, ok } from './support/mockUi.js';

test('manual sync preserves two real local units across HTTP retry and keeps legacy data untouched', async ({ browser }) => {
  const requests: Array<{ idempotencyKey: string; submissions: Record<string, { answer: unknown; hintUsed?: boolean }> }> = [];
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/learning/offline/sync': (route) => {
      const input = route.request().postDataJSON(); requests.push(input);
      if (requests.length === 1) return fail(route, 'OFFLINE_SYNC_RETRY');
      return ok(route, { attemptIds: Object.keys(input.submissions).map((id) => `confirmed:${id}`),
        wrongQuestionIds: [], rewardPointsGranted: 0, isOfflineUnverified: true });
    },
  });
  try {
    await page.goto('/');
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    const legacy = await page.evaluate(async () => {
      const controllerPath = '/src/offline/offlinePracticeController.ts';
      const bridgePath = '/src/platform/hostBridge.ts';
      const { OfflineDirectLearningSession } = await import(controllerPath);
      const { offlineDb } = await import(bridgePath);
      for (const answer of ['A', 'B']) {
        const local = await OfflineDirectLearningSession.create({ subject: 'english', mode: 'standard' });
        let view = local.toView();
        for (let guard = 0; !view.completed && guard < 8; guard++) {
          for (const q of view.currentStep.questions) await local.submit(q.questionId,
            { status: 'submitted', answer, hintUsed: answer === 'A' });
          view = local.toView();
          if (!view.completed) view = await local.advance();
        }
        if (!view.completed) throw new Error('local study did not complete');
      }
      const record = { questionId: 'legacy-unknown', familyId: 'legacy-family', subject: 'english',
        knowledgeNode: 'legacy-node', isCorrect: false, isSkipped: false,
        createdAtIso: '2026-01-01T00:00:00Z', synced: false };
      const id = await offlineDb.offlineAttempts.add(record);
      return { ...record, id };
    });
    await page.getByTestId('bottom-dock-nav').getByText('学习', { exact: true }).click();
    await expect(page.getByTestId('offline-sync-banner')).toContainText('7 条');
    await page.getByTestId('sync-offline-attempts-btn').click();
    await expect(page.getByText(/OFFLINE_SYNC_RETRY/)).toBeVisible();
    await expect(page.getByTestId('sync-offline-attempts-btn')).toBeEnabled();
    await page.getByTestId('sync-offline-attempts-btn').click();
    await expect(page.getByText('已同步 6 条；1 条旧记录缺原始答案，已保留', { exact: true })).toBeVisible();
    await expect(page.getByTestId('offline-sync-banner')).toContainText('1 条');
    expect(requests).toHaveLength(3);
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[1]!.idempotencyKey).not.toBe(requests[2]!.idempotencyKey);
    expect(Object.keys(requests[1]!.submissions)).toEqual(Object.keys(requests[2]!.submissions));
    expect(Object.values(requests[1]!.submissions).every((sub) => sub.answer === 'A' && sub.hintUsed === true)).toBe(true);
    expect(Object.values(requests[2]!.submissions).every((sub) => sub.answer === 'B' && sub.hintUsed === false)).toBe(true);
    const stored = await page.evaluate(async (id) => {
      const path = '/src/platform/hostBridge.ts';
      const { offlineDb } = await import(path);
      return { legacy: await offlineDb.offlineAttempts.get(id), rows: await offlineDb.offlineAttempts.toArray() };
    }, legacy.id);
    expect(stored.legacy).toEqual(legacy);
    expect(stored.rows.filter((row: { synced: boolean }) => row.synced)).toHaveLength(6);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
