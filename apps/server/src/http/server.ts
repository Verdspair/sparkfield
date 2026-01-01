import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifyServerOptions, type HTTPMethods, type RouteHandlerMethod } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { z, ZodError } from 'zod';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArenaThemeIdSchema, CommunicationClientSendSchema, CoursePackSchema, DurationModeSchema, MODE_BUDGETS,
  QuestionIssueReportSchema, QueueTypeSchema, RedeemRequestSchema, SubjectIdSchema, UserProfileSchema } from '@pkg/contracts';
import { toClientQuestionView } from '@pkg/learning-core';
import { compileCoursePack, serializeCoursePackToAuthoring, type CompileCoursePackInput } from '@pkg/pack-compiler';
import type { AppDatabase } from '../db/client.js';
import { ServiceError } from '../db/errors.js';
import { activateCoursePackVersion, getCoursePack, getPrivateFsrsCards, publishCoursePack,
  queryAnonymousCohortSubjectErrorRates } from '../db/repositories.js';
import { AuthService, hashPassword, verifyPassword, type AuthenticatedSession } from '../auth/authService.js';
import { RankingService } from '../ranking/rankingService.js';
import type { Transaction } from 'kysely';
import type { Database } from '../db/schema.js';
import * as defaultRewards from '../rewards/rewardsService.js';
import type { LobbyService } from '../lobby/lobbyService.js';
import { LearningSubmissionSchema, type LearningService } from '../learning/learningService.js';

export const SESSION_COOKIE = 'blc_session';
export interface HttpServices {
  db: AppDatabase; auth: AuthService; ranking: RankingService; learning: LearningService;
  rewards?: typeof defaultRewards;
  lobby?: Pick<LobbyService, 'enterMode' | 'joinCode' | 'getState' | 'leaveRoom' | 'updateSettings' | 'updateMemberPrefs'
    | 'prepareMemberPrefs' | 'start' | 'cancelQueue' | 'acceptMatch' | 'returnToPrep' | 'sendCommunication' | 'getCommunication' | 'setBlocked'>;
  contentRoot?: string;
  matches?: { getActiveSeat(userId: string): unknown | Promise<unknown>; canReturn(userId: string): boolean | Promise<boolean> };
}
export interface HttpOptions {
  cookieSecure?: boolean;
  corsOrigins?: string[];
}
const IdSchema = z.string().min(1).max(256);
const SettingsSchema = z.object({ durationMode: DurationModeSchema.optional(), queueType: QueueTypeSchema.optional(), sharedSubject: SubjectIdSchema.optional() }).strict();
const LearningStartSchema = z.partialRecord(SubjectIdSchema, z.string().min(1).max(128));
const V1DisplaySchema = z.object({ fullscreen: z.boolean(), orientation: z.literal('landscape') }).strict();
const ProfilePatchSchema = z.object({ nickname: z.string().trim().min(1).max(24).optional(),
  onboardingChoice: z.enum(['unset', 'cards', 'micro_match', 'skipped']).optional(),
  learningStartSelections: LearningStartSchema.optional(), preferredArena: ArenaThemeIdSchema.optional(), displaySettings: V1DisplaySchema.optional() }).strict();
const MemberPrefsSchema = z.object({ ready: z.boolean().optional(), subject: SubjectIdSchema.optional(),
  learningStartSelections: LearningStartSchema.optional(),
  preferredArena: ArenaThemeIdSchema.optional(), displaySettings: V1DisplaySchema.optional() }).strict();
const SourceSchema = z.object({ file: z.string().min(1).max(200), text: z.string().max(2_000_000) }).strict();
const CompileSchema = z.object({ meta: z.unknown(), csvSources: z.array(SourceSchema).max(20).optional(),
  mdSources: z.array(SourceSchema).max(20).optional(), metaSourceName: z.string().max(200).optional(), createdAtIso: z.string().datetime().optional() }).strict();
const StringQuery = z.object({ seasonTermId: IdSchema.optional(), limit: z.coerce.number().int().min(1).max(1000).optional() });

export function requestSessionToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (header !== undefined) {
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match) throw new ServiceError('SESSION_INVALID');
    return match[1]!;
  }
  const token = request.cookies[SESSION_COOKIE];
  if (!token) throw new ServiceError('SESSION_REQUIRED');
  return token;
}
function borrowTransaction(tx: Transaction<Database>): AppDatabase {
  return new Proxy(tx, {
    get(target, key) {
      if (key === 'transaction') return () => ({ execute: <T>(run: (inner: Transaction<Database>) => Promise<T>) => run(tx) });
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
function errorStatus(code: string): number {
  if (/^(SESSION_|INVALID_CREDENTIALS)/.test(code)) return 401;
  if (/FORBIDDEN|HOST_ONLY|NOT_HOST|NOT_MEMBER|BLOCKED|IDENTITY_VERIFICATION/.test(code)) return 403;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/RATE_LIMIT/.test(code)) return 429;
  if (/INVALID_|UNKNOWN_|REQUIRED|MISMATCH|FORBIDDEN_HINT|QUESTION_NOT_IN|SCORED_QUESTION_HINT/.test(code)) return 400;
  return 409;
}

export async function registerHttpRoutes(app: FastifyInstance, services: HttpServices, options: HttpOptions = {}): Promise<void> {
  const { db, auth, ranking, learning } = services;
  const aliases = (method: HTTPMethods, paths: string[], handler: RouteHandlerMethod, bodyLimit?: number) => {
    for (const url of paths) app.route({ method, url, handler, ...(bodyLimit === undefined ? {} : { bodyLimit }) });
  };
  const rewards = services.rewards ?? defaultRewards;
  const secureCookie = options.cookieSecure ?? process.env.NODE_ENV === 'production';
  const origins = options.corsOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'];
  const contentRoot = services.contentRoot ?? fileURLToPath(new URL('../../../../content/', import.meta.url));
  await app.register(cookie);
  await app.register(cors, { origin: origins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'] });
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.headers.authorization) return;
    const origin = request.headers.origin;
    if (!origin) return; 
    const sameOrigin = `${request.protocol}://${request.headers.host}`;
    if (origin !== sameOrigin && !origins.includes(origin)) throw new ServiceError('FORBIDDEN_ORIGIN');
  });
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: error.issues.map(({ path, message }) => ({ path, message })) });
    if (error instanceof ServiceError) return reply.code(errorStatus(error.code)).send({ error: error.code });
    const native = error as { code?: string; statusCode?: number };
    if (native.code === '23505') return reply.code(409).send({ error: 'ALREADY_EXISTS' });
    if (native.code === '23503') return reply.code(409).send({ error: 'REFERENCED_RECORD_NOT_FOUND' });
    if (native.code === '23514' || native.code === '22P02') return reply.code(400).send({ error: 'INVALID_DATA' });
    if (native.statusCode && native.statusCode >= 400 && native.statusCode < 500) return reply.code(native.statusCode).send({ error: 'INVALID_REQUEST' });
    request.log.error({ err: error }, 'HTTP request failed');
    return reply.code(500).send({ error: 'INTERNAL_ERROR', requestId: request.id });
  });
  const authenticate = (request: FastifyRequest) => auth.authenticate(requestSessionToken(request));
  const write = <T>(request: FastifyRequest, command: (session: AuthenticatedSession, tx: Transaction<Database>) => Promise<T> | T) =>
    auth.withAuthenticatedSession(requestSessionToken(request), command);
  const requireAdmin = (session: AuthenticatedSession) => { if (session.profile.role !== 'admin') throw new ServiceError('FORBIDDEN'); };
  const requireEditor = (session: AuthenticatedSession) => { if (!['editor', 'admin'].includes(session.profile.role)) throw new ServiceError('FORBIDDEN'); };
  const lobby = () => { if (!services.lobby) throw new ServiceError('LOBBY_UNAVAILABLE'); return services.lobby; };
  const currentSeason = async () => {
    const row = await db.selectFrom('season_terms').selectAll().where('is_active', '=', true).executeTakeFirst();
    if (!row) throw new ServiceError('SEASON_NOT_FOUND');
    return { seasonTermId: row.id, label: row.label, startsAtIso: row.starts_at.toISOString(), endsAtIso: row.ends_at.toISOString(), rewardsSettled: row.rewards_settled };
  };
  const setLoginCookie = (reply: FastifyReply, token: string, expiresAt: string) => reply.setCookie(SESSION_COOKIE, token,
    { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', expires: new Date(expiresAt) });
  const attempts = new Map<string, { count: number; until: number }>();
  const throttleAuth = (request: FastifyRequest) => {
    const key = request.ip; const now = Date.now(); let entry = attempts.get(key);
    if (!entry || entry.until <= now) { entry = { count: 0, until: now + 60_000 }; attempts.set(key, entry); }
    if (++entry.count > 20) throw new ServiceError('RATE_LIMIT_AUTH');
    if (attempts.size > 10_000) for (const [ip, old] of attempts) if (old.until <= now) attempts.delete(ip);
  };

  app.get('/health', async () => ({ ok: true }));
  app.get('/api/health', async () => { await sql`select 1`.execute(db); return { ok: true }; });
  app.get('/api/config', async () => ({ modeBudgets: MODE_BUDGETS, communicationUiDeferred: true, audioDeferred: true }));
  app.post('/api/auth/register', async (request, reply) => {
    throttleAuth(request); const profile = await auth.register(request.body); return reply.code(201).send({ profile });
  });
  app.post('/api/auth/login', async (request, reply) => {
    throttleAuth(request); const result = await auth.login(request.body); setLoginCookie(reply, result.token, result.expiresAtIso); return result;
  });
  app.get('/api/auth/me', async (request) => authenticate(request));
  app.post('/api/auth/logout', async (request, reply) => {
    const token = requestSessionToken(request); await auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: secureCookie, sameSite: 'lax' }); return { ok: true };
  });
  aliases('PATCH', ['/api/me/profile', '/api/auth/profile'], async (request) => auth.updateProfile(requestSessionToken(request), ProfilePatchSchema.parse(request.body)));
  app.get('/api/me', async (request) => {
    const session = await authenticate(request); const season = await currentSeason();
    const [balance, standings] = await Promise.all([rewards.getRewardPointsBalance(db, session.userId),
      Promise.all((['quick', 'standard', 'deep'] as const).map((mode) => ranking.getStanding(season.seasonTermId, mode, session.userId)))]);
    return { profile: session.profile, rewardPointsBalance: balance, standings, activeSeat: await auth.getActiveSeat(requestSessionToken(request)) };
  });
  app.post('/api/me/password', async (request, reply) => {
    const data = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(6).max(128) }).strict().parse(request.body);
    const nextHash = await hashPassword(data.newPassword);
    await write(request, async (session, tx) => {
      const user = await tx.selectFrom('users').select('password_hash').where('id', '=', session.userId).executeTakeFirstOrThrow();
      if (!await verifyPassword(data.currentPassword, user.password_hash)) throw new ServiceError('INVALID_CREDENTIALS');
      await tx.updateTable('users').set({ password_hash: nextHash, session_epoch: sql<number>`session_epoch + 1` }).where('id', '=', session.userId).execute();
    });
    reply.clearCookie(SESSION_COOKIE, { path: '/' }); return { ok: true, loginRequired: true };
  });
  app.get('/api/seasons/current', async (request) => { await authenticate(request); return currentSeason(); });
  aliases('GET', ['/api/ranking/:mode', '/api/rankings/:mode'], async (request) => {
    const session = await authenticate(request); const { mode } = z.object({ mode: DurationModeSchema }).parse(request.params);
    const query = StringQuery.parse(request.query); const seasonTerm = await currentSeason();
    const seasonId = query.seasonTermId ?? seasonTerm.seasonTermId;
    const board = await ranking.getLeaderboard({ seasonTermId: seasonId, durationMode: mode, userId: session.userId, limit: query.limit });
    return { ...board, currentSeasonTerm: seasonTerm };
  });
  app.get('/api/matches/active', async (request) => {
    const session = await authenticate(request);
    return { activeSeat: services.matches ? await services.matches.getActiveSeat(session.userId) : await auth.getActiveSeat(requestSessionToken(request)) };
  });
  app.get('/api/matches/history', async (request) => {
    const session = await authenticate(request);
    return db.selectFrom('match_participants as p').innerJoin('matches as m', 'm.id', 'p.match_id')
      .select(['m.id as matchId', 'm.duration_mode as durationMode', 'm.queue_type as queueType', 'm.season_term_id as seasonTermId',
        'm.game_set_version as gameSetVersion', 'm.course_pack_version as coursePackVersion', 'm.completed_at as completedAt',
        'p.final_rank as finalRank', 'p.quarter_points as quarterPoints', 'p.final_board_snapshot as finalBoardSnapshot', 'p.wrong_question_ids as wrongQuestionIds'])
      .where('p.user_id', '=', session.userId).where('m.status', '=', 'completed').orderBy('m.completed_at', 'desc').limit(20).execute();
  });
  app.get('/api/lobby/state', async (request) => lobby().getState((await authenticate(request)).userId));
  aliases('POST', ['/api/lobby/enter', '/api/lobby/enter-mode'], async (request) => {
    const data = SettingsSchema.required({ durationMode: true }).parse(request.body);
    return write(request, async (session) => {
      if (services.matches && await services.matches.getActiveSeat(session.userId) && !await services.matches.canReturn(session.userId)) throw new ServiceError('MATCH_IN_PROGRESS');
      return lobby().enterMode(session.profile, data);
    });
  });
  aliases('POST', ['/api/lobby/join', '/api/lobby/join-code'], async (request) => {
    const { roomCode } = z.object({ roomCode: z.string().trim().min(4).max(10) }).strict().parse(request.body);
    return write(request, (session) => lobby().joinCode(session.profile, roomCode));
  });
  app.patch('/api/lobby/settings', async (request) => { const data = SettingsSchema.parse(request.body); return write(request, (s) => lobby().updateSettings(s.userId, data)); });
  const updateMemberPrefs: RouteHandlerMethod = async (request) => {
    const data = MemberPrefsSchema.parse(request.body);
    const saved = await write(request, async (session, tx) => {
      const apply = lobby().prepareMemberPrefs(session.profile, data);
      const { learningStartSelections, preferredArena, displaySettings } = data;
      const profile = learningStartSelections !== undefined || preferredArena !== undefined || displaySettings !== undefined
        ? await auth.updateProfileInTransaction(session, tx, {
          ...(learningStartSelections !== undefined ? { learningStartSelections } : {}),
          ...(preferredArena !== undefined ? { preferredArena } : {}),
          ...(displaySettings !== undefined ? { displaySettings } : {}),
        }) : session.profile;
      return { profile, apply };
    });
    return { ...saved.apply(saved.profile), profile: saved.profile };
  };
  aliases('PATCH', ['/api/lobby/preferences', '/api/lobby/member-prefs'], updateMemberPrefs);
  app.post('/api/lobby/member-prefs', updateMemberPrefs);
  app.post('/api/lobby/ready', async (request) => { const data = z.object({ ready: z.boolean() }).strict().parse(request.body); return write(request, (s) => lobby().updateMemberPrefs(s.profile, data)); });
  app.post('/api/lobby/start', async (request) => write(request, (s) => lobby().start(s.userId)));
  aliases('POST', ['/api/lobby/cancel', '/api/lobby/cancel-queue'], async (request) => write(request, (s) => lobby().cancelQueue(s.userId)));
  app.post('/api/lobby/leave', async (request) => write(request, (s) => lobby().leaveRoom(s.userId)));
  aliases('POST', ['/api/lobby/accept', '/api/lobby/accept-match'], async (request) => { const data = z.object({ ticketId: IdSchema, accept: z.boolean() }).strict().parse(request.body); return write(request, (s) => lobby().acceptMatch(s.userId, data)); });
  app.post('/api/matches/return-to-prep', async (request) => write(request, async (s, tx) => {
    if (services.matches && !await services.matches.canReturn(s.userId)) throw new ServiceError('MATCH_IN_PROGRESS');
    const state = await lobby().getState(s.userId);
    if (!services.matches && state.match) {
      const match = await tx.selectFrom('matches').select('status').where('id', '=', state.match.matchId).executeTakeFirst();
      if (!match || match.status !== 'completed') throw new ServiceError('MATCH_IN_PROGRESS');
    }
    return lobby().returnToPrep(s.userId);
  }));
  app.post('/api/lobby/communicate', async (request) => { const data = CommunicationClientSendSchema.parse(request.body); return write(request, (s) => lobby().sendCommunication(s.profile, data)); });
  app.get('/api/lobby/communication', async (request) => lobby().getCommunication((await authenticate(request)).userId));
  app.post('/api/lobby/blocked', async (request) => {
    const data = z.object({ senderUserId: IdSchema, blocked: z.boolean() }).strict().parse(request.body);
    await write(request, (s) => lobby().setBlocked(s.userId, data)); return { ok: true };
  });

  app.get('/api/rewards/summary', async (request) => {
    const session = await authenticate(request);
    return db.transaction().setIsolationLevel('repeatable read').execute(async (tx) => {
      const [balance, gifts, orders, ledger] = await Promise.all([rewards.getRewardPointsBalance(tx, session.userId),
        rewards.listGiftCatalog(tx), rewards.listRedemptionOrders(tx, session.userId), rewards.listRewardPointsLedger(tx, session.userId)]);
      return { balance, gifts, orders, ledger };
    });
  });
  app.get('/api/rewards/balance', async (request) => ({ balance: await rewards.getRewardPointsBalance(db, (await authenticate(request)).userId) }));
  app.get('/api/rewards/gifts', async (request) => { await authenticate(request); return rewards.listGiftCatalog(db); });
  app.get('/api/rewards/ledger', async (request) => {
    const session = await authenticate(request); const query = StringQuery.parse(request.query);
    return rewards.listRewardPointsLedger(db, session.userId, query.limit);
  });
  app.get('/api/rewards/orders', async (request) => rewards.listRedemptionOrders(db, (await authenticate(request)).userId));
  app.post('/api/rewards/redeem', async (request) => {
    const data = RedeemRequestSchema.parse(request.body);
    return write(request, (session, tx) => rewards.redeemGiftInSingleTx(borrowTransaction(tx),
      { ...data, userId: session.userId, idempotencyKey: `user:${session.userId}:${data.idempotencyKey}` }));
  });

  aliases('GET', ['/api/learning', '/api/learning/dashboard'], async (request) => learning.overview((await authenticate(request)).userId));
  app.get('/api/learning/due', async (request) => getPrivateFsrsCards(db, (await authenticate(request)).userId, new Date()));
  app.get('/api/learning/courses', async (request) => { await authenticate(request); return learning.listCoursePacks(); });
  app.get('/api/learning/packs/:packId', async (request) => {
    await authenticate(request); const { packId } = z.object({ packId: IdSchema }).parse(request.params);
    const pack = await getCoursePack(db, packId); return { manifest: pack.manifest, questions: pack.items.map(toClientQuestionView) };
  });
  aliases('POST', ['/api/learning/direct/sessions', '/api/learning/standalone/start'], async (request) => write(request, (s, tx) => learning.startDirect(s.userId, request.body, tx)));
  app.get('/api/learning/direct/sessions/:sessionId', async (request) => {
    const s = await authenticate(request); const { sessionId } = z.object({ sessionId: IdSchema }).parse(request.params); return learning.getDirect(s.userId, sessionId);
  });
  app.post('/api/learning/direct/sessions/:sessionId/advance', async (request) => {
    const { sessionId } = z.object({ sessionId: IdSchema }).parse(request.params); return write(request, (s, tx) => learning.advanceDirect(s.userId, sessionId, tx));
  });
  app.post('/api/learning/standalone/submit', async (request) => {
    const data = z.object({ sessionId: IdSchema, action: z.enum(['advance', 'submit']).default('submit'),
      questionId: IdSchema.optional(), submission: LearningSubmissionSchema.optional(),
      advance: z.boolean().optional() }).strict().parse(request.body);
    return write<unknown>(request, (session, tx) => {
      if (data.action === 'advance' || data.advance === true) return learning.advanceDirect(session.userId, data.sessionId, tx);
      if (!data.questionId || !data.submission) throw new ServiceError('INVALID_LEARNING_SUBMISSION');
      return learning.submitDirect(session.userId, data.sessionId, data.questionId, data.submission, tx);
    });
  });
  app.post('/api/learning/direct/sessions/:sessionId/questions/:questionId/submit', async (request) => {
    const { sessionId, questionId } = z.object({ sessionId: IdSchema, questionId: IdSchema }).parse(request.params);
    return write(request, (s, tx) => learning.submitDirect(s.userId, sessionId, questionId, request.body, tx));
  });
  aliases('POST', ['/api/learning/offline/sync', '/api/learning/offline-sync'], async (request) => write(request, (s, tx) => learning.syncOffline(s.userId, request.body, tx)));
  aliases('POST', ['/api/learning/question-issues', '/api/learning/issue-report'], async (request) => {
    const data = QuestionIssueReportSchema.parse(request.body); return write(request, (s, tx) => learning.reportQuestionIssue(s.userId, data, tx));
  });

  const drafts = new Map<string, { pack: z.infer<typeof CoursePackSchema>; ownerId: string; expiresAt: number }>();
  const draftFor = (draftId: string) => { const draft = drafts.get(draftId); if (!draft || draft.expiresAt < Date.now()) throw new ServiceError('PACK_DRAFT_NOT_FOUND'); return draft; };
  aliases('POST', ['/api/admin/packs/compile', '/api/admin/packs/compile-preview'], async (request, reply) => {
    const session = await authenticate(request); requireEditor(session); const input = CompileSchema.parse(request.body);
    const result = compileCoursePack({ ...input, createdAtIso: input.createdAtIso ?? new Date().toISOString() } as CompileCoursePackInput);
    if (!result.ok) return reply.code(422).send(result);
    for (const [key, value] of drafts) if (value.expiresAt < Date.now()) drafts.delete(key);
    if (drafts.size >= 100) throw new ServiceError('RATE_LIMIT_PACK_DRAFTS');
    const draftId = randomUUID(); drafts.set(draftId, { pack: result.pack, ownerId: session.userId, expiresAt: Date.now() + 3600_000 });
    return { ok: true, draftId, pack: result.pack, manifest: result.pack.manifest, diagnostics: [], previewQuestions: result.pack.items.map(toClientQuestionView) };
  }, 10 * 1024 * 1024);
  app.get('/api/admin/packs/drafts/:draftId', async (request) => {
    const session = await authenticate(request); requireEditor(session); const { draftId } = z.object({ draftId: IdSchema }).parse(request.params);
    const draft = draftFor(draftId); if (session.profile.role !== 'admin' && draft.ownerId !== session.userId) throw new ServiceError('FORBIDDEN');
    return { draftId, pack: draft.pack, previewQuestions: draft.pack.items.map(toClientQuestionView) };
  });
  app.post('/api/admin/packs/publish', async (request) => {
    const data = z.object({ draftId: IdSchema, activate: z.boolean().default(true) }).strict().parse(request.body); const draft = draftFor(data.draftId);
    return write(request, async (session, tx) => { requireAdmin(session);
      await publishCoursePack(borrowTransaction(tx), draft.pack, data.activate);
      return { ok: true, manifest: draft.pack.manifest, activated: data.activate };
    });
  });
  app.get('/api/admin/packs', async (request) => {
    requireEditor(await authenticate(request));
    const rows = await db.selectFrom('course_packs').select(['pack_json', 'is_active', 'created_at']).orderBy('pack_id').orderBy('created_at', 'desc').execute();
    return rows.map((row) => ({ manifest: CoursePackSchema.parse(row.pack_json).manifest, isActive: row.is_active, createdAtIso: row.created_at.toISOString() }));
  });
  app.get('/api/admin/packs/:packId/:version', async (request) => {
    requireEditor(await authenticate(request)); const { packId, version } = z.object({ packId: IdSchema, version: IdSchema }).parse(request.params);
    return getCoursePack(db, packId, version);
  });
  app.get('/api/admin/packs/:packId/:version/export', async (request) => {
    requireEditor(await authenticate(request)); const { packId, version } = z.object({ packId: IdSchema, version: IdSchema }).parse(request.params);
    return serializeCoursePackToAuthoring(await getCoursePack(db, packId, version));
  });
  const activate = async (request: FastifyRequest) => {
    const params = z.object({ packId: IdSchema.optional() }).parse(request.params);
    const data = z.object({ packId: IdSchema.optional(), version: IdSchema.optional(), coursePackVersion: IdSchema.optional() }).strict().parse(request.body);
    const packId = IdSchema.parse(params.packId ?? data.packId); const version = IdSchema.parse(data.version ?? data.coursePackVersion);
    return write(request, async (session, tx) => { requireAdmin(session); await activateCoursePackVersion(borrowTransaction(tx), packId, version);
      return { ok: true, packId, coursePackVersion: version }; });
  };
  aliases('POST', ['/api/admin/packs/:packId/activate', '/api/admin/packs/activate'], activate);
  app.post('/api/admin/packs/:packId/rollback', activate);
  aliases('GET', ['/api/admin/learning/error-rates', '/api/admin/analytics/anonymous-error-rates'], async (request, reply) => {
    requireEditor(await authenticate(request));
    const query = z.object({ cohortGroup: z.string().max(100).optional(), subject: SubjectIdSchema.optional(), format: z.enum(['json', 'csv']).default('json') }).parse(request.query);
    const rows = await queryAnonymousCohortSubjectErrorRates(db, query);
    if (query.format === 'json') return rows;
    const escape = (value: unknown) => { let text = value === null ? '' : String(value); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
    reply.type('text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="anonymous-error-rates.csv"');
    return ['cohortGroup,subject,suppressed,sampleSize,attemptCount,wrongRate', ...rows.map((row) => [row.cohortGroup, row.subject, row.suppressed, row.sampleSize, row.attemptCount, row.wrongRate].map(escape).join(','))].join('\r\n');
  });
  aliases('POST', ['/api/admin/users/:userId/reset-password', '/api/auth/admin-reset-password'], async (request) => {
    const params = z.object({ userId: IdSchema.optional() }).parse(request.params);
    const data = z.object({ userId: IdSchema.optional(), newPassword: z.string().min(6).max(128), identityVerified: z.literal(true) }).strict().parse(request.body);
    const userId = IdSchema.parse(params.userId ?? data.userId);
    await auth.adminResetPassword({ newPassword: data.newPassword, identityVerified: data.identityVerified, userId, adminToken: requestSessionToken(request) }); return { ok: true };
  });
  app.get('/api/admin/users', async (request) => {
    requireAdmin(await authenticate(request));
    return db.selectFrom('users').select(['id', 'username', 'nickname', 'role', 'cohort_group', 'created_at']).orderBy('created_at', 'desc').limit(1000).execute();
  });
  app.patch('/api/admin/users/:userId/cohort-group', async (request) => {
    const { userId } = z.object({ userId: IdSchema }).parse(request.params); const { cohortGroup } = z.object({ cohortGroup: z.string().trim().min(1).max(100).nullable() }).strict().parse(request.body);
    return write(request, async (s, tx) => { requireAdmin(s); const row = await tx.updateTable('users').set({ cohort_group: cohortGroup }).where('id', '=', userId).returning('id').executeTakeFirst();
      if (!row) throw new ServiceError('USER_NOT_FOUND'); return { ok: true }; });
  });
  aliases('POST', ['/api/admin/orders/:orderId/cancel', '/api/rewards/orders/:orderId/cancel'], async (request) => {
    const { orderId } = z.object({ orderId: IdSchema }).parse(request.params);
    const data = z.object({ userId: IdSchema.optional() }).strict().parse(request.body ?? {});
    return write(request, async (session, tx) => {
      if (request.url.startsWith('/api/admin/')) requireAdmin(session);
      const order = await tx.selectFrom('redemption_orders').select('user_id').where('id', '=', orderId).executeTakeFirst();
      if (!order || (data.userId && data.userId !== order.user_id)) throw new ServiceError('ORDER_NOT_FOUND');
      if (order.user_id !== session.userId && session.profile.role !== 'admin') throw new ServiceError('FORBIDDEN');
      return rewards.cancelOrderWithCompensation(borrowTransaction(tx), { orderId, userId: order.user_id });
    });
  });
  app.post('/api/admin/seasons/settle', async (request) => {
    const data = z.object({ oldSeasonId: IdSchema,
      newSeason: z.object({ id: IdSchema, label: z.string().min(1).max(100), startsAt: z.string().datetime(), endsAt: z.string().datetime() }).strict() }).strict().parse(request.body);
    return write(request, (session, tx) => { requireAdmin(session); return new RankingService(borrowTransaction(tx)).settleSeasonTermAndSoftReset({ oldSeasonId: data.oldSeasonId,
      newSeason: { ...data.newSeason, startsAt: new Date(data.newSeason.startsAt), endsAt: new Date(data.newSeason.endsAt) } }); });
  });
  app.get('/api/content/:category', async (request) => {
    await authenticate(request); const { category } = z.object({ category: z.enum(['units', 'traits', 'items', 'augments', 'lore']) }).parse(request.params);
    const file = category === 'lore' ? join(contentRoot, 'lore', 'season1-lore.json') : join(contentRoot, 'game', `${category}.json`);
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  });
}

export async function createHttpServer(services: HttpServices, options: HttpOptions & { fastify?: FastifyServerOptions } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] },
    bodyLimit: 2 * 1024 * 1024, ...options.fastify });
  await registerHttpRoutes(app, services, options); return app;
}
