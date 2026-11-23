import { expect, type Page } from '@playwright/test';
import { apiResponse, backToLobby, closeSettings, enterFromStartGate, enterPrepRoom, exitOfflineMatch, expectDirectLobby, expectSignedOutStart, expectStartGate, fillAuth, firstEnglishTitle, localToken, login, openAuth, openSettings, openStudy, openSubpage, register, skipOnboarding, startOfflineMatch, tacticians, verifyOptionalEmail } from './support/flowHelpers.js';
import { enterOfflineSandboxFromLobby, installOfflineSandboxHarness } from './support/offlineSandbox.js';
import { answerQuestion, apiUrl, authenticatedApi, completeLesson, english, finishOfflineMatch, newPilot, readMatch, readStage, setShopDock, test, type ProfileRead, type RewardRead } from './support/fullAcceptance.js';

const firstChapter = `第 1 节 · ${firstEnglishTitle}`;
const firstMath = 'MATH_N1_SET_FUNC';
const arena = 'event_horizon_observatory';

async function enroll(page: Page, nickname: string) {
  const pilot = newPilot(nickname);
  await page.goto('/');
  await register(page, pilot);
  await skipOnboarding(page);
  return pilot;
}

test.use({ actionTimeout: 10_000 });

test('branded launch, optional email and skipped guide lead to the 3D lobby and current English chapter', async ({ checkedPage: page }) => {
  const pilot = newPilot('深空领航员');
  await page.goto('/');
  await expectSignedOutStart(page);
  await expect.poll(async () => (await readStage(page))?.webglAvailable).toBe(true);
  await expect.poll(async () => (await readStage(page))?.drawCalls ?? 0).toBeGreaterThan(0);
  const perf = (await readStage(page))!;
  expect(perf.drawCalls).toBeLessThanOrEqual(120);
  expect(perf.triangles).toBeLessThanOrEqual(180_000);
  await openAuth(page, 'register');
  await verifyOptionalEmail(page);
  await fillAuth(page, pilot);
  await page.getByTestId('auth-submit-btn').click();
  await expect(page.getByTestId('onboarding-three-choices').locator('svg')).toHaveCount(3);
  await skipOnboarding(page);
  const api = await authenticatedApi(page);
  expect((await api<ProfileRead>('/api/me')).profile).toMatchObject({ nickname: pilot.nickname, onboardingChoice: 'skipped', emailMasked: null });
  const prep = await enterPrepRoom(page, 'quick');
  await expect(prep.getByTestId('prep-chapter-summary-btn')).toContainText(firstChapter);
  await expect(prep.getByTestId('estimated-end-time-box')).toContainText(/预计\s*\d{2}:\d{2}\s*结束/);
  await expect(prep.getByTestId(/^prep-invite-slot-/)).toHaveCount(7);
  await expect(page.getByTestId('persistent-stage-canvas')).toHaveAttribute('data-scene-mode', 'prep');
});

test('a signed-in reload waits at the start gate, supports lobby entry and can sign out', async ({ checkedPage: page }) => {
  const pilot = await enroll(page, '启动门领航员');
  const token = await localToken(page);
  expect(token).toBeTruthy();
  await page.reload();
  await expectStartGate(page, pilot.nickname);
  expect(await localToken(page)).toBe(token);
  await enterFromStartGate(page);
  await expectDirectLobby(page);
  await expect.poll(async () => (await readStage(page))?.webglAvailable).toBe(true);
  await page.reload();
  await expectStartGate(page, pilot.nickname);
  const loggedOut = apiResponse(page, '/api/auth/logout', 'POST');
  await page.getByTestId('start-gate-logout-btn').click();
  expect((await loggedOut).ok()).toBe(true);
  await expectSignedOutStart(page);
  expect(await localToken(page)).toBeNull();
  const revoked = await page.request.get(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
  expect(revoked.status()).toBe(401);
});

test('two signed-in pilots join through a room code and accept one real match; the old session cannot write', async ({ checkedPage: stalePage, newPeer }) => {
  const host = await enroll(stalePage, '联机房主');
  const staleToken = await localToken(stalePage);
  const oldPrep = await enterPrepRoom(stalePage, 'quick');
  const casual = oldPrep.getByTestId('prep-queue-casual');
  await casual.click();
  await expect(casual).toHaveClass(/sf-seg-btn--active/);
  const code = await oldPrep.getByTestId('prep-room-code-box').locator('strong').innerText();
  const hostPage = await newPeer();
  await hostPage.goto('/');
  await login(hostPage, host);
  await expect(hostPage.getByTestId('prep-room-code-box')).toContainText(code);
  const stale = await stalePage.request.post(apiUrl('/api/lobby/leave'), { headers: { Authorization: `Bearer ${staleToken}` } });
  expect(stale.status()).toBe(401);
  expect((await stale.json()).error).toBe('SESSION_SUPERSEDED');
  await expect(stalePage.getByTestId('session-superseded-banner')).toBeVisible();
  await stalePage.close();

  const guestPage = await newPeer();
  const guest = await enroll(guestPage, '联机队友');
  await guestPage.getByTestId('open-join-code-btn').click();
  const join = guestPage.getByRole('dialog', { name: '房间码加入' });
  await join.getByTestId('room-code-input').fill(code);
  await join.getByTestId('confirm-join-code-btn').click();
  await expect(guestPage.getByTestId('prep-seat-member-0')).toContainText(host.nickname);
  await expect(hostPage.getByTestId('prep-seat-member-1')).toContainText(guest.nickname);
  await guestPage.getByTestId('prep-primary-action-btn').click();
  await expect(hostPage.getByTestId('prep-seat-member-1')).toContainText('已就绪');
  await hostPage.getByTestId('prep-primary-action-btn').click();
  await Promise.all([hostPage, guestPage].map(async (client) => {
    await expect(client.getByTestId('accept-count-summary')).toContainText(/\/\s*2 位指挥官/);
    await client.getByTestId('accept-match-btn').click();
    await expect(client.getByTestId('match-hud-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(client.getByTestId('offline-skip-phase-btn')).toHaveCount(0);
  }));

  const [hostSeat, guestSeat] = await Promise.all([readMatch(hostPage), readMatch(guestPage)]);
  expect(hostSeat).not.toBeNull();
  expect(guestSeat).toMatchObject({ roomId: hostSeat!.roomId, matchId: hostSeat!.matchId, mode: 'quick', queueType: 'casual' });
  expect(guestSeat!.seatId).not.toBe(hostSeat!.seatId);
  expect(hostSeat!.seats.filter((seat) => !seat.isBot).map((seat) => seat.nickname)).toEqual(expect.arrayContaining([host.nickname, guest.nickname]));
  expect(hostSeat!.seats).toHaveLength(8);

  await hostPage.addInitScript(() => {
    new MutationObserver((mutations) => {
      const selector = '[data-testid="auth-page"]';
      const shown = mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) =>
        node instanceof Element && (node.matches(selector) || node.querySelector(selector))));
      if (shown) document.documentElement.dataset.reconnectSawAuth = 'true';
    }).observe(document, { childList: true, subtree: true });
  });
  await hostPage.reload();
  await expect(hostPage.getByTestId('match-hud-overlay')).toBeVisible({ timeout: 15_000 });
  await expect(hostPage.getByTestId('auth-page')).toHaveCount(0);
  expect(await hostPage.evaluate(() => document.documentElement.dataset.reconnectSawAuth)).toBeUndefined();
  const reconnected = await readMatch(hostPage);
  expect(reconnected).toMatchObject({ roomId: hostSeat!.roomId, matchId: hostSeat!.matchId, seatId: hostSeat!.seatId });

  const card = hostPage.getByTestId('inmatch-learning-overlay').getByTestId('question-step-card');
  await expect(card).toBeVisible({ timeout: 35_000 });
  const advance = card.getByTestId('advance-step-btn');
  if (await advance.isEnabled()) await advance.click();
  await expect(card.getByTestId('submit-answer-btn')).toBeVisible();
  const questionId = await card.getAttribute('data-question-id');
  await answerQuestion(card);
  await expect.poll(async () => (await readMatch(hostPage))?.learning?.submittedQuestionIds).toContain(questionId);
});

test('offline shop settings survive reload, both docks avoid HUD chrome and the run returns to prep', async ({ checkedPage: page }) => {
  test.setTimeout(240_000);
  await installOfflineSandboxHarness(page);
  const pilot = await enroll(page, '单机舞台测试员');
  await enterOfflineSandboxFromLobby(page);
  const settings = await openSettings(page, 'match');
  await expect(settings.getByTestId('shop-dock-bottom-btn')).toHaveAttribute('aria-checked', 'true');
  await closeSettings(page);
  await setShopDock(page, 'top');
  await page.reload();
  await expectStartGate(page, pilot.nickname);
  await enterFromStartGate(page);
  await enterOfflineSandboxFromLobby(page);
  await openSettings(page, 'match');
  await expect(settings.getByTestId('shop-dock-top-btn')).toHaveAttribute('aria-checked', 'true');
  await expect(settings.getByTestId('shop-layout-diagram')).toHaveAttribute('data-position', 'top');
  await closeSettings(page);
  const hud = await startOfflineMatch(page, 'quick');
  await expect(hud).toHaveAttribute('data-shop-dock-position', 'top');
  await exitOfflineMatch(page);
  await expect(hud).toHaveCount(0);
  await expectDirectLobby(page);
  await startOfflineMatch(page, 'quick');
  const summary = await finishOfflineMatch(page);
  await summary.getByTestId('summary-return-prep-btn').click();
  await expect(page.getByTestId('prep-room-page')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
});

test('collection previews three free tacticians and the 3D stage reads back equipped visuals', async ({ checkedPage: page }) => {
  await enroll(page, '藏品收藏家');
  const api = await authenticatedApi(page);
  const profile = async () => (await api<ProfileRead>('/api/me')).profile;
  const initial = await profile();
  const [bell, whale, cat] = tacticians;
  const collection = await openSubpage(page, 'encyclopedia');
  await collection.getByTestId('enc-tab-units').click();
  await collection.getByTestId('encyclopedia-scroll-list').getByRole('button').first().click();
  await expect(collection.getByTestId('encyclopedia-detail-drawer')).toContainText('推荐成装');
  await collection.getByTestId('enc-tab-lore').click();
  await expect(collection).toContainText('序幕：灰雪纪');
  await collection.getByTestId('enc-tab-tacticians').click();
  const panel = collection.getByTestId('tactician-collection-panel');
  await expect(panel.getByTestId(/^tactician-card-/)).toHaveCount(3);
  for (const { id, name } of tacticians) {
    const card = panel.getByTestId(`tactician-card-${id}`);
    await expect(card).toBeEnabled();
    await card.click();
    await expect(panel.getByTestId('tactician-showcase-stage').getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(panel.getByTestId(`tactician-card-${bell.id}`)).toContainText('出战中');
  expect((await profile()).preferredTacticianId).toBe(bell.id);
  const equipCat = panel.getByTestId(`equip-tactician-${cat.id}`);
  await equipCat.click();
  await expect(equipCat).toBeDisabled();
  expect(await profile()).toMatchObject({ preferredTacticianId: cat.id, preferredArena: initial.preferredArena });
  await collection.getByTestId('enc-tab-arenas').click();
  await collection.getByTestId(`arena-card-${arena}`).click();
  const equipArena = collection.getByTestId(`equip-arena-${arena}`);
  await equipArena.click();
  await expect(equipArena).toHaveText('已设为默认舞台');
  await backToLobby(page);
  await expect.poll(async () => await readStage(page)).toMatchObject({ arena, tactician: cat.id });
  const settings = await openSettings(page, 'display');
  await expect(settings.getByTestId(`settings-arena-${arena}`)).toContainText('已装备');
  const chooseWhale = settings.getByTestId(`settings-tactician-${whale.id}`);
  await chooseWhale.click();
  await expect(chooseWhale).toContainText('出战中');
  const { avatarFrameId, boardPlaqueId, displaySettings } = initial;
  expect(await profile()).toMatchObject({ avatarFrameId, boardPlaqueId, displaySettings, preferredArena: arena, preferredTacticianId: whale.id });
  await page.reload();
  await enterFromStartGate(page);
  await expectDirectLobby(page);
  await expect.poll(async () => await readStage(page)).toMatchObject({ arena, tactician: whale.id });
});

test('cosmos reading switches to parchment and verified study points fund one confirmed redemption', async ({ checkedPage: page }) => {
  await enroll(page, '积分兑换学员');
  const api = await authenticatedApi(page);
  const rewards = () => api<RewardRead>('/api/rewards/summary');
  expect((await rewards()).balance).toBe(0);
  const learning = await openSubpage(page, 'learning');
  await expect(learning).toContainText(firstEnglishTitle);
  const overlay = page.getByTestId('standalone-learning-overlay');
  const card = overlay.getByTestId('question-step-card');
  const result = overlay.getByTestId('standalone-points-result');
  await openStudy(page);
  await expect.poll(async () => (await readStage(page))?.loopPaused).toBe(true);
  await expect(card).toHaveAttribute('data-reading-theme', 'cosmos');
  await card.getByRole('button', { name: '切换至暖羊皮纸护眼态' }).click();
  await expect(card).toHaveAttribute('data-reading-theme', 'parchment');
  await expect(card.getByRole('button', { name: '切换至深空星图护眼态' })).toHaveAttribute('aria-pressed', 'true');
  const englishSteps = await completeLesson(overlay, result);
  expect(englishSteps).toEqual(new Set(['material', 'practice', 'resource_check', 'remediation', 'verification']));
  await expect(result).toHaveText(/^\+\d+ 积分$/);
  await overlay.getByTestId('close-standalone-learning-btn').click();

  await learning.getByTestId('learning-focus-math').click();
  await openStudy(page);
  await expect(card).toHaveAttribute('data-reading-theme', 'parchment');
  await completeLesson(overlay, result);
  await expect(result).toHaveText(/^\+\d+ 积分$/);
  await overlay.getByTestId('close-standalone-learning-btn').click();
  await backToLobby(page);
  const before = await rewards();
  const bookmark = before.gifts.find((gift) => gift.title === '定制金属书签')!;
  expect(before.balance).toBeGreaterThanOrEqual(bookmark.pointsCost);
  const mall = await openSubpage(page, 'redemption');
  await mall.getByTestId(`gift-card-${bookmark.giftId}`).click();
  const confirm = mall.getByRole('dialog', { name: '确认兑换' });
  await expect(confirm).toContainText(bookmark.title);
  const redeem = apiResponse(page, '/api/rewards/redeem', 'POST');
  await confirm.getByTestId('confirm-redeem-tx-btn').click();
  expect((await redeem).ok()).toBe(true);
  await expect(confirm).toBeHidden();
  await mall.getByTestId('open-redemption-orders-btn').click();
  await expect(mall.getByTestId('redemption-drawer-orders')).toContainText(bookmark.title);
  const after = await rewards();
  expect(after.balance).toBe(before.balance - bookmark.pointsCost);
  expect(after.gifts.find((gift) => gift.giftId === bookmark.giftId)?.stockRemaining).toBe(bookmark.stockRemaining - 1);
  expect(after.orders).toHaveLength(1);
  expect(after.orders[0]!.giftTitle).toBe(bookmark.title);
  expect(after.ledger.filter((entry) => entry.reason === 'gift_redemption')).toEqual([
    expect.objectContaining({ points_delta: -bookmark.pointsCost, related_order_id: after.orders[0]!.orderId }),
  ]);
});

test('cross-origin chapter save retains selection on failure and reads back after retry and reload', async ({ checkedPage: page, context }) => {
  await enroll(page, '学习章节学员');
  const settings = await openSettings(page, 'learning');
  const englishSelect = settings.getByTestId('settings-english-start-select');
  const [first, second] = english.manifest.knowledgeGraph;
  await expect(englishSelect).toHaveValue(first!.nodeId);
  await expect(englishSelect.locator('option:checked')).toHaveText(firstChapter);
  await expect(settings.getByTestId('settings-math-start-select')).toHaveValue(firstMath);
  await englishSelect.selectOption(second!.nodeId);
  const save = settings.getByTestId('save-learning-start-btn');
  await context.setOffline(true);
  try {
    await save.click();
    await expect(settings.getByTestId('learning-start-save-error')).toContainText('保存失败，请检查连接后重试。');
    await expect(englishSelect).toHaveValue(second!.nodeId);
    await expect(save).toBeEnabled();
    await expect(page.getByTestId('toast-banner-stack')).not.toContainText('学习起始章节已保存');
  } finally {
    await context.setOffline(false);
  }
  const persisted = apiResponse(page, '/api/auth/profile', 'PATCH');
  await save.click();
  const response = await persisted;
  expect(response.ok()).toBe(true);
  expect(response.url()).toBe(apiUrl('/api/auth/profile'));
  expect((await response.json()).learningStartSelections.english).toBe(second!.nodeId);
  await expect(page.getByTestId('toast-banner-stack')).toContainText('学习起始章节已保存');
  await page.reload();
  await enterFromStartGate(page);
  await expectDirectLobby(page);
  await openSettings(page, 'learning');
  await expect(englishSelect).toHaveValue(second!.nodeId);
});

test('the guide can be replayed through buying, merging, equipping and battle', async ({ checkedPage: page }) => {
  await enroll(page, '玩法引导测试员');
  const profile = await openSubpage(page, 'profile');
  const settings = await openSettings(page, 'learning');
  await settings.getByTestId('replay-onboarding-choice-btn').click();
  await expect(page.getByTestId('guide-card-slide').locator('svg')).toHaveCount(1);
  for (let remaining = 3; remaining > 0; remaining--) await page.getByTestId('guide-card-next-btn').click();
  await page.getByTestId('guide-card-finish-btn').click();
  await expect(profile).toBeVisible();
  await openSettings(page, 'learning');
  await settings.getByTestId('replay-micro-scenario-btn').click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  const card = page.getByTestId('question-step-card');
  await expect(card.getByTestId('toggle-hint-btn')).toHaveCount(0);
  await card.getByTestId('option-A').click();
  await card.getByTestId('submit-answer-btn').click();
  await card.getByTestId('advance-step-btn').click();
  const checklist = page.getByTestId('micro-checklist');
  await page.getByTestId('micro-shop-slot-2').click();
  await expect(checklist).toContainText('升 2★');
  const equip = page.getByTestId('micro-equip-item-0');
  await equip.click();
  await equip.click();
  await expect(checklist).toContainText('合主装');
  await page.getByTestId('micro-start-battle-now-btn').click();
  await expect(checklist).toHaveCount(0);
  await page.getByTestId('skip-micro-scenario-btn').click();
  await expect(profile).toBeVisible();
});

test('real admin compiles a math course draft and previews KaTeX in the sandbox', async ({ checkedPage: page }) => {
  await page.goto('/');
  await login(page, { username: process.env.ADMIN_USERNAME!, password: process.env.ADMIN_PASSWORD! });
  await skipOnboarding(page);
  const profile = await openSubpage(page, 'profile');
  await profile.getByTestId('open-admin-workbench-btn').click();
  const workbench = page.getByTestId('admin-pack-workbench');
  await workbench.getByTestId('load-math-template-btn').click();
  await workbench.getByTestId('pack-step-2').click();
  await workbench.getByTestId('compile-pack-btn').click();
  await workbench.getByTestId('goto-sandbox-step-btn').click();
  await expect(workbench.getByTestId('pack-sandbox-step').locator('.katex').first()).toBeVisible();
});
