import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import type { CoursePack } from '@pkg/contracts';
import { buildPersonalizedLessonBundle, settleLearningNodeGold, type SubmissionMap } from '@pkg/learning-core';
import { serializeCoursePackToAuthoring } from '@pkg/pack-compiler';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import { bootstrapDatabase } from '../src/bootstrap.js';
import { AuthService } from '../src/auth/authService.js';
import { RankingService } from '../src/ranking/rankingService.js';
import { getCoursePack, getPrivateFsrsCards, saveFsrsCard } from '../src/db/repositories.js';
import { getRewardPointsBalance, grantRewardPoints } from '../src/rewards/rewardsService.js';
import { createHttpServer, SESSION_COOKIE } from '../src/http/server.js';
import { LearningService } from '../src/learning/learningService.js';

const adminDb = createDatabase('postgres://127.0.0.1:5432/beyond_light_cone_test');
const schema = `http_learning_${randomUUID().replaceAll('-', '')}`;
const contentRoot = fileURLToPath(new URL('../../../content/', import.meta.url));
const password = 'real-http-password';
let db: AppDatabase, auth: AuthService, learning: LearningService, app: FastifyInstance;
let adminToken: string, pack: CoursePack;
let baseUrl: string;
interface NetworkRequest {
  method: string; url: string; headers?: Record<string, string>; cookies?: Record<string, string>; payload?: unknown;
}
async function http(request: NetworkRequest) {
  const requestHeaders = { ...request.headers };
  if (request.cookies) requestHeaders.cookie = Object.entries(request.cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; ');
  if (request.payload !== undefined) requestHeaders['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${request.url}`, { method: request.method, headers: requestHeaders,
    ...(request.payload === undefined ? {} : { body: JSON.stringify(request.payload) }),
    signal: AbortSignal.timeout(10_000), redirect: 'manual' });
  const body = await response.text();
  return { statusCode: response.status, headers: Object.fromEntries(response.headers.entries()), body,
    json: () => JSON.parse(body) };
}
async function account() {
  const username = `http_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const user = await auth.register({ username, password, nickname: '测试同学' });
  const login = await auth.login({ username, password });
  return { user, token: login.token };
}
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
function answers(p: CoursePack): SubmissionMap {
  return Object.fromEntries(p.items.map((q) => [q.questionId, { answer: q.questionType === 'multi_step_numeric'
    ? Object.fromEntries(q.stepsRubric.map((s) => [s.stepId, s.expected])) : q.questionType === 'numeric'
    ? `${q.answerSpec.split(':')[0]}${q.answerSpec.split(':')[2] ? ` ${q.answerSpec.split(':')[2]}` : ''}`
    : q.questionType === 'matching' ? Object.fromEntries(q.matchingPairs.map((pair) => [pair.left, pair.right]))
    : q.questionType === 'short_fill' ? q.answerSpec.split('|')[0] : q.answerSpec }]));
}
beforeAll(async () => {
  await sql.raw(`create schema ${schema}`).execute(adminDb);
  const url = new URL('postgres://127.0.0.1:5432/beyond_light_cone_test'); url.searchParams.set('options', `-c search_path=${schema}`);
  db = createDatabase(url.toString());
  await bootstrapDatabase(db, { contentRoot, defaultAdmin: { username: 'http_admin', password } });
  auth = new AuthService(db); learning = new LearningService(db);
  adminToken = (await auth.login({ username: 'http_admin', password })).token;
  app = await createHttpServer({ db, auth, ranking: new RankingService(db), learning, contentRoot }, { cookieSecure: false, fastify: { logger: false } });
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  pack = await getCoursePack(db, 'english-core-starter');
}, 30_000);
afterAll(async () => { if (app) await app.close(); if (db) await db.destroy(); await sql.raw(`drop schema if exists ${schema} cascade`).execute(adminDb); await adminDb.destroy(); });

describe('real PostgreSQL HTTP and shared learning persistence', () => {
  it('bootstraps compiled samples, administrator, migration and test gifts without resetting state', async () => {
    expect((await learning.listCoursePacks()).length).toBe(2);
    await db.updateTable('gift_catalog').set({ stock_remaining: 2 }).where('id', '=', 'local-notebook').execute();
    const repeated = await bootstrapDatabase(db, { contentRoot, defaultAdmin: { username: 'http_admin', password: 'different-password' } });
    expect(repeated.adminUserId).toBeTruthy();
    expect((await db.selectFrom('gift_catalog').select('stock_remaining').where('id', '=', 'local-notebook').executeTakeFirstOrThrow()).stock_remaining).toBe(2);
    expect((await auth.authenticate(adminToken)).profile.role).toBe('admin');
  });
  it('authenticates both cookie and bearer, blocks stale epochs, and rejects cross-origin cookie writes', async () => {
    const username = `cookie_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    expect((await http({ method: 'POST', url: '/api/auth/register', payload: { username, password, nickname: '学生' } })).statusCode).toBe(201);
    const login = await http({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
    expect(login.statusCode).toBe(200); expect(login.headers['set-cookie']).toContain('HttpOnly');
    const token = login.json().token as string;
    expect((await http({ method: 'GET', url: '/api/auth/me', cookies: { [SESSION_COOKIE]: token } })).statusCode).toBe(200);
    expect((await http({ method: 'PATCH', url: '/api/me/profile', cookies: { [SESSION_COOKIE]: token }, headers: { origin: 'https://untrusted.example' }, payload: { nickname: '篡改' } })).statusCode).toBe(403);
    await auth.login({ username, password });
    expect((await http({ method: 'PATCH', url: '/api/me/profile', headers: headers(token), payload: { nickname: '旧端' } })).statusCode).toBe(401);
    expect((await http({ method: 'GET', url: '/api/learning', headers: { authorization: 'Basic invalid' } })).statusCode).toBe(401);
  });
  it('keeps answer keys and explanations out of pre-submit HTTP payloads', async () => {
    const { token } = await account();
    const response = await http({ method: 'GET', url: `/api/learning/packs/${pack.manifest.packId}`, headers: headers(token) });
    expect(response.statusCode).toBe(200); expect(response.body).not.toContain('answerSpec'); expect(response.body).not.toContain('explanationMd');
    expect((await http({ method: 'POST', url: '/api/admin/packs/compile', headers: headers(token), payload: {} })).statusCode).toBe(403);
  });
  it('runs five-step direct study with locked submissions and real FSRS/points writes', async () => {
    const { user, token } = await account();
    let response = await http({ method: 'POST', url: '/api/learning/direct/sessions', headers: headers(token), payload: { selectedSubjects: ['english'], mode: 'quick', nodeIndex: 0 } });
    expect(response.statusCode).toBe(200); let state = response.json(); const id = state.sessionId;
    expect(state.currentStep.kind).toBe('material'); expect(response.body).not.toContain('answerSpec');
    const allAnswers = answers(pack);
    for (let step = 0; step < 5; step++) {
      for (const q of state.currentStep.questions) {
        response = await http({ method: 'POST', url: `/api/learning/direct/sessions/${id}/questions/${q.questionId}/submit`, headers: headers(token), payload: allAnswers[q.questionId] as Record<string, unknown> });
        expect(response.statusCode, response.body).toBe(200);
        const repeated = await http({ method: 'POST', url: `/api/learning/direct/sessions/${id}/questions/${q.questionId}/submit`, headers: headers(token), payload: { answer: 'definitely-wrong' } });
        expect(repeated.statusCode).toBe(409);
      }
      if (step < 4) {
        response = await http({ method: 'POST', url: `/api/learning/direct/sessions/${id}/advance`, headers: headers(token) });
        expect(response.statusCode, response.body).toBe(200); state = response.json();
        if (state.currentStep.kind !== 'material') expect(state.currentStep.materials).toEqual([]);
      }
    }
    const finished = (await http({ method: 'GET', url: `/api/learning/direct/sessions/${id}`, headers: headers(token) })).json();
    expect(finished.completed).toBe(true); expect(finished.result.rewardPointsGranted).toBeGreaterThan(0);
    expect(await getRewardPointsBalance(db, user.userId)).toBe(finished.result.rewardPointsGranted);
    expect((await getPrivateFsrsCards(db, user.userId)).length).toBeGreaterThan(0);
    const attempts = await db.selectFrom('learning_attempts').selectAll().where('user_id', '=', user.userId).execute();
    expect(attempts.length).toBeGreaterThan(0); expect(attempts.every((a) => !a.is_offline_unverified)).toBe(true);
  });
  it('shares first-mastery quota across direct/match and grants a normal due review only once', async () => {
    const { user } = await account();
    const bundle = buildPersonalizedLessonBundle({ packs: [pack], mode: 'quick', nodeIndex: 0, queueType: 'solo', selectedSubjects: ['english'], now: new Date() });
    const submissions = Object.fromEntries(bundle.questions.map((q) => [q.questionId, answers(pack)[q.questionId]]));
    const context = { source: 'direct_learning' as const, coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: randomUUID() };
    const first = await learning.persistNode(user.userId, bundle, submissions, context);
    const repeated = await learning.persistNode(user.userId, bundle, submissions, context);
    expect(repeated.alreadyPersisted).toBe(true); expect(repeated.attemptIds).toEqual(first.attemptIds);
    const match = await learning.persistNode(user.userId, bundle, submissions, { ...context, source: 'match_learning', idempotencyKey: randomUUID() });
    expect(match.rewardPointsGranted).toBe(0); expect(await getRewardPointsBalance(db, user.userId)).toBe(first.rewardPointsGranted);
    const cards = await getPrivateFsrsCards(db, user.userId);
    for (const card of cards) await saveFsrsCard(db, user.userId, { ...card, state: 2, reps: Math.max(1, card.reps),
      dueIso: new Date(Date.now() - 86_400_000).toISOString(), lastReviewIso: new Date(Date.now() - 3 * 86_400_000).toISOString() });
    const review = await learning.persistNode(user.userId, bundle, submissions, { ...context, source: 'match_learning', idempotencyKey: randomUUID() });
    expect(review.rewardPointsGranted).toBeGreaterThan(0);
    const notDue = await learning.persistNode(user.userId, bundle, submissions, { ...context, idempotencyKey: randomUUID() });
    expect(notDue.rewardPointsGranted).toBe(0);
  });
  it('makes offline synchronization idempotent, unverified and non-rewardable without rewriting FSRS', async () => {
    const { user, token } = await account();
    const q = pack.items.find((item) => item.stepRole === 'verification')!;
    const payload = { packId: pack.manifest.packId, coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: randomUUID(), submissions: { [q.questionId]: answers(pack)[q.questionId] } };
    const first = await http({ method: 'POST', url: '/api/learning/offline/sync', headers: headers(token), payload });
    expect(first.statusCode, first.body).toBe(200); expect(first.json().rewardPointsGranted).toBe(0); expect(first.json().isOfflineUnverified).toBe(true);
    const repeat = await http({ method: 'POST', url: '/api/learning/offline/sync', headers: headers(token), payload });
    expect(repeat.json().alreadyPersisted).toBe(true); expect(await getRewardPointsBalance(db, user.userId)).toBe(0);
    expect(await getPrivateFsrsCards(db, user.userId)).toHaveLength(0);
    const attemptId = first.json().attemptIds[0];
    expect((await db.selectFrom('learning_attempts').select('is_offline_unverified').where('id', '=', attemptId).executeTakeFirstOrThrow()).is_offline_unverified).toBe(true);
    const report = { questionId: q.questionId, packVersion: pack.manifest.coursePackVersion, attemptRef: attemptId, reasonCode: 'typo_or_formula' };
    expect((await http({ method: 'POST', url: '/api/learning/question-issues', headers: headers(token), payload: report })).statusCode).toBe(200);
    const other = await account();
    expect((await http({ method: 'POST', url: '/api/learning/question-issues', headers: headers(other.token), payload: report })).statusCode).toBe(404);
  });
  it('compiles all sources, previews, publishes immutable versions and atomically rolls back', async () => {
    const author = serializeCoursePackToAuthoring(pack);
    const compile = async (version: string) => http({ method: 'POST', url: '/api/admin/packs/compile', headers: headers(adminToken), payload: {
      meta: { ...author.meta, coursePackVersion: version }, csvSources: [{ file: 'questions.csv', text: author.csvText }], mdSources: [{ file: 'lessons.md', text: author.mdText }] } });
    const bad = await http({ method: 'POST', url: '/api/admin/packs/compile', headers: headers(adminToken), payload: { meta: {} } });
    expect(bad.statusCode).toBe(422); expect(bad.json().diagnostics[0].line).toBe(1);
    const compiled = await compile('1.1.0'); expect(compiled.statusCode, compiled.body).toBe(200);
    const draftId = compiled.json().draftId;
    expect((await http({ method: 'GET', url: `/api/admin/packs/drafts/${draftId}`, headers: headers(adminToken) })).json().pack.items.length).toBe(pack.items.length);
    const published = await http({ method: 'POST', url: '/api/admin/packs/publish', headers: headers(adminToken), payload: { draftId } });
    expect(published.statusCode, published.body).toBe(200); expect((await getCoursePack(db, pack.manifest.packId)).manifest.coursePackVersion).toBe('1.1.0');
    expect((await http({ method: 'POST', url: `/api/admin/packs/${pack.manifest.packId}/rollback`, headers: headers(adminToken), payload: { version: pack.manifest.coursePackVersion } })).statusCode).toBe(200);
    expect((await getCoursePack(db, pack.manifest.packId)).manifest.coursePackVersion).toBe(pack.manifest.coursePackVersion);
    expect((await getCoursePack(db, pack.manifest.packId, '1.1.0')).items.length).toBe(pack.items.length);
  });
  it('reuses the real single-transaction redemption under the auth fence and isolates orders', async () => {
    const { user, token } = await account(); const other = await account();
    await grantRewardPoints(db, { userId: user.userId, points: 100, reason: 'test', idempotencyKey: randomUUID() });
    const payload = { giftId: 'local-bookmark', idempotencyKey: randomUUID() };
    const response = await http({ method: 'POST', url: '/api/rewards/redeem', headers: headers(token), payload });
    expect(response.statusCode, response.body).toBe(200); expect(response.json().status).toBe('confirmed');
    const repeated = await http({ method: 'POST', url: '/api/rewards/redeem', headers: headers(token), payload });
    expect(repeated.json().orderId).toBe(response.json().orderId); expect(await getRewardPointsBalance(db, user.userId)).toBe(40);
    expect((await http({ method: 'GET', url: '/api/rewards/orders', headers: headers(other.token) })).json()).toEqual([]);
    const summary = await http({ method: 'GET', url: '/api/rewards/summary', headers: headers(token) });
    expect(summary.statusCode, summary.body).toBe(200);
    expect(summary.json()).toMatchObject({ balance: 40, orders: [{ orderId: response.json().orderId }] });
    expect(summary.json().gifts).toHaveLength(3); expect(summary.json().ledger).toHaveLength(2);
    const otherSummary = (await http({ method: 'GET', url: '/api/rewards/summary', headers: headers(other.token) })).json();
    expect(otherSummary.balance).toBe(0); expect(otherSummary.orders).toEqual([]); expect(otherSummary.ledger).toEqual([]);
    const forbidden = await http({ method: 'POST', url: `/api/rewards/orders/${response.json().orderId}/cancel`, headers: headers(other.token) });
    expect(forbidden.statusCode).toBe(403);
    const cancel = await http({ method: 'POST', url: `/api/rewards/orders/${response.json().orderId}/cancel`, headers: headers(token) });
    expect(cancel.statusCode, cancel.body).toBe(200); expect(await getRewardPointsBalance(db, user.userId)).toBe(100);
    const repeatCancel = await http({ method: 'POST', url: `/api/rewards/orders/${response.json().orderId}/cancel`, headers: headers(token) });
    expect(repeatCancel.json()).toEqual(cancel.json()); expect(await getRewardPointsBalance(db, user.userId)).toBe(100);
    const second = await http({ method: 'POST', url: '/api/rewards/redeem', headers: headers(token), payload: { ...payload, idempotencyKey: randomUUID() } });
    expect(second.statusCode).toBe(200);
    const adminCancel = await http({ method: 'POST', url: `/api/rewards/orders/${second.json().orderId}/cancel`, headers: headers(adminToken) });
    expect(adminCancel.statusCode, adminCancel.body).toBe(200); expect(await getRewardPointsBalance(db, user.userId)).toBe(100);
  });
  it('changes one profile field without applying defaults to unrelated preferences', async () => {
    const { token } = await account();
    const first = await http({ method: 'PATCH', url: '/api/me/profile', headers: headers(token), payload: {
      preferredArena: 'event_horizon_observatory', learningStartSelections: { math: 'chosen-node' } } });
    expect(first.statusCode).toBe(200);
    const second = await http({ method: 'PATCH', url: '/api/me/profile', headers: headers(token), payload: { nickname: '新昵称' } });
    expect(second.statusCode).toBe(200); expect(second.json().preferredArena).toBe('event_horizon_observatory');
    expect(second.json().learningStartSelections).toEqual({ math: 'chosen-node' });
    expect((await http({ method: 'PATCH', url: '/api/me/profile', headers: headers(token), payload: { role: 'admin' } })).statusCode).toBe(400);
    expect((await http({ method: 'PATCH', url: '/api/me/profile', headers: headers(token), payload: { displaySettings: { orientation: 'portrait', fullscreen: true } } })).statusCode).toBe(400);
  });
  it('suppresses a class/subject error aggregate with fewer than three distinct members', async () => {
    const { user } = await account();
    await db.updateTable('users').set({ cohort_group: '小样本班' }).where('id', '=', user.userId).execute();
    const bundle = buildPersonalizedLessonBundle({ packs: [pack], mode: 'quick', nodeIndex: 0, queueType: 'solo', selectedSubjects: ['english'], now: new Date() });
    const skipped = bundle.questions.find((q) => q.stepRole === 'resource_check')!;
    await learning.persistNode(user.userId, bundle, { [skipped.questionId]: { status: 'skipped' } },
      { source: 'direct_learning', coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: randomUUID() });
    const response = await http({ method: 'GET', url: '/api/admin/learning/error-rates', headers: headers(adminToken) });
    expect(response.statusCode).toBe(200);
    const group = response.json().find((r: {cohortGroup: string}) => r.cohortGroup === '小样本班');
    expect(group).toMatchObject({ suppressed: true, sampleSize: null, attemptCount: null, wrongRate: null });
  });

  it('does not invent attempts or FSRS evidence for a fully disconnected empty-submission node', async () => {
    const { user } = await account();
    const bundle = buildPersonalizedLessonBundle({ packs: [pack], mode: 'quick', nodeIndex: 0, queueType: 'solo', selectedSubjects: ['english'], now: new Date() });
    const result = await learning.persistNode(user.userId, bundle, {}, {
      source: 'match_learning', coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: `disconnected:${randomUUID()}` });
    expect(result.attemptIds).toEqual([]); expect(result.rewardPointsGranted).toBe(0);
    expect(result.wrongQuestionIds).toEqual(bundle.questions.map((q) => q.questionId));
    expect(await db.selectFrom('learning_attempts').select('id').where('user_id', '=', user.userId).execute()).toEqual([]);
    expect(await getPrivateFsrsCards(db, user.userId)).toEqual([]);
    expect(await getRewardPointsBalance(db, user.userId)).toBe(0);
    const gold = settleLearningNodeGold({ mode: 'quick', nodeIndex: 0, questions: bundle.questions, submissions: {} });
    expect(gold.grantedIntegerGold).toBe(0); expect(gold.scoreNumerator).toBe(0);
    expect(BigInt(gold.scoreDenominator)).toBeGreaterThan(0n);
  });
  it('records explicit skip/timed_out evidence only, without grading omitted sibling questions as recall failures', async () => {
    const { user } = await account();
    const bundle = buildPersonalizedLessonBundle({ packs: [pack], mode: 'quick', nodeIndex: 0, queueType: 'solo', selectedSubjects: ['english'], now: new Date() });
    const scored = bundle.questions.filter((q) => q.stepRole !== 'practice');
    const q = scored[0]!;
    const beforeCard = { familyId: q.familyId, subject: q.subject, knowledgeNode: q.knowledgeNode,
      dueIso: new Date(Date.now() + 86_400_000).toISOString(), lastReviewIso: new Date(Date.now() - 86_400_000).toISOString(),
      stability: 4, difficulty: 5, reps: 2, lapses: 0, state: 2 };
    await saveFsrsCard(db, user.userId, beforeCard);
    await learning.persistNode(user.userId, bundle, {}, { source: 'match_learning', coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: randomUUID() });
    expect(await getPrivateFsrsCards(db, user.userId)).toEqual([beforeCard]);
    for (const status of ['skipped', 'timed_out'] as const) {
      const result = await learning.persistNode(user.userId, bundle, { [q.questionId]: { status } },
        { source: 'match_learning', coursePackVersion: pack.manifest.coursePackVersion, idempotencyKey: randomUUID() });
      expect(result.attemptIds).toHaveLength(1); expect(result.rewardPointsGranted).toBe(0);
    }
    const rows = await db.selectFrom('learning_attempts').selectAll().where('user_id', '=', user.userId).execute();
    expect(rows).toHaveLength(2); expect(rows.every((row) => row.question_id === q.questionId && !row.is_correct)).toBe(true);
    const cards = await getPrivateFsrsCards(db, user.userId);
    expect(cards).toHaveLength(1); expect(cards[0]!.familyId).toBe(q.familyId); expect(cards[0]!.reps).toBeGreaterThan(beforeCard.reps);
  });

  it('serves the exact plural rankings route with the current seasonTerm and an honest unranked state', async () => {
    const { token } = await account();
    const response = await http({ method: 'GET', url: '/api/rankings/quick', headers: headers(token) });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().currentSeasonTerm).toMatchObject({ seasonTermId: 'S1-TERM-01', label: 'S1 第一赛季', rewardsSettled: false });
    expect(Number.isFinite(new Date(response.json().currentSeasonTerm.startsAtIso).getTime())).toBe(true);
    expect(response.json().self).toMatchObject({ status: 'unranked', rankScore: null, leaderboardRank: null });
    expect(response.json().entries).toEqual([]); expect(response.json().isEmpty).toBe(true);
  });

});
