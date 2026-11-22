import { expect, type Page } from '@playwright/test';
import type { DurationMode } from '@pkg/contracts';

type AuthMode = 'login' | 'register';
type Credentials = { username: string; password: string; nickname?: string };
type SettingsTab = 'match' | 'display' | 'learning' | 'account';

export const tacticians = [
  { id: 'tactician_lumina_bell', name: '星汐 · 小铃' },
  { id: 'tactician_europa_fin', name: '冰核 · 小鲸' },
  { id: 'tactician_singularity_mew', name: '奇点 · 小猫' },
] as const;
export const firstEnglishTitle = '情景交际与日常沟通';

const subpages = {
  learning: ['学习中心', 'learning-home-page'],
  encyclopedia: ['藏品图鉴', 'encyclopedia-page'],
  ranking: ['排行榜', 'ranking-page'],
  redemption: ['积分商城', 'redemption-page'],
  profile: ['个人档案', 'profile-page'],
} as const;

const modes = { quick: '超快', standard: '标准', deep: '深度' } as const;

export async function expectBrand(page: Page) {
  const auth = page.getByTestId('auth-page');
  await expect(auth.getByRole('heading', { name: 'SparkField · 灵光之野', exact: true })).toBeVisible();
  await expect(auth).toContainText('S1 · 光锥之外');
}

export async function expectSignedOutStart(page: Page) {
  await expectBrand(page);
  const intent = page.getByRole('navigation', { name: '选择启航入口' });
  const loginButton = intent.getByTestId('auth-tab-login');
  const registerButton = intent.getByTestId('auth-tab-register');
  await expect(intent.getByRole('button')).toHaveCount(2);
  await expect(loginButton).toHaveAccessibleName('账号登录');
  await expect(registerButton).toHaveAccessibleName('注册新账号');
  await expect(page.getByTestId('splash-enter-btn')).toHaveCount(0);
  await expect(page.getByTestId('start-gate-logout-btn')).toHaveCount(0);
  await expect(page.getByTestId('enter-offline-practice-btn')).toHaveCount(0);
  await expect(page.getByTestId('auth-page').locator('form')).toHaveCount(0);
  await expect(page.getByTestId('lobby-page')).toHaveCount(0);
  await expect.poll(async () => {
    const [dock, left, right, title] = await Promise.all([
      intent.boundingBox(), loginButton.boundingBox(), registerButton.boundingBox(),
      page.getByRole('heading', { name: 'SparkField · 灵光之野', exact: true }).boundingBox(),
    ]);
    const viewport = page.viewportSize()!;
    return Boolean(dock && left && right && title &&
      title.x < viewport.width / 4 && title.y < viewport.height / 4 &&
      dock.y > viewport.height * 0.75 && Math.abs(dock.x + dock.width / 2 - viewport.width / 2) <= 2 &&
      left.x < right.x && Math.abs(left.width - right.width) <= 2 && Math.abs(left.y - right.y) <= 2);
  }).toBe(true);
}

export async function expectStartGate(page: Page, nickname: string) {
  await expectBrand(page);
  const plate = page.getByTestId('start-gate-account-plate');
  await expect(plate.getByText(nickname, { exact: true })).toBeVisible();
  await expect(plate.getByRole('img', { name: nickname, exact: true })).toBeVisible();
  const enter = page.getByTestId('splash-enter-btn');
  const logout = page.getByTestId('start-gate-logout-btn');
  await expect(enter).toHaveAccessibleName('开始游戏');
  await expect(logout).toHaveAccessibleName('退出登录');
  await expect(page.getByTestId('auth-tab-login')).toHaveCount(0);
  await expect(page.getByTestId('auth-tab-register')).toHaveCount(0);
  await expect(page.getByTestId('enter-offline-practice-btn')).toHaveCount(0);
  await expect(page.getByTestId('lobby-nav-rail')).toHaveCount(0);
  await expect(page.getByTestId('persistent-stage-canvas')).toHaveAttribute('data-scene-mode', 'splash');
  await expect.poll(async () => {
    const [action, exit] = await Promise.all([enter.boundingBox(), logout.boundingBox()]);
    const viewport = page.viewportSize()!;
    return Boolean(action && exit && action.y > viewport.height * 0.75 &&
      Math.abs(action.x + action.width / 2 - viewport.width / 2) <= 2 &&
      exit.x > viewport.width * 0.75 && exit.y < viewport.height / 4);
  }).toBe(true);
}

export async function enterFromStartGate(page: Page) {
  await page.getByTestId('splash-enter-btn').click();
  await expect(page.getByTestId('auth-page')).toHaveCount(0);
}

export async function openAuth(page: Page, mode: AuthMode) {
  await page.getByTestId(`auth-tab-${mode}`).click();
  await expect(page.getByTestId('auth-page').locator('form')).toBeVisible();
}

export async function fillAuth(page: Page, { username, password, nickname }: Credentials) {
  await page.getByTestId('auth-username-input').fill(username);
  if (nickname !== undefined) await page.getByTestId('auth-nickname-input').fill(nickname);
  await page.getByTestId('auth-password-input').fill(password);
}

export async function verifyOptionalEmail(page: Page) {
  const email = page.getByTestId('auth-email-input');
  await expect(email).toBeHidden();
  await page.getByTestId('toggle-optional-email-btn').click();
  await expect(email).toBeVisible();
  await email.fill('pilot@example.test');
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await expect(email).toBeHidden();
  await page.getByTestId('toggle-optional-email-btn').click();
  await expect(email).toHaveValue('');
  await page.getByRole('button', { name: '收起', exact: true }).click();
}

async function submitAuth(page: Page, mode: AuthMode, credentials: Credentials) {
  await openAuth(page, mode);
  await fillAuth(page, mode === 'login' ? { username: credentials.username, password: credentials.password } : credentials);
  await page.getByTestId('auth-submit-btn').click();
}

export const login = (page: Page, credentials: Credentials) => submitAuth(page, 'login', credentials);
export const register = (page: Page, credentials: Credentials & { nickname: string }) => submitAuth(page, 'register', credentials);

export async function expectDirectLobby(page: Page) {
  await expect(page.getByTestId('lobby-nav-rail')).toBeVisible();
  await expect(page.getByTestId('persistent-stage-canvas')).toHaveAttribute('data-scene-mode', 'lobby');
  await expect(page.getByTestId('onboarding-modal')).toHaveCount(0);
  await expect(page.getByTestId('settings-modal')).toHaveCount(0);
  await expect(page.getByTestId('learning-start-selector')).toHaveCount(0);
}

export async function skipOnboarding(page: Page) {
  await page.getByTestId('onboarding-opt-skip').click();
  await expectDirectLobby(page);
}

export async function openSettings(page: Page, tab: SettingsTab, inMatch = false) {
  const gear = page.getByTestId(inMatch ? 'open-inmatch-settings-btn' : 'open-settings-btn');
  await expect(gear).toHaveCount(1);
  await gear.click();
  const settings = page.getByRole('dialog', { name: '系统设置' });
  await settings.getByTestId(`settings-tab-${tab}`).click();
  return settings;
}

export async function closeSettings(page: Page) {
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.getByTestId('settings-modal')).toHaveCount(0);
}

export async function openModeOverlay(page: Page, mode: DurationMode) {
  await page.getByTestId('lobby-mode-capsule').click();
  const overlay = page.getByRole('dialog', { name: '选择对局模式' });
  const card = overlay.getByTestId(`mode-card-${mode}`);
  if (!(await card.getAttribute('class'))?.includes('sf-emblem-card--selected')) await card.click();
  await expect(overlay.getByTestId('mode-overlay-confirm-btn')).toContainText(`进入 ${modes[mode]} 备战房`);
  return overlay;
}

export async function enterPrepRoom(page: Page, mode: DurationMode) {
  const overlay = await openModeOverlay(page, mode);
  await overlay.getByTestId('mode-overlay-confirm-btn').click();
  const prep = page.getByTestId('prep-room-page');
  await expect(prep).toBeVisible();
  return prep;
}

export async function startOfflineMatch(page: Page, mode: DurationMode) {
  const prep = await enterPrepRoom(page, mode);
  await prep.getByTestId('prep-primary-action-btn').click();
  const hud = page.getByTestId('match-hud-overlay');
  await expect(hud).toBeVisible();
  return hud;
}

export async function exitOfflineMatch(page: Page) {
  const settings = await openSettings(page, 'match', true);
  await settings.getByTestId('quit-offline-match-btn').click();
  await expect(settings).toHaveCount(0);
}

export async function openSubpage(page: Page, section: keyof typeof subpages) {
  const [label, testId] = subpages[section];
  await page.getByRole('navigation', { name: '主大厅功能导航' }).getByRole('button', { name: label, exact: true }).click();
  const shell = page.getByTestId(testId);
  await expect(shell.getByTestId('subpage-back-btn')).toBeVisible();
  return shell;
}

export async function backToLobby(page: Page) {
  await page.getByTestId('subpage-back-btn').click();
  await expectDirectLobby(page);
}

export const localToken = (page: Page) => page.evaluate(() => localStorage.getItem('blc_auth_token_v1'));
export const settleUi = (page: Page) => page.evaluate(() => new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
export const apiResponse = (page: Page, path: string, method = 'GET') => page.waitForResponse((response) =>
  new URL(response.url()).pathname === path && response.request().method() === method);

export async function visitLobby(page: Page) {
  await page.goto('/');
  await enterFromStartGate(page);
  await expectDirectLobby(page);
}

export async function openStudy(page: Page) {
  await page.getByTestId('direct-standalone-study-btn').click();
  await expect(page.getByTestId('standalone-learning-overlay')).toBeVisible();
}
