import { type Browser, type Route } from '@playwright/test';
import english from '../../../../content/courses/compiled/english-core-starter.json' with { type: 'json' };
import math from '../../../../content/courses/compiled/math-core-starter.json' with { type: 'json' };

export { english, math };
export const profile = {
  userId: 'audit-user', username: 'audit_user', nickname: '审计样本', emailMasked: null,
  role: 'player', sessionEpoch: 1, onboardingChoice: 'skipped',
  learningStartSelections: { english: english.manifest.knowledgeGraph[0]!.nodeId },
  preferredArena: 'orbital_elevator_port',
  displaySettings: { fullscreen: false, orientation: 'landscape' }, avatarFrameId: null, boardPlaqueId: null,
};
export const me = { profile, rewardPointsBalance: 100, standings: [], activeSeat: null };
export const season = {
  seasonTermId: 'audit-season', label: '审计赛季', startsAtIso: '2026-01-01T00:00:00Z',
  endsAtIso: '2027-01-01T00:00:00Z', rewardsSettled: false,
};
export const emptyLobby = { prepRoom: null, acceptPrompt: null, match: null, selfPrefs: null };
export const roomLobby = {
  prepRoom: {
    roomCode: 'AUDIT123', durationMode: 'standard', queueType: 'casual', sharedSubject: 'english',
    hostUserId: profile.userId, status: 'idle', plannedTotalSeconds: 1800,
    members: [{ userId: profile.userId, nickname: profile.nickname, isHost: true, ready: true,
      avatarFrameId: null, boardPlaqueId: null }],
  },
  acceptPrompt: null, match: null,
  selfPrefs: { subject: 'english', learningStartSelections: profile.learningStartSelections,
    preferredArena: profile.preferredArena, displaySettings: profile.displaySettings },
};
export const dashboard = {
  dueReviews: [], nextRecommendation: null,
  coursePacks: [{ manifest: english.manifest, isActive: true }, { manifest: math.manifest, isActive: true }],
  recentAttempts: [], wrongQuestions: [],
};
export const ok = (route: Route, data: unknown) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(data),
});
export const fail = (route: Route, code = 'AUDIT_FAILURE', status = 503) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify({ error: code }),
});
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
export async function mockUiPage(browser: Browser,
  overrides: Record<string, (route: Route) => Promise<unknown> | unknown> = {}, token: string | null = 'audit-old-token') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((value) => {
    if (value) localStorage.setItem('blc_auth_token_v1', value);
    else localStorage.removeItem('blc_auth_token_v1');
  }, token);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const payloads: Record<string, unknown> = {
    '/api/me': me, '/api/lobby/state': emptyLobby, '/api/seasons/current': season,
    '/api/learning/dashboard': dashboard, '/api/learning/courses': dashboard.coursePacks,
    '/api/matches/history': [],
  };
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname;
    const handler = overrides[`${route.request().method()} ${path}`];
    if (handler) { await handler(route); return; }
    await ok(route, payloads[path] ?? {});
  });
  return { page, context, errors };
}
