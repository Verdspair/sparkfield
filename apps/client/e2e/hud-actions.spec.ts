import { expect, test, type Page } from '@playwright/test';
import { createGame } from '@pkg/game-core';
import { english } from './support/mockUi.js';

const game = createGame('quick', 4);
const home = game.seats[0]!;
const baseSnapshot = {
  roomId: 'hud-room', matchId: 'hud-match', mode: 'quick', queueType: 'solo', phase: 'strategy', phaseIndex: 3,
  deadlineEpochMs: Date.now() + 60_000, remainingSeconds: 50, round: 1, nodeIndex: 0,
  versionLock: { seasonTermId: 'test', gameSetVersion: 'v1', coursePackVersion: 'v1' }, seatId: home.id,
  self: { ...home, inventoryItems: ['C_SWORD'], gold: 100 },
  seats: game.seats.map((seat) => ({ seatId: seat.id, nickname: seat.id, level: seat.level,
    units: seat.units, victoryPoints: 0, chosenAugments: [] })),
  learning: null, resourceSettlement: null, summary: null, completed: false, failure: null,
};

async function mountHud(page: Page, overrides: object = {}) {
  await page.route('**/src/store/appStore.tsx', (route) => route.fulfill({ contentType: 'application/javascript',
    body: 'export function useAppStore() { return window.__hudStore; }' }));
  await page.route('**/hud-audit', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="hud-root"></div></body></html>' }));
  await page.goto('/hud-audit');
  await page.evaluate(async ({ snapshot, overrides }) => {
    const w = window as any;
    const refreshPath = '/@react-refresh';
    const refresh = await import(refreshPath);
    refresh.default.injectIntoGlobalHook(window); w.$RefreshReg$ = () => {}; w.$RefreshSig$ = () => (value: unknown) => value;
    w.__vite_plugin_react_preamble_installed__ = true;
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const hudPath = '/src/hud/MatchHudOverlay.tsx';
    const React = (await import(reactPath)).default;
    const { createRoot } = (await import(domPath)).default;
    const { MatchHudOverlay } = await import(hudPath);
    w.__commands = []; w.__toasts = [];
    w.__hudStore = {
      matchSnapshot: { ...snapshot, ...overrides }, matchConnectionState: 'connected', matchActionPending: false,
      combatTelemetry: [], scoutedSeatId: null, inspectedUnitId: null, draggingUnitId: null, overSellDropzone: false,
      isOfflineSandboxMatch: true, sendMatchCommand: (command: unknown) => { w.__commands.push(command); return Promise.resolve(); },
      sendMatchLearningSubmit: () => Promise.resolve({ ok: true, feedback: { isCorrect: false, explanationMd: '本题反馈已保留' } }),
      sendMatchLearningAdvance: () => Promise.resolve({ ok: true }), skipOfflinePhaseWait: () => {}, scoutMatchSeat: () => {},
      clearInspectedUnit: () => { w.__hudStore = { ...w.__hudStore, inspectedUnitId: null }; w.__renderHud(); },
      setInspectedUnitManual: (id: string | null) => { w.__hudStore = { ...w.__hudStore, inspectedUnitId: id }; w.__renderHud(); },
      exitMatchToLobby: () => Promise.resolve(), getStageEngine: () => null, audioBus: { emit: () => {} },
      profile: null, patchUserProfile: () => Promise.resolve(null), pushToast: (text: string) => w.__toasts.push(text),
    };
    const root = createRoot(document.getElementById('hud-root')!);
    w.__renderHud = () => root.render(React.createElement(MatchHudOverlay));
    w.__renderHud();
  }, { snapshot: baseSnapshot, overrides });
  await expect(page.getByTestId('match-hud-overlay')).toBeVisible();
}

async function updateHud(page: Page, snapshotPatch: object, storePatch: object = {}) {
  await page.evaluate(({ snapshotPatch, storePatch }) => {
    const w = window as any;
    w.__hudStore = { ...w.__hudStore, ...storePatch, matchSnapshot: { ...w.__hudStore.matchSnapshot, ...snapshotPatch } };
    w.__renderHud();
  }, { snapshotPatch, storePatch });
}

test('arming equipment does not target an old inspected unit or survive a phase change', async ({ page }) => {
  await mountHud(page);
  await page.getByTestId('hud-left-items-tab').click();
  await updateHud(page, {}, { inspectedUnitId: home.units[0]!.instanceId });
  await page.getByTestId('inventory-item-0').click();
  expect(await page.evaluate(() => (window as any).__commands)).toEqual([]);
  await updateHud(page, { phase: 'battle', phaseIndex: 4 });
  await updateHud(page, { phase: 'strategy', phaseIndex: 9 }, { inspectedUnitId: home.units[0]!.instanceId });
  expect(await page.evaluate(() => (window as any).__commands)).toEqual([]);
  await page.getByTestId('inventory-item-0').click();
  await page.locator('.blc-quick-target-box button').first().click();
  expect(await page.evaluate(() => (window as any).__commands)).toEqual([{ type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: home.units[0]!.instanceId }]);
});

test('max level uses the mode cap and a pending action blocks old shop and planner clicks', async ({ page }) => {
  await mountHud(page, { self: { ...baseSnapshot.self, level: 8 } });
  await expect(page.getByTestId('buy-xp-btn')).toBeDisabled();
  await updateHud(page, {}, { matchActionPending: true });
  await expect(page.getByTestId('refresh-shop-btn')).toBeDisabled();
  await expect(page.getByTestId('shop-card-slot-0')).toBeDisabled();
  await updateHud(page, {}, { matchActionPending: false });
  await expect(page.getByTestId('refresh-shop-btn')).toBeEnabled();
});

test('iron anvil is hidden in strategy and augment events, but offered in anvil events', async ({ page }) => {
  const anvil = { instanceId: 'test-anvil', kind: 'component', options: ['C_SWORD', 'C_BOW', 'C_ROD'] };
  await mountHud(page, { self: { ...baseSnapshot.self, anvils: [anvil] } });
  await expect(page.getByTestId('choice-event-modal')).toHaveCount(0);
  await updateHud(page, { phase: 'choice', phaseIndex: 8 });
  await expect(page.getByTestId('choice-event-modal')).toHaveCount(0);
  await updateHud(page, { phase: 'choice', phaseIndex: 17 });
  await expect(page.getByTestId('pick-anvil-0')).toBeVisible();
});

test('submitted feedback stays visible when the authoritative snapshot advances to the next step', async ({ page }) => {
  const question = english.items.find((item) => item.stepRole === 'practice' && item.questionType === 'single_choice')!;
  const learning = { nodeIndex: 0, currentStep: 'practice', complete: false, clientQuestions: [question],
    steps: ['material', 'practice', 'resource_check', 'remediation', 'verification'].map((kind) => ({
      kind, active: true, plannedSeconds: 60, questionIds: kind === 'practice' ? [question.questionId] : [], materials: [], corrections: [],
    })), submittedQuestionIds: [], feedback: {} };
  await mountHud(page, { phase: 'learning', phaseIndex: 1, learning });
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await updateHud(page, { learning: { ...learning, currentStep: 'resource_check', clientQuestions: [],
    submittedQuestionIds: [question.questionId], feedback: { [question.questionId]: { isCorrect: false, explanationMd: '本题反馈已保留' } } } });
  await expect(page.getByTestId('question-feedback-box')).toContainText('本题反馈已保留');
  await page.getByTestId('advance-step-btn').click();
  await expect(page.getByTestId('question-step-card')).toHaveAttribute('data-step-kind', 'resource_check');
});

test('a rejected learning action restores answer controls and reports the failure once', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const question = english.items.find((item) => item.stepRole === 'practice' && item.questionType === 'single_choice')!;
  const learning = { nodeIndex: 0, currentStep: 'practice', complete: false, clientQuestions: [question],
    steps: [{ kind: 'practice', active: true, plannedSeconds: 60, questionIds: [question.questionId], materials: [], corrections: [] }],
    submittedQuestionIds: [], feedback: {} };
  await mountHud(page, { phase: 'learning', phaseIndex: 1, learning });
  await page.evaluate(() => { (window as any).__hudStore.sendMatchLearningSubmit = () => Promise.reject(new Error('AUDIT_LEARNING_REJECTED')); });
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await expect(page.getByTestId('submit-answer-btn')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__toasts)).toEqual(['AUDIT_LEARNING_REJECTED']);
  expect(errors).toEqual([]);
});

test('local settings, codex, damage tab, and quit remain usable while disconnected or pending', async ({ page }) => {
  await mountHud(page);
  await updateHud(page, {}, { matchConnectionState: 'disconnected', matchActionPending: true });
  await expect(page.getByTestId('refresh-shop-btn')).toBeDisabled();
  await expect(page.getByTestId('shop-card-slot-0')).toBeDisabled();
  await page.getByTestId('hud-right-damage-tab').click();
  await expect(page.getByTestId('hud-damage-panel')).toBeVisible();
  await page.getByTestId('open-inmatch-codex-btn').click();
  await expect(page.getByTestId('inmatch-codex-modal')).toBeVisible();
  await page.getByTestId('inmatch-codex-modal').getByRole('button', { name: '关闭' }).click();
  await page.getByTestId('open-inmatch-settings-btn').click();
  await expect(page.getByTestId('inmatch-settings-modal')).toBeVisible();
  await expect(page.getByTestId('quit-offline-match-btn')).toBeEnabled();
});
