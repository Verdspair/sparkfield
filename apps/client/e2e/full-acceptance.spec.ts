import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.describe('Beyond the Light Cone Full-Stack E2E Acceptance', () => {
  test('1. Real PG auth, 3-choice onboarding + 90s micro-scenario, cross-tab prep room, encyclopedia, standalone learning -> PG gift redemption & sessionEpoch takeover', async ({
    browser,
  }) => {
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageA = await contextA.newPage();
    const pageErrors: string[] = [];
    pageA.on('pageerror', (err) => pageErrors.push(err.message));

    await pageA.goto('/');
    await expect(pageA.getByTestId('auth-page')).toBeVisible();

    const bootPerf = await pageA.evaluate(() =>
      (window as unknown as { __getStagePerfStats?: () => { webglAvailable: boolean; drawCalls: number; triangles: number } }).__getStagePerfStats?.(),
    );
    expect(bootPerf?.webglAvailable).toBe(true);
    expect(bootPerf!.drawCalls).toBeLessThanOrEqual(120);
    expect(bootPerf!.triangles).toBeLessThanOrEqual(180_000);

    const uname = `e2e_pilot_${Date.now().toString().slice(-6)}`;
    const stuCred = `c_${randomUUID().slice(0, 12)}`;
    await pageA.getByTestId('splash-enter-btn').click();
    await expect(pageA.locator('form')).toHaveCount(0);
    await pageA.getByTestId('auth-tab-register').click();
    await pageA.getByTestId('auth-username-input').fill(uname);
    await pageA.getByTestId('auth-nickname-input').fill('测试领航员');
    await pageA.getByTestId('auth-password-input').fill(stuCred);
    await pageA.getByTestId('auth-submit-btn').click();

    await expect(pageA.getByTestId('onboarding-three-choices')).toBeVisible();
    await pageA.getByTestId('onboarding-opt-micro').click();
    await expect(pageA.getByTestId('onboarding-micro-scenario')).toBeVisible();
    await pageA.getByTestId('skip-micro-scenario-btn').click();

    await expect(pageA.getByTestId('learning-start-selector')).toBeVisible();
    await pageA.getByTestId('save-learning-start-btn').click();
    await expect(pageA.getByTestId('lobby-page')).toBeVisible();

    await expect(pageA.getByTestId('lobby-page')).toContainText('未定级');

    await pageA.getByTestId('arena-theme-event_horizon_observatory').click();

    await pageA.locator('[data-testid="lobby-page"] button').filter({ hasText: /进入备战房/ }).nth(1).click();
    await expect(pageA.getByTestId('prep-room-page')).toBeVisible();
    await expect(pageA.getByTestId('estimated-end-time-box')).toContainText(/预计\s*\d{2}:\d{2}\s*结束/);
    const roomCodeText = await pageA.getByTestId('prep-room-code-box').innerText();
    expect(roomCodeText.length).toBeGreaterThan(3);

    await pageA.getByTestId('bottom-dock-nav').getByText('图鉴').click();
    await expect(pageA.getByTestId('encyclopedia-page')).toBeVisible();
    await expect(pageA.getByTestId('top-room-bar')).toBeVisible();

    await pageA.getByTestId('encyclopedia-scroll-list').locator('button, [role="button"]').first().click();
    await expect(pageA.getByTestId('encyclopedia-detail-drawer')).toBeVisible();
    await expect(pageA.getByTestId('encyclopedia-detail-drawer')).toContainText('推荐成装');
    await pageA.getByTestId('enc-tab-lore').click();
    await expect(pageA.getByTestId('encyclopedia-page')).toContainText('序幕：灰雪纪');

    await pageA.getByTestId('bottom-dock-nav').getByText('排行').click();
    await expect(pageA.getByTestId('ranking-page')).toBeVisible();
    await expect(pageA.getByTestId('self-ranking-tier')).toContainText('未定级');

    await pageA.getByTestId('bottom-dock-nav').getByText('学习').click();
    await expect(pageA.getByTestId('learning-home-page')).toBeVisible();

    await pageA.getByTestId('direct-standalone-study-btn').click();
    await expect(pageA.getByTestId('standalone-learning-overlay')).toBeVisible();
    const pausedPerf = await pageA.evaluate(() =>
      (window as unknown as { __getStagePerfStats?: () => { loopPaused: boolean } }).__getStagePerfStats?.(),
    );
    expect(pausedPerf?.loopPaused).toBe(true);
    await pageA.getByTestId('close-standalone-learning-btn').click();

    const deviceAToken = await pageA.evaluate(() => localStorage.getItem('blc_auth_token_v1'));
    expect(deviceAToken).toBeTruthy();
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageB = await contextB.newPage();
    await pageB.goto('/');
    await pageB.getByTestId('splash-enter-btn').click();
    await pageB.getByTestId('auth-tab-login').click();
    await pageB.getByTestId('auth-username-input').fill(uname);
    await pageB.getByTestId('auth-password-input').fill(stuCred);
    await pageB.getByTestId('auth-submit-btn').click();
    await expect(pageB.getByTestId('prep-room-page').or(pageB.getByTestId('top-room-bar'))).toBeVisible();

    const staleWrite = await contextA.request.post('/api/lobby/leave', {
      headers: { Authorization: `Bearer ${deviceAToken}` },
    });
    expect(staleWrite.status()).toBe(401);
    expect((await staleWrite.json()).error).toBe('SESSION_SUPERSEDED');
    await expect(pageA.getByTestId('session-superseded-banner')).toBeVisible();
    await expect(pageA.getByTestId('auth-page')).toBeVisible();

    if (!(await pageB.getByTestId('prep-room-page').isVisible())) {
      await pageB.getByTestId('top-bar-return-prep-btn').click();
    }
    await pageB.getByTestId('prep-right-controls').getByText('单人模式').click();
    await expect(pageB.getByTestId('solo-invite-hidden-note')).toBeVisible();
    await pageB.getByTestId('prep-primary-action-btn').click();

    await expect(pageB.getByTestId('match-hud-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByTestId('bottom-dock-nav')).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    await contextA.close();
    await contextB.close();
  });

  test('2. Full match lifecycle to End-of-Match Dual Summary + Return to Prep Room + Admin 5-Step Course Pack Sandbox + Mobile Landscape check', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-username-input').fill(process.env.ADMIN_USERNAME ?? 'admin_e2e');
    await page.getByTestId('auth-password-input').fill(process.env.ADMIN_PASSWORD ?? '');
    await page.getByTestId('auth-submit-btn').click();
    await expect(page.getByTestId('onboarding-three-choices')).toBeVisible();
    await page.getByTestId('onboarding-opt-skip').click();
    await expect(page.getByTestId('learning-start-selector')).toBeVisible();
    await page.getByTestId('skip-learning-start-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible();

    await page.getByTestId('bottom-dock-nav').getByText('我的').click();
    await page.getByTestId('open-admin-workbench-btn').click();
    await expect(page.getByTestId('admin-pack-workbench')).toBeVisible();
    await page.getByTestId('load-math-template-btn').click();
    await page.getByTestId('pack-step-2').click();
    await page.getByTestId('compile-pack-btn').click();
    await page.getByTestId('goto-sandbox-step-btn').click();
    await expect(page.getByTestId('pack-sandbox-step')).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible();
    await page.getByTestId('close-admin-workbench-btn').click();
    await page.getByTestId('explicit-logout-btn').click();

    await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('enter-offline-practice-btn').click();
    await page.locator('[data-testid="lobby-page"] button').filter({ hasText: /进入备战房/ }).first().click();
    await page.getByTestId('prep-primary-action-btn').click();
    await expect(page.getByTestId('match-hud-overlay')).toBeVisible();

    for (let guard = 0; guard < 55; guard++) {
      if (await page.getByTestId('match-summary-modal').isVisible()) break;

      if (await page.getByTestId('choice-event-modal').isVisible()) {
        const augBtn = page.getByTestId('pick-augment-0');
        const anvilBtn = page.getByTestId('pick-anvil-0');
        if (await augBtn.isVisible()) {
          await augBtn.click();
        } else if (await anvilBtn.isVisible()) {
          await anvilBtn.click();
        }
        await page.waitForTimeout(120);
        continue;
      }

      if (await page.getByTestId('offline-skip-phase-btn').isVisible()) {
        await page.getByTestId('offline-skip-phase-btn').click();
      }
      await page.waitForTimeout(120);
    }

    await expect(page.getByTestId('match-summary-modal')).toBeVisible();
    await expect(page.getByTestId('summary-competitive-col')).toBeVisible();
    await expect(page.getByTestId('summary-learning-col')).toBeVisible();

    await page.getByTestId('summary-return-prep-btn').click();
    await expect(page.getByTestId('prep-room-page')).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);
    const mobileMetrics = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyFontPx: parseFloat(window.getComputedStyle(document.body).fontSize),
    }));
    expect(mobileMetrics.docScrollWidth).toBeLessThanOrEqual(mobileMetrics.innerWidth + 2);
    expect(mobileMetrics.bodyFontPx).toBeGreaterThanOrEqual(12);

    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('3. Standalone 5-step direct learning earns real Reward Points -> Single-PG-transaction Gift Redemption UI closed loop', async ({
    browser,
  }) => {
    const englishPack = await import('../../../content/courses/compiled/english-core-starter.json', {
      with: { type: 'json' },
    });
    const mathPack = await import('../../../content/courses/compiled/math-core-starter.json', {
      with: { type: 'json' },
    });
    const allItems = [...englishPack.default.items, ...mathPack.default.items];

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    const uname = `e2e_scholar_${Date.now().toString().slice(-6)}`;
    await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-username-input').fill(uname);
    await page.getByTestId('auth-nickname-input').fill('研学标兵');
    await page.getByTestId('auth-password-input').fill(`c_${randomUUID().slice(0, 12)}`);
    await page.getByTestId('auth-submit-btn').click();

    await page.getByTestId('onboarding-opt-skip').click();
    await page.getByTestId('skip-learning-start-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible();

    await page.getByTestId('bottom-dock-nav').getByText('学习').click();
    await expect(page.getByTestId('learning-home-page')).toBeVisible();

    const completeStandaloneSession = async (subject: 'english' | 'math') => {
      await page.getByTestId(`learning-focus-${subject}`).click();
      await page.getByTestId('direct-standalone-study-btn').click();
      await expect(page.getByTestId('standalone-learning-overlay')).toBeVisible();

      for (let stepGuard = 0; stepGuard < 20; stepGuard++) {
        if (!(await page.getByTestId('standalone-learning-overlay').isVisible().catch(() => false))) {
          return;
        }
        if (await page.getByTestId('standalone-points-result').isVisible().catch(() => false)) {
          await page.getByTestId('close-standalone-learning-btn').click();
          return;
        }
        const advBtn = page.getByTestId('advance-step-btn');
        if (await advBtn.isVisible().catch(() => false)) {
          await advBtn.click();
          await page.waitForTimeout(150);
          continue;
        }

        if (await page.getByTestId('question-stem').isVisible().catch(() => false)) {
          const qid = await page.getByTestId('question-step-card').getAttribute('data-question-id');
          const matched = allItems.find((q) => q.questionId === qid);
          expect(matched, `Should find item matching qid: ${qid}`).toBeTruthy();

          if (matched!.questionType === 'single_choice') {
            await page.getByTestId(`option-${matched!.answerSpec.trim()}`).click();
          } else if (matched!.questionType === 'multi_choice') {
            for (const key of matched!.answerSpec.split('|')) {
              await page.getByTestId(`option-${key.trim()}`).click();
            }
          } else if (matched!.questionType === 'short_fill') {
            const ans = matched!.answerSpec.split('|')[0]!.trim();
            await page.getByTestId('short-fill-input').fill(ans);
          } else if (matched!.questionType === 'numeric') {
            const numVal = matched!.answerSpec.split(':')[0]!.trim();
            await page.getByTestId('numeric-input').fill(numVal);
          } else if (matched!.questionType === 'multi_step_numeric') {
            for (const part of matched!.answerSpec.split(';')) {
              const [sid, val] = part.split('=');
              await page.getByTestId(`multistep-input-${sid!.trim()}`).fill(val!.trim());
            }
          } else if (matched!.questionType === 'matching') {
            for (const pairStr of matched!.answerSpec.split(';')) {
              const [lTxt, rTxt] = pairStr.split('=');
              await page.getByTestId('matching-board').getByRole('button', { name: lTxt!.trim(), exact: true }).click();
              await page.getByTestId('matching-board').getByRole('button', { name: rTxt!.trim(), exact: true }).click();
            }
          }

          await page.getByTestId('submit-answer-btn').click();
          await page.waitForTimeout(180);
          if (await advBtn.isVisible().catch(() => false)) {
            await advBtn.click();
            await page.waitForTimeout(150);
          }
        }
      }

      if (await page.getByTestId('close-standalone-learning-btn').isVisible().catch(() => false)) {
        await page.getByTestId('close-standalone-learning-btn').click();
      }
    };

    await completeStandaloneSession('english');
    await completeStandaloneSession('math');

    await page.getByTestId('bottom-dock-nav').getByText('大厅').click();
    await page.getByTestId('lobby-points-capsule').click();
    await expect(page.getByTestId('redemption-page')).toBeVisible();

    const balanceBeforeText = await page.getByTestId('redemption-balance-box').innerText();
    expect(balanceBeforeText).toMatch(/[6-9]\d|\d{3,}/);

    await page.getByTestId('gift-catalog-grid').getByText('定制金属书签').click();
    await expect(page.getByTestId('gift-confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-redeem-tx-btn').click();
    await expect(page.getByTestId('gift-confirm-modal')).toHaveCount(0);

    await page.getByTestId('open-redemption-orders-btn').click();
    await expect(page.getByTestId('redemption-drawer-orders')).toContainText('定制金属书签');

    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('4. Guided practice uses visual cues and remains interactive through merge, item crafting and battle', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('enter-offline-practice-btn').click();
    await page.getByTestId('bottom-dock-nav').getByText('我的', { exact: true }).click();
    await page.getByTestId('replay-onboarding-choice-btn').click();
    await expect(page.getByTestId('onboarding-three-choices').locator('svg')).toHaveCount(3);
    await page.getByTestId('onboarding-opt-cards').click();
    await expect(page.getByTestId('guide-card-slide').locator('svg')).toHaveCount(1);
    for (let step = 0; step < 3; step++) await page.getByTestId('guide-card-next-btn').click();
    await page.getByTestId('guide-card-finish-btn').click();
    await page.getByTestId('replay-onboarding-choice-btn').click();
    await page.getByTestId('onboarding-opt-micro').click();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    const card = page.getByTestId('question-step-card');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(/ENG_N|ENG_Q|全房节点截止|已锁闭/);
    await expect(card.getByTestId('toggle-hint-btn')).toHaveCount(0);
    await card.getByTestId('option-A').click();
    await card.getByTestId('submit-answer-btn').click();
    await card.getByTestId('advance-step-btn').click();
    await expect(page.getByTestId('micro-checklist')).toBeVisible();
    await page.getByTestId('micro-shop-slot-2').click();
    await expect(page.getByTestId('micro-checklist')).toContainText('升 2★');
    await page.getByTestId('micro-equip-item-0').click();
    await page.getByTestId('micro-equip-item-0').click();
    await expect(page.getByTestId('micro-checklist')).toContainText('合主装');
    await page.getByTestId('micro-start-battle-now-btn').click();
    await expect(page.getByTestId('micro-checklist')).toHaveCount(0);
    await page.getByTestId('skip-micro-scenario-btn').click();
    await expect(page.getByTestId('profile-page')).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test('5. A real browser cross-origin PATCH persists chapter selection', async ({ page, request }) => {
    await page.goto('/');
    const username = `cors_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const password = randomUUID();
    const registered = await request.post('/api/auth/register', { data: { username, password, nickname: 'Pilot' } });
    expect(registered.status()).toBe(201);
    const login = await request.post('/api/auth/login', { data: { username, password } });
    expect(login.status()).toBe(200);
    const { token } = await login.json() as { token: string };
    const result = await page.evaluate(async ({ token, apiOrigin }) => {
      const selections = { english: 'ENG_N1_VOCAB_DIALOGUE', math: 'MATH_N1_SET_FUNC' };
      const response = await fetch(`${apiOrigin}/api/auth/profile`, {
        method: 'PATCH', credentials: 'include',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningStartSelections: selections, onboardingChoice: 'skipped' }),
      });
      const profile = await response.json();
      const readResponse = await fetch(`${apiOrigin}/api/auth/me`, {
        credentials: 'include', headers: { Authorization: `Bearer ${token}` },
      });
      const read = await readResponse.json();
      return { status: response.status, saved: profile.learningStartSelections, readStatus: readResponse.status, readBack: read.profile.learningStartSelections };
    }, { token, apiOrigin: process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:3101' });
    expect(result.status).toBe(200);
    expect(result.readStatus).toBe(200);
    expect(result.saved).toEqual({ english: 'ENG_N1_VOCAB_DIALOGUE', math: 'MATH_N1_SET_FUNC' });
    expect(result.readBack).toEqual(result.saved);
  });

  test('6. Interrupted chapter save retains selection and retries without a false completion', async ({ page, context }) => {
    await page.goto('/');
    await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-username-input').fill(`retry_${randomUUID().replace(/-/g, '').slice(0, 12)}`);
    await page.getByTestId('auth-nickname-input').fill('Pilot');
    await page.getByTestId('auth-password-input').fill(randomUUID());
    await page.getByTestId('auth-submit-btn').click();
    await page.getByTestId('onboarding-opt-skip').click();
    const chapterSelector = page.getByTestId('learning-start-selector');
    await expect(chapterSelector).toBeVisible();
    const secondEnglish = chapterSelector.locator('input[type="radio"]').nth(1);
    await secondEnglish.check();
    const chosenValue = await secondEnglish.inputValue();
    await context.setOffline(true);
    await page.getByTestId('save-learning-start-btn').click();
    await expect(page.getByText('起始章节尚未确认保存，当前选择已保留。', { exact: false })).toBeVisible();
    await expect(chapterSelector).toBeVisible();
    await expect(secondEnglish).toBeChecked();
    await expect(page.getByTestId('save-learning-start-btn')).toBeEnabled();
    await expect(page.getByTestId('lobby-page')).toHaveCount(0);
    await expect(page.locator('.blc-toast-stack')).not.toContainText('Load failed');
    await context.setOffline(false);
    const savedResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/profile') && response.request().method() === 'PATCH');
    await page.getByTestId('save-learning-start-btn').click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(200);
    expect((await saved.json()).learningStartSelections.english).toBe(chosenValue);
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    await expect(page.getByTestId('onboarding-modal')).toHaveCount(0);
  });
});
