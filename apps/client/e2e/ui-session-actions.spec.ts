import { expect } from '@playwright/test';
import { deferred, emptyLobby, english, fail, me, ok, profile, roomLobby, test } from './support/mockUi.js';
import { apiResponse, backToLobby, closeSettings, enterFromStartGate, expectDirectLobby, expectSignedOutStart, expectStartGate, fillAuth, firstEnglishTitle, localToken, login, openAuth, openModeOverlay, openSettings, openSubpage, register, settleUi, skipOnboarding, tacticians, verifyOptionalEmail, visitLobby } from './support/flowHelpers.js';

const credentials = { username: 'audit_user', password: 'audit-password', nickname: '审计样本' };

test('new commander uses the branded launch capsules, skips the guide and enters an eight-seat room', async ({ page, mock }) => {
  let current = { ...profile, onboardingChoice: 'unset', learningStartSelections: {} };
  const room = { ...roomLobby, prepRoom: { ...roomLobby.prepRoom, durationMode: 'quick', plannedTotalSeconds: 900 } };
  await mock({
    'POST /api/auth/register': (route) => {
      expect(route.request().postDataJSON()).toEqual({ ...credentials, email: null });
      return ok(route, { profile: current });
    },
    'POST /api/auth/login': (route) => ok(route, {
      token: 'audit-pilot', profile: current, userId: profile.userId, sessionEpoch: 1, activeSeat: null,
    }),
    'GET /api/me': (route) => ok(route, { ...me, profile: current }),
    'PATCH /api/auth/profile': (route) => {
      const patch = route.request().postDataJSON();
      expect(patch).toEqual({ onboardingChoice: 'skipped' });
      current = { ...current, ...patch };
      return ok(route, current);
    },
    'POST /api/lobby/enter': (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ durationMode: 'quick' });
      return ok(route, room);
    },
  }, null);
  await page.goto('/');
  await expectSignedOutStart(page);
  await openAuth(page, 'register');
  await verifyOptionalEmail(page);
  await fillAuth(page, credentials);
  await page.getByTestId('auth-submit-btn').click();
  await expect(page.getByTestId('onboarding-three-choices').locator('svg')).toHaveCount(3);
  await skipOnboarding(page);
  const overlay = await openModeOverlay(page, 'quick');
  for (const [mode, minutes] of [['quick', 15], ['standard', 30], ['deep', 60]] as const) {
    const emblem = overlay.getByTestId(`mode-card-${mode}`);
    await expect(emblem.locator('svg')).toBeVisible();
    await expect(emblem).toContainText(`${minutes}分钟`);
  }
  await overlay.getByTestId('mode-overlay-confirm-btn').click();
  await expect(page.getByTestId('persistent-stage-canvas')).toHaveAttribute('data-scene-mode', 'prep');
  await expect(page.getByTestId('prep-seat-member-0')).toContainText(credentials.nickname);
  await expect(page.getByTestId(/^prep-invite-slot-/)).toHaveCount(7);
  await expect(page.getByTestId('prep-chapter-summary-btn')).toContainText(firstEnglishTitle);
});

test('the codex keeps the room status and renders 36 live portraits', async ({ page, mock }) => {
  let joined = false;
  await mock({
    'GET /api/lobby/state': (route) => ok(route, joined ? roomLobby : emptyLobby),
    'POST /api/lobby/enter': (route) => {
      joined = true;
      return ok(route, roomLobby);
    },
  });
  await visitLobby(page);
  await (await openModeOverlay(page, 'standard')).getByTestId('mode-overlay-confirm-btn').click();
  await page.getByTestId('prep-back-to-lobby-view-btn').click();
  const codex = await openSubpage(page, 'encyclopedia');
  await expect(page.getByTestId('top-room-bar')).toContainText(roomLobby.prepRoom.roomCode);
  await codex.getByTestId('enc-tab-units').click();
  const portraits = codex.locator('.sf-enc-unit-wall .sf-unit-portrait img');
  await expect(portraits).toHaveCount(36);
  if (await page.evaluate(() => Boolean((window as Window & { __getStagePerfStats?: () => { webglAvailable: boolean } }).__getStagePerfStats?.()?.webglAvailable))) {
    await expect(codex.locator('.sf-enc-unit-wall .sf-unit-portrait img[src^="data:image/png"]')).toHaveCount(36, { timeout: 12_000 });
  }
});

test('the gear switches actual fullscreen, stages and tacticians and can reopen the guide', async ({ page, mock }) => {
  let current = profile;
  await mock({
    'GET /api/me': (route) => ok(route, { ...me, profile: current }),
    'PATCH /api/auth/profile': (route) => {
      current = { ...current, ...route.request().postDataJSON() };
      return ok(route, current);
    },
  });
  await visitLobby(page);
  const settings = await openSettings(page, 'display');
  await expect(settings.getByRole('heading', { name: '设置' })).toBeVisible();
  for (const [button, enabled, label] of [
    ['display-landscape-fullscreen-btn', true, '全屏横屏'],
    ['display-landscape-window-btn', false, '窗口横屏'],
  ] as const) {
    await settings.getByTestId(button).click();
    await expect(settings.locator('.sf-settings-card__head').getByText(label, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(enabled);
    expect(current.displaySettings.fullscreen).toBe(enabled);
  }
  for (const id of ['event_horizon_observatory', 'mercury_dyson_forge', 'orbital_elevator_port']) {
    const stage = settings.getByTestId(`settings-arena-${id}`);
    await stage.click();
    await expect(stage).toContainText('已装备');
    expect(current.preferredArena).toBe(id);
  }
  for (const { id, name } of [tacticians[1], tacticians[2], tacticians[0]]) {
    const card = settings.getByTestId(`settings-tactician-${id}`);
    await expect(card).toContainText(name);
    await card.click();
    await expect(card).toContainText('出战中');
    expect(current.preferredTacticianId).toBe(id);
  }
  await settings.getByTestId('settings-tab-learning').click();
  await settings.getByTestId('replay-onboarding-choice-btn').click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByTestId('guide-card-slide')).toBeVisible();
});

test('boot refresh cannot authenticate after another boot request invalidates its session', async ({ page, mock }) => {
  const gate = deferred();
  await mock({
    'GET /api/me': async (route) => { await gate.promise; await ok(route, me); },
    'GET /api/lobby/state': (route) => fail(route, 'SESSION_SUPERSEDED', 401),
  });
  try {
    await page.goto('/');
    await expect(page.getByTestId('session-superseded-banner')).toBeVisible();
    const response = apiResponse(page, '/api/me');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('auth-page')).toBeVisible();
    await expect(page.getByTestId('lobby-page')).toHaveCount(0);
    expect(await localToken(page)).toBeNull();
  } finally { gate.resolve(); }
});

test('returning to the two-button start screen during a pending login grants no anonymous access', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred();
  await mock({
    'POST /api/auth/login': async (route) => {
      started.resolve(); await gate.promise;
      await ok(route, { token: 'audit-late-token', profile, userId: profile.userId, sessionEpoch: 1,
        expiresAtIso: '2027-01-01T00:00:00Z', activeSeat: null });
    },
  }, null);
  try {
    await page.goto('/'); await login(page, credentials); await started.promise;
    await page.getByRole('button', { name: '← 返回', exact: true }).click();
    await expectSignedOutStart(page);
    expect(await localToken(page)).toBeNull();
    gate.resolve();
    await expectDirectLobby(page);
    expect(await localToken(page)).toBe('audit-late-token');
  } finally { gate.resolve(); }
});

test('a restored account can enter the 3D lobby or sign out directly from the start gate', async ({ page, mock }) => {
  let logoutToken: string | undefined;
  await mock({
    'POST /api/auth/logout': (route) => {
      logoutToken = route.request().headers().authorization;
      return ok(route, { ok: true });
    },
  });
  await visitLobby(page);
  await page.reload();
  await expectStartGate(page, profile.nickname);
  await enterFromStartGate(page);
  await expectDirectLobby(page);
  await page.reload();
  await expectStartGate(page, profile.nickname);
  await page.getByTestId('start-gate-logout-btn').click();
  await expectSignedOutStart(page);
  expect(logoutToken).toBe('Bearer audit-old-token');
  expect(await localToken(page)).toBeNull();
  await page.reload();
  await expectSignedOutStart(page);
});

test('old-session unauthorized response cannot invalidate a new login', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred(); let requestToken = '';
  await mock({
    'GET /api/learning/dashboard': async (route) => {
      requestToken = route.request().headers().authorization ?? ''; started.resolve();
      await gate.promise; await fail(route, 'SESSION_SUPERSEDED', 401);
    },
    'POST /api/auth/login': (route) => ok(route, {
      token: 'audit-new-token', profile, userId: profile.userId, sessionEpoch: 2,
      expiresAtIso: '2027-01-01T00:00:00Z', activeSeat: null,
    }),
  });
  try {
    await visitLobby(page);
    await openSubpage(page, 'learning');
    await started.promise;
    await backToLobby(page);
    const settings = await openSettings(page, 'account');
    await settings.getByTestId('explicit-logout-btn').click();
    await login(page, credentials);
    await expectDirectLobby(page);
    expect(requestToken).toBe('Bearer audit-old-token');
    const response = apiResponse(page, '/api/learning/dashboard');
    gate.resolve(); await (await response).finished(); await settleUi(page);
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    expect(await localToken(page)).toBe('audit-new-token');
  } finally { gate.resolve(); }
});

test('late room preference response cannot restore a room after leave succeeds', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred(); let left = false;
  await mock({
    'GET /api/lobby/state': (route) => ok(route, left ? emptyLobby : roomLobby),
    'PATCH /api/lobby/member-prefs': async (route) => {
      const saved = { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, ...route.request().postDataJSON() } };
      started.resolve(); await gate.promise; await ok(route, saved);
    },
    'POST /api/lobby/leave': (route) => { left = true; return ok(route, emptyLobby); },
  });
  try {
    await page.goto('/'); await enterFromStartGate(page);
  await expect(page.getByTestId('prep-room-page')).toBeVisible();
    await page.getByTestId('prep-shared-subject-math').click(); await started.promise;
    await page.getByTestId('prep-leave-room-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    const response = apiResponse(page, '/api/lobby/member-prefs', 'PATCH');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('top-room-bar')).toHaveCount(0);
    await expect(page.getByTestId('lobby-resume-prep-btn')).toHaveCount(0);
  } finally { gate.resolve(); }
});

test('nickname save stays single-flight and applies the confirmed nickname', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred(); let requests = 0;
  await mock({
    'PATCH /api/auth/profile': async (route) => {
      requests++; const saved = { ...profile, ...route.request().postDataJSON() };
      started.resolve(); await gate.promise; await ok(route, saved);
    },
  });
  try {
    await visitLobby(page);
    await openSubpage(page, 'profile');
    await page.getByRole('button', { name: '改名', exact: true }).click();
    const input = page.getByTestId('profile-page').locator('input[maxlength="24"]');
    await input.fill('Confirmed-Nick');
    await page.getByRole('button', { name: '保存', exact: true }).click(); await started.promise;
    await expect(page.getByRole('button', { name: '保存中…', exact: true })).toBeDisabled();
    await expect(input).toBeDisabled(); expect(requests).toBe(1);
    gate.resolve(); await expect(page.getByTestId('profile-page')).toContainText('Confirmed-Nick');
    await expect(input).toHaveCount(0); expect(requests).toBe(1);
  } finally { gate.resolve(); }
});

test('fullscreen refusal does not persist fullscreen or claim it was applied', async ({ page, mock }) => {
  let updates = 0;
  await mock({
    'PATCH /api/auth/profile': (route) => { updates++; return ok(route, profile); },
  });
  await page.addInitScript(() => Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true, value: () => Promise.reject(new DOMException('Audit denied', 'NotAllowedError')),
  }));
  await visitLobby(page);
  await openSubpage(page, 'profile');
  const settings = await openSettings(page, 'display');
  await settings.getByTestId('display-landscape-fullscreen-btn').click();
  await expect(page.locator('.blc-toast').filter({ hasText: '显示模式未切换' })).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  expect(updates).toBe(0);
  await expect(settings.locator('.sf-settings-card__head').getByText('窗口横屏', { exact: true })).toBeVisible();
  await expect(page.locator('.blc-toast').filter({ hasText: '已切换至全屏横屏' })).toHaveCount(0);
});

test('onboarding failed writes retain the current step and both retries can succeed', async ({ page, mock }) => {
  let current = { ...profile, onboardingChoice: 'unset', learningStartSelections: {} };
  let failed = true;
  const writes: unknown[] = [];
  await mock({
    'GET /api/me': (route) => ok(route, { ...me, profile: current }),
    'PATCH /api/auth/profile': (route) => {
      const patch = route.request().postDataJSON();
      writes.push(patch);
      if (failed) return fail(route);
      current = { ...current, ...patch }; return ok(route, current);
    },
  });
  await page.goto('/'); await enterFromStartGate(page);
  await expect(page.getByTestId('onboarding-three-choices')).toBeVisible();
  await page.getByTestId('onboarding-opt-skip').click();
  await expect(page.locator('.blc-toast').filter({ hasText: '启航进度尚未确认保存' })).toBeVisible();
  await expect(page.getByTestId('onboarding-three-choices')).toBeVisible();
  failed = false;
  await skipOnboarding(page);
  expect(writes).toEqual([{ onboardingChoice: 'skipped' }, { onboardingChoice: 'skipped' }]);

  const settings = await openSettings(page, 'learning');
  const select = settings.getByTestId('settings-english-start-select');
  const second = english.manifest.knowledgeGraph[1]!;
  await expect(select).toHaveValue('ENG_N1_VOCAB_DIALOGUE');
  await expect(select.locator('option:checked')).toContainText(firstEnglishTitle);
  await select.selectOption(second.nodeId);
  failed = true; await settings.getByTestId('save-learning-start-btn').click();
  await expect(settings.getByTestId('learning-start-save-error')).toContainText('保存失败，请检查连接后重试。');
  await expect(settings.getByTestId('learning-start-selector')).toBeVisible();
  await expect(select).toHaveValue(second.nodeId);
  expect(current.learningStartSelections).toEqual({});
  failed = false; await settings.getByTestId('save-learning-start-btn').click();
  await expect(page.getByTestId('toast-banner-stack')).toContainText('学习起始章节已保存');
  await closeSettings(page);
  await expectDirectLobby(page);
  expect(writes).toHaveLength(4);
  expect(writes[3]).toEqual(writes[2]);
  expect(current.learningStartSelections).toMatchObject({ english: second.nodeId });
});

test('arena persistence failure restores the confirmed arena and is visible to the user', async ({ page, mock }) => {
  await mock({
    'PATCH /api/auth/profile': (route) => fail(route),
  });
  await visitLobby(page);
  const settings = await openSettings(page, 'display');
  const original = settings.getByTestId('settings-arena-orbital_elevator_port');
  const rejected = settings.getByTestId('settings-arena-event_horizon_observatory');
  await rejected.click();
  await expect(page.locator('.blc-toast').filter({ hasText: 'AUDIT_FAILURE' })).toBeVisible();
  await expect(original.getByText('已装备', { exact: true })).toBeVisible();
  await expect(rejected.getByText('已装备', { exact: true })).toHaveCount(0);
});

test('successful registration with failed auto-login retries only login', async ({ page, mock }) => {
  let registrations = 0; let logins = 0;
  await mock({
    'POST /api/auth/register': (route) => { registrations++; return ok(route, { profile }); },
    'POST /api/auth/login': (route) => {
      logins++;
      return logins === 1 ? fail(route) : ok(route, {
        token: 'audit-registration-token', profile, userId: profile.userId, sessionEpoch: 1,
        expiresAtIso: '2027-01-01T00:00:00Z', activeSeat: null,
      });
    },
  }, null);
  await page.goto('/');
  await register(page, credentials);
  await expect(page.getByTestId('auth-error-msg')).toContainText('账号已创建，请登录');
  await expect(page.getByTestId('auth-tab-login')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('auth-nickname-input')).toHaveCount(0);
  await expect(page.getByTestId('auth-username-input')).toHaveValue('audit_user');
  await page.getByTestId('auth-submit-btn').click();
  await expect(page.getByTestId('lobby-page')).toBeVisible();
  expect(registrations).toBe(1); expect(logins).toBe(2);
});

test('prep chapter preference is one authoritative request for room and profile', async ({ page, mock }) => {
  let memberUpdates = 0; let profileUpdates = 0;
  await mock({
    'GET /api/lobby/state': (route) => ok(route, roomLobby),
    'POST /api/lobby/leave': (route) => ok(route, emptyLobby),
    'PATCH /api/lobby/member-prefs': (route) => {
      memberUpdates++;
      const patch = route.request().postDataJSON();
      return ok(route, { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, ...patch },
        profile: { ...profile, learningStartSelections: patch.learningStartSelections } });
    },
    'PATCH /api/auth/profile': (route) => { profileUpdates++; return fail(route); },
  });
  await page.goto('/'); await enterFromStartGate(page);
  await expect(page.getByTestId('prep-room-page')).toBeVisible();
  const settings = await openSettings(page, 'learning');
  const select = settings.getByTestId('settings-english-start-select');
  const second = english.manifest.knowledgeGraph[1]!;
  await select.selectOption(second.nodeId);
  await settings.getByTestId('save-learning-start-btn').click();
  await expect(page.getByTestId('toast-banner-stack')).toContainText('学习起始章节已保存');
  expect(memberUpdates).toBe(1); expect(profileUpdates).toBe(0);
  await closeSettings(page);
  await expect(page.getByTestId('prep-chapter-summary-btn')).toContainText(second.title);
  await page.getByTestId('prep-leave-room-btn').click();
  await expectDirectLobby(page);
  await openSettings(page, 'learning');
  await expect(select).toHaveValue(second.nodeId);
  await expect(select).toBeEnabled();
});

test('idle prep arena preference uses one room command and commits its returned profile', async ({ page, mock }) => {
  let memberUpdates = 0; let profileUpdates = 0;
  const theme = 'event_horizon_observatory';
  await mock({
    'GET /api/lobby/state': (route) => ok(route, roomLobby),
    'PATCH /api/lobby/member-prefs': (route) => {
      memberUpdates++;
      return ok(route, { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, preferredArena: theme },
        profile: { ...profile, preferredArena: theme } });
    },
    'PATCH /api/auth/profile': (route) => { profileUpdates++; return fail(route); },
  });
  await page.goto('/'); await enterFromStartGate(page);
  await expect(page.getByTestId('prep-room-page')).toBeVisible();
  const settings = await openSettings(page, 'display');
  const response = apiResponse(page, '/api/lobby/member-prefs', 'PATCH');
  const arena = settings.getByTestId(`settings-arena-${theme}`);
  await arena.click();
  expect((await response).ok()).toBe(true);
  expect(memberUpdates).toBe(1); expect(profileUpdates).toBe(0);
  await closeSettings(page);
  await openSettings(page, 'display');
  await expect(arena.getByText('已装备', { exact: true })).toBeVisible();
});
