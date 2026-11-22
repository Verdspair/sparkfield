import { expect, type Page } from '@playwright/test';
import type { GameCommand } from '@pkg/contracts';
import { createGame } from '@pkg/game-core';
import type { CommandResultAck, MatchRoomSnapshot } from '../../src/api/matchSocket.js';
import type { AppStoreValue } from '../../src/store/appStore.js';
import { emptyLobby, profile } from './mockUi.js';

const game = createGame('quick', 4);
export const home = game.seats[0]!;
export const baseSnapshot: MatchRoomSnapshot = {
  roomId: 'hud-room', matchId: 'hud-match', mode: 'quick', queueType: 'solo', phase: 'strategy', phaseIndex: 3,
  deadlineEpochMs: 0, remainingSeconds: 50, round: 1, nodeIndex: 0,
  versionLock: { seasonTermId: 'test', gameSetVersion: 'v1', coursePackVersion: 'v1' }, seatId: home.id,
  self: { ...home, inventoryItems: ['C_SWORD'], gold: 100, learningChargeCents: 37 },
  seats: game.seats.map((seat) => ({ seatId: seat.id, nickname: seat.id, level: seat.level,
    units: seat.units, victoryPoints: 0, chosenAugments: [] })),
  learning: null, resourceSettlement: null, summary: null, completed: false, failure: null,
};

type HudState = Pick<AppStoreValue,
  'matchConnectionState' | 'matchActionPending' | 'inspectedUnitId' | 'scoutedSeatId' |
  'isOfflineSandboxMatch' | 'shopDockPosition' | 'shopCollapsed' | 'inActiveMatch' |
  'settingsModalOpen' | 'settingsInitialTab'
>;

type HudStore = HudState & Pick<AppStoreValue,
  'lobbyState' | 'authMode' | 'openSettings' | 'closeSettings' | 'setShopDockPosition' |
  'setShopCollapsed' | 'matchSnapshot' | 'combatTelemetry' | 'draggingUnitId' | 'overSellDropzone' |
  'sendMatchCommand' | 'sendMatchLearningSubmit' | 'sendMatchLearningAdvance' | 'skipOfflinePhaseWait' |
  'scoutMatchSeat' | 'clearInspectedUnit' | 'setInspectedUnitManual' | 'exitMatchToLobby' |
  'getStageEngine' | 'profile' | 'patchUserProfile' | 'pushToast'
> & { audioBus: Pick<AppStoreValue['audioBus'], 'emit'> };

type HudWindow = Window & {
  $RefreshReg$: () => void;
  $RefreshSig$: () => (value: unknown) => unknown;
  __vite_plugin_react_preamble_installed__: boolean;
  __hud: {
    store: HudStore;
    render: () => void;
    effects: { commands: GameCommand[]; toasts: string[]; quitCount: number };
  };
};

export async function mountHud(page: Page, overrides: Partial<MatchRoomSnapshot> = {}) {
  await page.route((url) => url.pathname === '/src/store/appStore.tsx', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'export function useAppStore() { return window.__hud.store; }',
  }));
  await page.route((url) => url.pathname === '/hud-audit', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body><div id="hud-root"></div></body></html>',
  }));
  await page.goto('/hud-audit');
  const snapshot = { ...baseSnapshot, deadlineEpochMs: Date.now() + 60_000, ...overrides };
  await page.evaluate(async ({ snapshot, lobbyState, profile }) => {
    const w = window as unknown as HudWindow;
    const refreshPath = '/@react-refresh';
    const refresh = await import(refreshPath);
    refresh.default.injectIntoGlobalHook(window);
    w.$RefreshReg$ = () => {};
    w.$RefreshSig$ = () => (value: unknown) => value;
    w.__vite_plugin_react_preamble_installed__ = true;
    const tokenStyles = '/src/styles/tokens.css?import';
    const appStyles = '/src/styles/app.css?import';
    await import(tokenStyles);
    await import(appStyles);
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const hudPath = '/src/hud/MatchHudOverlay.tsx';
    const settingsPath = '/src/components/SettingsModal.tsx';
    const React = (await import(reactPath)).default;
    const { createRoot } = (await import(domPath)).default;
    const { MatchHudOverlay } = await import(hudPath);
    const { SettingsModal } = await import(settingsPath);
    const root = createRoot(document.getElementById('hud-root')!);
    const setLocal = (patch: Partial<HudStore>) => {
      w.__hud.store = { ...w.__hud.store, ...patch };
      w.__hud.render();
    };
    w.__hud = {
      effects: { commands: [], toasts: [], quitCount: 0 },
      render: () => root.render(React.createElement(React.Fragment, null,
        React.createElement(MatchHudOverlay), React.createElement(SettingsModal))),
      store: {
        lobbyState, authMode: 'authenticated', inActiveMatch: true,
        settingsModalOpen: false, settingsInitialTab: 'match', shopDockPosition: 'bottom', shopCollapsed: false,
        openSettings: (tab = 'match') => setLocal({ settingsModalOpen: true, settingsInitialTab: tab }),
        closeSettings: () => setLocal({ settingsModalOpen: false }),
        setShopDockPosition: (position) => setLocal({ shopDockPosition: position }),
        setShopCollapsed: (collapsed) => setLocal({ shopCollapsed: collapsed }),
        matchSnapshot: snapshot, matchConnectionState: 'connected', matchActionPending: false,
        combatTelemetry: [], scoutedSeatId: null, inspectedUnitId: null, draggingUnitId: null, overSellDropzone: false,
        isOfflineSandboxMatch: true, sendMatchCommand: (command) => { w.__hud.effects.commands.push(command); },
        sendMatchLearningSubmit: async () => ({ ok: true, feedback: { isCorrect: false, explanationMd: '本题反馈已保留' } }),
        sendMatchLearningAdvance: async () => ({ ok: true }), skipOfflinePhaseWait: () => {},
        scoutMatchSeat: (seatId) => setLocal({ scoutedSeatId: seatId }),
        clearInspectedUnit: () => setLocal({ inspectedUnitId: null }),
        setInspectedUnitManual: (unitId) => setLocal({ inspectedUnitId: unitId }),
        exitMatchToLobby: async () => {
          w.__hud.effects.quitCount++;
          setLocal({ matchSnapshot: null, inActiveMatch: false, isOfflineSandboxMatch: false });
        },
        getStageEngine: () => null, audioBus: { emit: () => {} },
        profile, patchUserProfile: async () => null, pushToast: (text) => { w.__hud.effects.toasts.push(text); },
      },
    };
    w.__hud.render();
  }, { snapshot, lobbyState: emptyLobby, profile: profile as HudStore['profile'] });
  await expect(page.getByTestId('match-hud-overlay')).toBeVisible();
}

export async function updateHud(page: Page, snapshotPatch: Partial<MatchRoomSnapshot>, storePatch: Partial<HudState> = {}) {
  await page.evaluate(({ snapshotPatch, storePatch }) => {
    const hud = (window as unknown as HudWindow).__hud;
    const snapshot = hud.store.matchSnapshot;
    if (!snapshot) throw new Error('No mounted HUD snapshot');
    hud.store = { ...hud.store, ...storePatch, matchSnapshot: { ...snapshot, ...snapshotPatch } };
    hud.render();
  }, { snapshotPatch, storePatch });
}

export const readHudEffects = (page: Page) => page.evaluate(() => (window as unknown as HudWindow).__hud.effects);

export async function rejectHudLearningSubmit(page: Page, message: string) {
  await page.evaluate((reason) => {
    (window as unknown as HudWindow).__hud.store.sendMatchLearningSubmit = (): Promise<CommandResultAck> => Promise.reject(new Error(reason));
  }, message);
}
