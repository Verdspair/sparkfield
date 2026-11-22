import { expect, test as base, type Route } from '@playwright/test';
import english from '../../../../content/courses/compiled/english-core-starter.json' with { type: 'json' };
import math from '../../../../content/courses/compiled/math-core-starter.json' with { type: 'json' };

export { english, math };
export const profile = {
  userId: 'audit-user', username: 'audit_user', nickname: '审计样本', emailMasked: null,
  role: 'player', sessionEpoch: 1, onboardingChoice: 'skipped',
  learningStartSelections: { english: english.manifest.knowledgeGraph[0]!.nodeId },
  preferredArena: 'orbital_elevator_port', preferredTacticianId: 'tactician_lumina_bell',
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
      tacticianId: profile.preferredTacticianId, avatarFrameId: null, boardPlaqueId: null }],
  },
  acceptPrompt: null, match: null,
  selfPrefs: { subject: 'english', learningStartSelections: profile.learningStartSelections,
    preferredArena: profile.preferredArena, preferredTacticianId: profile.preferredTacticianId, displaySettings: profile.displaySettings },
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
type RouteHandlers = Record<string, (route: Route) => unknown>;

export const test = base.extend<{ mock: (handlers?: RouteHandlers, token?: string | null) => Promise<void> }>({
  mock: async ({ page, context }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    await use(async (handlers = {}, token = 'audit-old-token') => {
      await context.addInitScript((value) => {
        if (sessionStorage.getItem('sparkfield.audit.initialized')) return;
        sessionStorage.setItem('sparkfield.audit.initialized', 'true');
        if (value !== null) localStorage.setItem('blc_auth_token_v1', value);
      }, token);
      const payloads: Record<string, unknown> = {
        'GET /api/me': me,
        'GET /api/lobby/state': emptyLobby,
        'GET /api/lobby/communication': [],
        'GET /api/seasons/current': season,
        'GET /api/learning/dashboard': dashboard,
        'GET /api/learning/courses': dashboard.coursePacks,
        'GET /api/matches/history': [],
        'POST /api/auth/logout': { ok: true },
      };
      await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
        const request = route.request();
        const key = `${request.method()} ${new URL(request.url()).pathname}`;
        if (handlers[key]) await handlers[key](route);
        else if (key in payloads) await ok(route, payloads[key]);
        else await fail(route, `UNMOCKED ${key}`, 404);
      });
    });
    expect(errors).toEqual([]);
  },
});
