import { expect, test, type Page } from '@playwright/test';
import { deferred, emptyLobby, fail, me, mockUiPage, ok, profile, roomLobby } from './support/mockUi.js';

const settleUi = (page: Page) => page.evaluate(() => new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

async function loginForm(page: Page) {
  await page.getByTestId('splash-enter-btn').click();
  await page.getByTestId('auth-tab-login').click();
  await page.getByTestId('auth-username-input').fill('audit_user');
  await page.getByTestId('auth-password-input').fill('audit-password');
  await page.getByTestId('auth-submit-btn').click();
}

test('boot refresh cannot authenticate after another boot request invalidates its session', async ({ browser }) => {
  const gate = deferred();
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/me': async (route) => { await gate.promise; await ok(route, me); },
    'GET /api/lobby/state': (route) => fail(route, 'SESSION_SUPERSEDED', 401),
  });
  try {
    await page.goto('/');
    await expect(page.getByTestId('session-superseded-banner')).toBeVisible();
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/me');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('auth-page')).toBeVisible();
    await expect(page.getByTestId('lobby-page')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('blc_auth_token_v1'))).toBeNull();
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('choosing offline invalidates an in-flight login before token commit', async ({ browser }) => {
  const gate = deferred(); const started = deferred();
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/auth/login': async (route) => {
      started.resolve(); await gate.promise;
      await ok(route, { token: 'audit-late-token', profile, userId: profile.userId, sessionEpoch: 1,
        expiresAtIso: '2027-01-01T00:00:00Z', activeSeat: null });
    },
  }, null);
  try {
    await page.goto('/'); await loginForm(page); await started.promise;
    await page.getByRole('button', { name: '← 返回', exact: true }).click();
    await page.getByTestId('enter-offline-practice-btn').click();
    await expect(page.getByTestId('lobby-page')).toContainText('离线星港领航员');
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/login');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('lobby-page')).toContainText('离线星港领航员');
    expect(await page.evaluate(() => localStorage.getItem('blc_auth_token_v1'))).toBeNull();
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('old-session unauthorized response cannot invalidate a new login', async ({ browser }) => {
  const gate = deferred(); const started = deferred(); let requestToken = '';
  const { page, context, errors } = await mockUiPage(browser, {
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
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    const pending = page.evaluate(async () => {
      const modulePath = '/src/api/httpClient.ts'; const api = await import(modulePath);
      try { await api.httpClient.getLearningDashboard(); } catch { return; }
    });
    await started.promise;
    await page.getByTestId('dock-tab-profile').click();
    await page.getByTestId('explicit-logout-btn').click();
    await expect(page.getByTestId('auth-page')).toBeVisible();
    await loginForm(page); await expect(page.getByTestId('lobby-page')).toBeVisible();
    expect(requestToken).toBe('Bearer audit-old-token');
    gate.resolve(); await pending; await settleUi(page);
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('blc_auth_token_v1'))).toBe('audit-new-token');
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('late room preference response cannot restore a room after leave succeeds', async ({ browser }) => {
  const gate = deferred(); const started = deferred(); let left = false;
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/lobby/state': (route) => ok(route, left ? emptyLobby : roomLobby),
    'PATCH /api/lobby/member-prefs': async (route) => {
      const saved = { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, ...route.request().postDataJSON() } };
      started.resolve(); await gate.promise; await ok(route, saved);
    },
    'POST /api/lobby/leave': (route) => { left = true; return ok(route, emptyLobby); },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('prep-room-page')).toBeVisible();
    await page.getByTestId('self-subject-math').click(); await started.promise;
    await page.getByTestId('prep-leave-room-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/lobby/member-prefs');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('top-room-bar')).toHaveCount(0);
    await expect(page.getByTestId('lobby-resume-prep-btn')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('nickname save stays single-flight and applies the confirmed nickname', async ({ browser }) => {
  const gate = deferred(); const started = deferred(); let requests = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'PATCH /api/auth/profile': async (route) => {
      requests++; const saved = { ...profile, ...route.request().postDataJSON() };
      started.resolve(); await gate.promise; await ok(route, saved);
    },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.getByTestId('dock-tab-profile').click();
    await page.getByRole('button', { name: '改名', exact: true }).click();
    const input = page.getByTestId('profile-page').locator('input[maxlength="24"]');
    await input.fill('Confirmed-Nick');
    await page.getByRole('button', { name: '保存', exact: true }).click(); await started.promise;
    await expect(page.getByRole('button', { name: '保存中…', exact: true })).toBeDisabled();
    await expect(input).toBeDisabled(); expect(requests).toBe(1);
    gate.resolve(); await expect(page.getByTestId('profile-page')).toContainText('Confirmed-Nick');
    await expect(input).toHaveCount(0); expect(requests).toBe(1); expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('fullscreen refusal does not persist fullscreen or claim it was applied', async ({ browser }) => {
  let updates = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'PATCH /api/auth/profile': (route) => { updates++; return ok(route, profile); },
  });
  await page.addInitScript(() => Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true, value: () => Promise.reject(new DOMException('Audit denied', 'NotAllowedError')),
  }));
  try {
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.getByTestId('dock-tab-profile').click();
    await page.getByTestId('display-landscape-fullscreen-btn').click();
    await expect(page.locator('.blc-toast').filter({ hasText: '显示模式未切换' })).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    expect(updates).toBe(0);
    await expect(page.getByTestId('display-landscape-window-btn')).toHaveClass(/blc-btn--primary/);
    await expect(page.locator('.blc-toast').filter({ hasText: '已切换至全屏显示' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('onboarding failed writes retain the current step and both retries can succeed', async ({ browser }) => {
  let current = { ...profile, onboardingChoice: 'unset' }; let failed = true;
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/me': (route) => ok(route, { ...me, profile: current }),
    'PATCH /api/auth/profile': (route) => {
      if (failed) return fail(route);
      current = { ...current, ...route.request().postDataJSON() }; return ok(route, current);
    },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('onboarding-three-choices')).toBeVisible();
    await page.getByTestId('onboarding-opt-skip').click();
    await expect(page.locator('.blc-toast').filter({ hasText: '启航进度尚未确认保存' })).toBeVisible();
    await expect(page.getByTestId('onboarding-three-choices')).toBeVisible();
    failed = false; await page.getByTestId('onboarding-opt-skip').click();
    await expect(page.getByTestId('learning-start-selector')).toBeVisible();
    failed = true; await page.getByTestId('save-learning-start-btn').click();
    await expect(page.locator('.blc-toast').filter({ hasText: '起始章节尚未确认保存' })).toBeVisible();
    await expect(page.getByTestId('learning-start-selector')).toBeVisible();
    failed = false; await page.getByTestId('save-learning-start-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible(); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('arena persistence failure restores the confirmed arena and is visible to the user', async ({ browser }) => {
  const { page, context, errors } = await mockUiPage(browser, {
    'PATCH /api/auth/profile': (route) => fail(route),
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.getByTestId('arena-theme-event_horizon_observatory').click();
    await expect(page.locator('.blc-toast').filter({ hasText: 'AUDIT_FAILURE' })).toBeVisible();
    await expect(page.getByTestId('arena-theme-orbital_elevator_port')).toHaveClass(/blc-pill-btn--active/);
    await expect(page.getByTestId('arena-theme-event_horizon_observatory')).not.toHaveClass(/blc-pill-btn--active/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('successful registration with failed auto-login retries only login', async ({ browser }) => {
  let registrations = 0; let logins = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'POST /api/auth/register': (route) => { registrations++; return ok(route, { profile }); },
    'POST /api/auth/login': (route) => {
      logins++;
      return logins === 1 ? fail(route) : ok(route, {
        token: 'audit-registration-token', profile, userId: profile.userId, sessionEpoch: 1,
        expiresAtIso: '2027-01-01T00:00:00Z', activeSeat: null,
      });
    },
  }, null);
  try {
    await page.goto('/'); await page.getByTestId('splash-enter-btn').click();
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-username-input').fill('audit_user');
    await page.getByTestId('auth-nickname-input').fill('审计样本');
    await page.getByTestId('auth-password-input').fill('audit-password');
    await page.getByTestId('auth-submit-btn').click();
    await expect(page.getByTestId('auth-error-msg')).toContainText('档案已创建，请登录');
    await expect(page.getByTestId('auth-tab-login')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('auth-nickname-input')).toHaveCount(0);
    await expect(page.getByTestId('auth-username-input')).toHaveValue('audit_user');
    await page.getByTestId('auth-submit-btn').click();
    await expect(page.getByTestId('lobby-page')).toBeVisible();
    expect(registrations).toBe(1); expect(logins).toBe(2); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('prep chapter preference is one authoritative request for room and profile', async ({ browser }) => {
  let memberUpdates = 0; let profileUpdates = 0;
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/lobby/state': (route) => ok(route, roomLobby),
    'PATCH /api/lobby/member-prefs': (route) => {
      memberUpdates++;
      const patch = route.request().postDataJSON();
      return ok(route, { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, ...patch },
        profile: { ...profile, learningStartSelections: patch.learningStartSelections } });
    },
    'PATCH /api/auth/profile': (route) => { profileUpdates++; return fail(route); },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('prep-room-page')).toBeVisible();
    const select = page.getByTestId('prep-start-node-select');
    const options = await select.locator('option').evaluateAll((rows) => rows.map((row) => (row as HTMLOptionElement).value));
    await select.selectOption(options[1]!);
    await expect(select).toHaveValue(options[1]!); await expect(select).toBeEnabled();
    expect(memberUpdates).toBe(1); expect(profileUpdates).toBe(0);
    await page.getByTestId('dock-tab-profile').click();
    await page.getByTestId('edit-learning-start-btn').click();
    await expect(page.locator('input[name="english-start-node"]:checked')).toHaveValue(options[1]!);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('idle prep arena preference uses one room command and commits its returned profile', async ({ browser }) => {
  let memberUpdates = 0; let profileUpdates = 0;
  const theme = 'event_horizon_observatory';
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/lobby/state': (route) => ok(route, roomLobby),
    'PATCH /api/lobby/member-prefs': (route) => {
      memberUpdates++;
      return ok(route, { ...roomLobby, selfPrefs: { ...roomLobby.selfPrefs, preferredArena: theme },
        profile: { ...profile, preferredArena: theme } });
    },
    'PATCH /api/auth/profile': (route) => { profileUpdates++; return fail(route); },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('prep-room-page')).toBeVisible();
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/lobby/member-prefs');
    await page.getByTestId(`arena-theme-${theme}`).click(); await response; await settleUi(page);
    expect(memberUpdates).toBe(1); expect(profileUpdates).toBe(0);
    await expect(page.getByTestId(`arena-theme-${theme}`)).toHaveClass(/blc-pill-btn--active/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
