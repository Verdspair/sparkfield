import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { ClientQuestionViewSchema, DEFAULT_TACTICIAN_ID, FinalBoardSnapshotSchema, MODE_BUDGETS, SEASON1_UNITS_BY_ID, TacticianIdSchema,
  type CoursePack, type DurationMode, type GameCommand, type UserProfile } from '@pkg/contracts';
import type { SeatState } from '@pkg/game-core';
import type { LearningGoldSettlement } from '@pkg/learning-core';
import { compileCoursePack, serializeCoursePackToAuthoring } from '@pkg/pack-compiler';
import { createAppServer } from '../src/index.js';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import { DEFAULT_SEASON_TERM_ID } from '../src/db/migrate.js';
import { getCoursePack, getPrivateFsrsCards } from '../src/db/repositories.js';
import { grantRewardPoints } from '../src/rewards/rewardsService.js';
import type { LobbyState } from '../src/lobby/lobbyService.js';

interface SdkRoom {
  roomId: string; sessionId: string;
  onMessage(type: '*', callback: (type: string | number, data: unknown) => void): () => void;
  send(type: string, data?: unknown): void;
  leave(consented?: boolean): Promise<number>;
}
interface SdkClient { joinById(roomId: string, options: { token: string }): Promise<SdkRoom> }
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { Client } = clientRequire('@colyseus/sdk') as { Client: new (url: string) => SdkClient };
const DATABASE_URL = 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const schema = `rooms_api_${randomUUID().replaceAll('-', '')}`;
const adminDb = createDatabase(DATABASE_URL);
const password = 'real-network-test-password';
const seasonTerm = DEFAULT_SEASON_TERM_ID;
let db: AppDatabase;
let server: Awaited<ReturnType<typeof createAppServer>>;
let baseURL: string;
let sdk: SdkClient;
let adminToken: string;
let englishPack: CoursePack;
const sockets = new Set<SdkRoom>();
interface Account { profile: UserProfile; token: string }
interface Reply<T> { status: number; body: T; headers: Headers; text: string }
async function http<T = Record<string, unknown>>(path: string, token?: string, body?: unknown,
  method = body === undefined ? 'GET' : 'POST', extraHeaders: Record<string, string> = {}): Promise<Reply<T>> {
  const response = await fetch(`${baseURL}${path}`, {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers, text };
}
async function ok<T = Record<string, unknown>>(path: string, token?: string, body?: unknown, method?: string): Promise<T> {
  const reply = await http<T>(path, token, body, method);
  expect(reply.status, `${path}: ${reply.text}`).toBeGreaterThanOrEqual(200);
  expect(reply.status, `${path}: ${reply.text}`).toBeLessThan(300);
  return reply.body;
}
async function account(): Promise<Account> {
  const profile = await server.auth.register({ username: `net_${randomUUID().replaceAll('-', '').slice(0, 20)}`, password, nickname: '网络测试同学' });
  const session = await server.auth.login({ username: profile.username, password });
  return { profile, token: session.token };
}
function answerFor(questionId: string, packs: CoursePack[] = [englishPack]) {
  const q = packs.flatMap((p) => p.items).find((item) => item.questionId === questionId);
  if (!q) throw new Error(`Missing fixture answer: ${questionId}`);
  const answer = q.questionType === 'multi_step_numeric' ? Object.fromEntries(q.stepsRubric.map((s) => [s.stepId, s.expected]))
    : q.questionType === 'matching' ? Object.fromEntries(q.matchingPairs.map((p) => [p.left, p.right]))
    : q.questionType === 'numeric' ? `${q.answerSpec.split(':')[0]}${q.answerSpec.split(':')[2] ? ` ${q.answerSpec.split(':')[2]}` : ''}`
    : q.questionType === 'short_fill' ? q.answerSpec.split('|')[0] : q.answerSpec;
  return { answer };
}
function safeQuestions(questions: unknown[]) {
  for (const question of questions) {
    const parsed = ClientQuestionViewSchema.parse(question);
    expect(question).toEqual(parsed);
    const text = JSON.stringify(question);
    for (const tokenSeed of ['answerSpec', 'partialRubric', 'explanationMd', 'matchingPairs', 'expected', 'tolerance']) {
      expect(text).not.toContain(`"${tokenSeed}"`);
    }
  }
}
interface DirectState {
  sessionId: string; stepIndex: number; completed: boolean; pausedClockAllowed: boolean;
  currentStep: { kind: string; materials: unknown[]; questions: { questionId: string; stepRole: string }[] };
  result: { attemptIds: string[]; rewardPointsGranted: number; alreadyPersisted: boolean } | null;
}
interface Snapshot {
  roomId: string; matchId: string; mode: DurationMode; queueType: string; phase: string; phaseIndex: number;
  deadlineEpochMs: number; remainingSeconds: number; round: number; nodeIndex: number;
  versionLock: { seasonTermId: string; gameSetVersion: string; coursePackVersion: string };
  seatId: string; self: SeatState; seats: Record<string, unknown>[];
  learning: null | { currentStep: string | null; complete: boolean; clientQuestions: { questionId: string; stepRole: string; subject: string }[];
    steps: unknown[]; submittedQuestionIds: string[]; feedback: Record<string, unknown> };
  resourceSettlement: LearningGoldSettlement | null;
  summary?: { competitive: unknown; learning: unknown };
}
interface CommandReply { requestId: string; ok: boolean; reason?: string }
interface Message { type: string | number; data: unknown }
class Inbox {
  readonly messages: Message[] = [];
  private readonly listeners = new Set<() => void>();
  constructor(readonly room: SdkRoom) {
    room.onMessage('*', (type, data) => { this.messages.push({ type, data }); for (const fn of [...this.listeners]) fn(); });
  }
  wait<T>(type: string, predicate: (data: T) => boolean = () => true, after = 0, timeout = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const check = () => {
        const message = this.messages.slice(after).find((m) => m.type === type && predicate(m.data as T));
        if (message) { clearTimeout(timer); this.listeners.delete(check); resolve(message.data as T); }
      };
      timer = setTimeout(() => { this.listeners.delete(check); reject(new Error(`Timed out waiting for ${type}; received ${this.messages.map((m) => m.type).join(', ')}`)); }, timeout);
      this.listeners.add(check); check();
    });
  }
  async snapshot(): Promise<Snapshot> {
    const waiting = this.wait<Snapshot>('snapshot', () => true, this.messages.length);
    this.room.send('snapshot'); return waiting;
  }
  async command(command: GameCommand, requestId = randomUUID()): Promise<CommandReply> {
    const waiting = this.wait<CommandReply>('command_result', (r) => r.requestId === requestId, this.messages.length);
    this.room.send('command', { requestId, command }); return waiting;
  }
}
async function join(roomId: string, token: string): Promise<Inbox> {
  const room = await sdk.joinById(roomId, { token }); sockets.add(room); return new Inbox(room);
}
async function lobby(person: Account): Promise<LobbyState> { return ok('/api/lobby/state', person.token); }
async function enter(person: Account, durationMode: DurationMode, queueType = 'ranked', sharedSubject = 'english'): Promise<LobbyState> {
  return ok('/api/lobby/enter-mode', person.token, { durationMode, queueType, sharedSubject });
}
async function accept(person: Account, ticketId: string, decision: boolean): Promise<LobbyState> {
  return ok('/api/lobby/accept-match', person.token, { ticketId, accept: decision });
}

beforeAll(async () => {
  const version = await sql<{ server_version: string }>`show server_version`.execute(adminDb);
  expect(version.rows[0]?.server_version).toMatch(/^17\./);
  await sql.raw(`create schema ${schema}`).execute(adminDb);
  const url = new URL(DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
  db = createDatabase(url.toString());
  server = await createAppServer({ db, gameSeed: 4, timeScale: 0.01, matchWaitMs: 120, acceptWaitMs: 800,
    reconnectProtectionMs: 300, defaultAdmin: { username: 'network_admin', password, nickname: '网络测试管理员' } });
  await db.updateTable('season_terms').set({ starts_at: new Date(Date.now() - 86_400_000), ends_at: new Date(Date.now() + 86_400_000) })
    .where('id', '=', seasonTerm).execute();
  baseURL = await server.listen(0);
  expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/);
  sdk = new Client(baseURL.replace('http:', 'ws:'));
  adminToken = (await ok<{ token: string }>('/api/auth/login', undefined, { username: 'network_admin', password })).token;
  englishPack = await getCoursePack(db, 'english-core-starter');
}, 30_000);
afterAll(async () => {
  await Promise.allSettled([...sockets].map((room) => room.leave()));
  if (server) await server.close();
  if (db) await db.destroy();
  await sql.raw(`drop schema if exists ${schema} cascade`).execute(adminDb);
  await adminDb.destroy();
}, 30_000);

describe('real random-port HTTP, PostgreSQL 17 and Colyseus SDK', () => {
  it('authenticates HTTP cookies and bearer tokens, blocks CSRF and fences superseded writes', async () => {
    expect(await ok('/api/health')).toEqual({ ok: true });
    const unauthenticated = await http('/api/me'); expect(unauthenticated.status).toBe(401);
    const username = `http_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const registered = await http<{ profile: UserProfile }>('/api/auth/register', undefined, { username, nickname: '真实HTTP注册', password, email: '  ' });
    expect(registered.status).toBe(201); expect(registered.body.profile.emailMasked).toBeNull();
    const first = await http<{ token: string; sessionEpoch: number }>('/api/auth/login', undefined, { username, password });
    expect(first.status).toBe(200);
    const cookie = first.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await http<{ userId: string }>('/api/auth/me', undefined, undefined, 'GET', { cookie: cookie.split(';')[0]! });
    expect(me.status).toBe(200); expect(me.body.userId).toBe(registered.body.profile.userId);
    const csrf = await http('/api/me/profile', undefined, { nickname: '非法跨源写入' }, 'PATCH', { cookie: cookie.split(';')[0]!, origin: 'https://untrusted.example' });
    expect(csrf.status).toBe(403); expect(csrf.body.error).toBe('FORBIDDEN_ORIGIN');
    const second = await ok<{ token: string; sessionEpoch: number }>('/api/auth/login', undefined, { username, password });
    expect(second.sessionEpoch).toBe(first.body.sessionEpoch + 1);
    const stale = await http('/api/me/profile', first.body.token, { nickname: '旧设备不能改' }, 'PATCH');
    expect(stale.status).toBe(401); expect(stale.body.error).toBe('SESSION_SUPERSEDED');
    expect((await http('/api/auth/me', 'bad', undefined, 'GET', { cookie: cookie.split(';')[0]! })).status).toBe(401);
    expect((await ok<{ profile: UserProfile }>('/api/auth/me', second.token)).profile.nickname).toBe('真实HTTP注册');
    expect((await db.selectFrom('users').select('email').where('id', '=', registered.body.profile.userId).executeTakeFirstOrThrow()).email).toBeNull();
    await ok('/api/auth/logout', second.token, {});
    expect((await http('/api/auth/me', second.token)).status).toBe(401);
  });

  it('runs private five-step direct learning over the actual listener and persists FSRS and points once', async () => {
    const person = await account(), outsider = await account();
    const publicPack = await ok<{ questions: unknown[] }>(`/api/learning/packs/${englishPack.manifest.packId}`, person.token);
    safeQuestions(publicPack.questions);
    let state = await ok<DirectState>('/api/learning/standalone/start', person.token, { mode: 'quick', selectedSubjects: ['english'] });
    const path = `/api/learning/direct/sessions/${state.sessionId}`;
    const submit = (questionId: string, submission: unknown) => http('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, questionId, submission });
    const advance = () => http<DirectState>('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, action: 'advance' });
    expect(state.pausedClockAllowed).toBe(true); expect(state.currentStep.kind).toBe('material');
    expect((await http(path, outsider.token)).status).toBe(404);
    const kinds: string[] = [];
    for (let step = 0; step < 5; step++) {
      kinds.push(state.currentStep.kind); safeQuestions(state.currentStep.questions);
      if (state.currentStep.kind !== 'material') expect(state.currentStep.materials).toEqual([]);
      if (state.currentStep.questions.length) expect((await advance()).status).toBe(409);
      for (const q of state.currentStep.questions) {
        if (q.stepRole !== 'practice') {
          const hinted = await submit(q.questionId, { ...answerFor(q.questionId), hintUsed: true });
          expect(hinted.status).toBe(403); expect(hinted.body.error).toBe('SCORED_QUESTION_HINT_FORBIDDEN');
        }
        expect((await submit(q.questionId, answerFor(q.questionId))).status).toBe(200);
        const changed = await submit(q.questionId, { answer: 'not the same submission' });
        expect(changed.status).toBe(409); expect(changed.body.error).toBe('QUESTION_SUBMISSION_LOCKED');
      }
      if (step < 4) { const next = await advance(); expect(next.status, next.text).toBe(200); state = next.body; }
      else state = await ok<DirectState>(path, person.token);
    }
    expect(kinds).toEqual(['material', 'practice', 'resource_check', 'remediation', 'verification']);
    expect(state.completed).toBe(true); expect(state.result!.rewardPointsGranted).toBeGreaterThan(0);
    const balance = await ok<{ balance: number }>('/api/rewards/balance', person.token);
    expect(balance.balance).toBe(state.result!.rewardPointsGranted);
    expect((await getPrivateFsrsCards(db, person.profile.userId)).length).toBeGreaterThan(0);
    const countBefore = await db.selectFrom('learning_attempts').select('id').where('user_id', '=', person.profile.userId).execute();
    expect((await advance()).status).toBe(200);
    expect(await db.selectFrom('learning_attempts').select('id').where('user_id', '=', person.profile.userId).execute()).toHaveLength(countBefore.length);
    expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(balance.balance);
    expect(await getPrivateFsrsCards(db, outsider.profile.userId)).toEqual([]);
  });

  it('advances wrong-answer remediation to verification without rewriting the original score', async () => {
    const person = await account();
    let state = await ok<DirectState>('/api/learning/standalone/start', person.token, { mode: 'quick', selectedSubjects: ['english'] });
    const advance = () => ok<DirectState>('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, action: 'advance' });
    state = await advance();
    for (const question of state.currentStep.questions) await ok('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, questionId: question.questionId, submission: answerFor(question.questionId) });
    state = await advance();
    expect(state.currentStep.kind).toBe('resource_check');
    const wrongIds = state.currentStep.questions.map((q) => q.questionId);
    expect(wrongIds.length).toBeGreaterThan(0);
    for (const questionId of wrongIds) await ok('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, questionId, submission: { status: 'skipped', answer: null } });
    state = await advance();
    expect(state.currentStep.kind).toBe('remediation');
    const correction = state as DirectState & { currentStep: { corrections: unknown[] } };
    expect(correction.currentStep.corrections.length).toBeGreaterThan(0);
    state = await advance();
    expect(state.currentStep.kind).toBe('verification');
    for (const question of state.currentStep.questions) await ok('/api/learning/standalone/submit', person.token, { sessionId: state.sessionId, questionId: question.questionId, submission: answerFor(question.questionId) });
    state = await ok<DirectState>(`/api/learning/direct/sessions/${state.sessionId}`, person.token);
    expect(state.completed).toBe(true);
    const original = await db.selectFrom('learning_attempts').select(['question_id', 'is_correct']).where('user_id', '=', person.profile.userId).where('question_id', 'in', wrongIds).execute();
    expect(original).toHaveLength(wrongIds.length);
    expect(original.every((attempt) => attempt.is_correct === false)).toBe(true);
    const balance = await ok<{ balance: number }>('/api/rewards/balance', person.token);
    const attemptsBefore = await db.selectFrom('learning_attempts').select('id').where('user_id', '=', person.profile.userId).execute();
    await advance();
    expect(await db.selectFrom('learning_attempts').select('id').where('user_id', '=', person.profile.userId).execute()).toHaveLength(attemptsBefore.length);
    expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(balance.balance);
  });

  it('stores offline sync as unverified, prevents reward minting and isolates question reports', async () => {
    const person = await account(), outsider = await account();
    const q = englishPack.items.find((item) => item.stepRole === 'verification')!;
    const data = { packId: englishPack.manifest.packId, coursePackVersion: englishPack.manifest.coursePackVersion,
      idempotencyKey: randomUUID(), submissions: { [q.questionId]: answerFor(q.questionId) } };
    const first = await ok<{ attemptIds: string[]; rewardPointsGranted: number; isOfflineUnverified: boolean }>('/api/learning/offline/sync', person.token, data);
    expect(first.isOfflineUnverified).toBe(true); expect(first.rewardPointsGranted).toBe(0);
    const repeated = await ok<{ alreadyPersisted: boolean; attemptIds: string[] }>('/api/learning/offline/sync', person.token, data);
    expect(repeated.alreadyPersisted).toBe(true); expect(repeated.attemptIds).toEqual(first.attemptIds);
    expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(0);
    expect(await getPrivateFsrsCards(db, person.profile.userId)).toEqual([]);
    const attempt = await db.selectFrom('learning_attempts').selectAll().where('id', '=', first.attemptIds[0]!).executeTakeFirstOrThrow();
    expect(attempt.is_offline_unverified).toBe(true); expect(attempt.user_id).toBe(person.profile.userId);
    const report = { questionId: q.questionId, packVersion: englishPack.manifest.coursePackVersion,
      attemptRef: first.attemptIds[0], reasonCode: 'ambiguous_stem' };
    expect((await http('/api/learning/question-issues', outsider.token, report)).status).toBe(404);
    const saved = await ok<{ reportId: string }>('/api/learning/question-issues', person.token, report);
    expect((await db.selectFrom('question_issue_reports').selectAll().where('id', '=', saved.reportId).executeTakeFirstOrThrow()).user_id).toBe(person.profile.userId);
  });

  it('compiles diagnostics and previews, publishes immutable content, exports and rolls back over HTTP', async () => {
    const member = await account();
    expect((await http('/api/admin/packs', member.token)).status).toBe(403);
    const bad = await http<{ diagnostics: { file: string; line: number; message: string }[] }>('/api/admin/packs/compile-preview', adminToken, { meta: {} });
    expect(bad.status).toBe(422); expect(bad.body.diagnostics.length).toBeGreaterThan(0);
    expect(bad.body.diagnostics[0]).toMatchObject({ line: 1 }); expect(bad.body.diagnostics[0]!.message).toBeTruthy();
    const author = serializeCoursePackToAuthoring(englishPack);
    const compile = async (version: string, csvText = author.csvText) => ok<{ draftId: string; previewQuestions: unknown[] }>('/api/admin/packs/compile-preview', adminToken, {
      meta: { ...author.meta, coursePackVersion: version }, csvSources: [{ file: 'questions.csv', text: csvText }],
      mdSources: [{ file: 'lessons.md', text: author.mdText }], createdAtIso: author.createdAtIso,
    });
    const draft = await compile('2.0.0'); safeQuestions(draft.previewQuestions);
    expect((draft as typeof draft & {pack:CoursePack}).pack.manifest.coursePackVersion).toBe('2.0.0');
    const preview = await ok<{ pack: CoursePack }>(`/api/admin/packs/drafts/${draft.draftId}`, adminToken);
    expect(preview.pack.items).toHaveLength(englishPack.items.length);
    expect((await http('/api/admin/packs/publish', member.token, { draftId: draft.draftId })).status).toBe(403);
    await ok('/api/admin/packs/publish', adminToken, { draftId: draft.draftId });
    expect((await getCoursePack(db, englishPack.manifest.packId)).manifest.coursePackVersion).toBe('2.0.0');
    const exported = await ok<{ csvText: string; mdText: string }>(`/api/admin/packs/${englishPack.manifest.packId}/2.0.0/export`, adminToken);
    expect(exported.csvText).toContain('question_id');
    const recompiled = compileCoursePack({ meta: preview.pack.manifest,
      csvSources: [{ file: 'questions.csv', text: exported.csvText }],
      mdSources: [{ file: 'lessons.md', text: exported.mdText }], createdAtIso: preview.pack.manifest.createdAtIso });
    expect(recompiled.ok).toBe(true);
    if (recompiled.ok) expect(recompiled.pack.items).toEqual(preview.pack.items);
    const conflicting = await compile('2.0.0', author.csvText.replace(/\bENG_Q01\b/g, 'ENG_Q01_REVISED'));
    const conflict = await http('/api/admin/packs/publish', adminToken, { draftId: conflicting.draftId });
    expect(conflict.status).toBe(409); expect(conflict.body.error).toBe('IMMUTABLE_PACK_VERSION_CONFLICT');
    await ok('/api/admin/packs/activate', adminToken, { packId: englishPack.manifest.packId, version: englishPack.manifest.coursePackVersion });
    expect((await getCoursePack(db, englishPack.manifest.packId)).manifest.coursePackVersion).toBe(englishPack.manifest.coursePackVersion);
    expect((await getCoursePack(db, englishPack.manifest.packId, '2.0.0')).manifest.contentSha256).toBe(preview.pack.manifest.contentSha256);
  });

  it('persists chapter and arena preferences with one room update and restores them after leaving', async () => {
    const person = await account();
    await ok('/api/lobby/enter-mode', person.token, { durationMode: 'quick', queueType: 'solo', sharedSubject: 'english' });
    const selected = { english: englishPack.manifest.knowledgeGraph[1]!.nodeId };
    const saved = await ok<{ selfPrefs: { learningStartSelections: Record<string, string>; preferredArena: string }; profile: { learningStartSelections: Record<string, string> } }>(
      '/api/lobby/member-prefs', person.token, { learningStartSelections: selected, preferredArena: 'mercury_dyson_forge' });
    expect(saved.profile.learningStartSelections).toEqual(selected);
    expect(saved.selfPrefs.learningStartSelections).toEqual(selected);
    const stored = await db.selectFrom('users').select(['learning_start_json', 'preferred_arena']).where('id', '=', person.profile.userId).executeTakeFirstOrThrow();
    expect(stored.learning_start_json).toEqual(selected);
    expect(stored.preferred_arena).toBe('mercury_dyson_forge');
    await ok('/api/lobby/leave', person.token, {});
    const rejoined = await ok<{ selfPrefs: { learningStartSelections: Record<string, string>; preferredArena: string } }>('/api/lobby/enter-mode', person.token, { durationMode: 'quick', queueType: 'solo' });
    expect(rejoined.selfPrefs.learningStartSelections).toEqual(selected);
    expect(rejoined.selfPrefs.preferredArena).toBe('mercury_dyson_forge');
    await ok('/api/lobby/leave', person.token, {});
  });

  it('rolls back saved preferences when the same room update is rejected', async () => {
    const person = await account();
    await ok('/api/lobby/enter-mode', person.token, { durationMode: 'quick', queueType: 'ranked', sharedSubject: 'english' });
    const before = await db.selectFrom('users').select(['learning_start_json', 'preferred_arena']).where('id', '=', person.profile.userId).executeTakeFirstOrThrow();
    const rejected = await http('/api/lobby/member-prefs', person.token, {
      subject: 'math', learningStartSelections: { english: englishPack.manifest.knowledgeGraph[1]!.nodeId }, preferredArena: 'mercury_dyson_forge',
    });
    expect(rejected.status).toBe(409);
    const after = await db.selectFrom('users').select(['learning_start_json', 'preferred_arena']).where('id', '=', person.profile.userId).executeTakeFirstOrThrow();
    expect(after).toEqual(before);
    const room = await ok<{ selfPrefs: { learningStartSelections: Record<string, string>; preferredArena: string } }>('/api/lobby/state', person.token);
    expect(room.selfPrefs.learningStartSelections).toEqual(before.learning_start_json);
    expect(room.selfPrefs.preferredArena).toBe(before.preferred_arena);
    await ok('/api/lobby/leave', person.token, {});
  });

  it('keeps real concurrent gift redemption atomic and appends exactly one admin compensation', async () => {
    const people = await Promise.all(Array.from({ length: 8 }, () => account()));
    const giftId = `network-gift-${randomUUID()}`;
    await db.insertInto('gift_catalog').values({ id: giftId, title: '仅本地并发测试', description: '不履约', points_cost: 100,
      stock_remaining: 1, is_sample_reward: true }).execute();
    await Promise.all(people.map((p) => grantRewardPoints(db, { userId: p.profile.userId, points: 150, reason: 'network_fixture', idempotencyKey: randomUUID() })));
    const keys = people.map(() => randomUUID());
    const responses = await Promise.all(people.map((p, i) => http<{ orderId: string; error?: string }>('/api/rewards/redeem', p.token, { giftId, idempotencyKey: keys[i]! })));
    const winners = responses.flatMap((r, index) => r.status === 200 ? [{ index, orderId: r.body.orderId }] : []);
    expect(winners).toHaveLength(1);
    for (const response of responses) if (response.status !== 200) { expect(response.status).toBe(409); expect(response.body.error).toBe('OUT_OF_STOCK'); }
    const winner = winners[0]!, person = people[winner.index]!;
    const repeats = await Promise.all(Array.from({ length: 6 }, () => ok<{ orderId: string }>('/api/rewards/redeem', person.token, { giftId, idempotencyKey: keys[winner.index]! })));
    expect(new Set(repeats.map((r) => r.orderId))).toEqual(new Set([winner.orderId]));
    expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(50);
    expect((await db.selectFrom('gift_catalog').select('stock_remaining').where('id', '=', giftId).executeTakeFirstOrThrow()).stock_remaining).toBe(0);
    const other = people.find((p) => p !== person)!;
    expect(await ok('/api/rewards/orders', other.token)).toEqual([]);
    expect((await http(`/api/admin/orders/${winner.orderId}/cancel`, other.token, { userId: person.profile.userId })).status).toBe(403);
    await Promise.all(Array.from({ length: 4 }, () => ok(`/api/admin/orders/${winner.orderId}/cancel`, adminToken, { userId: person.profile.userId })));
    expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(150);
    expect((await db.selectFrom('gift_catalog').select('stock_remaining').where('id', '=', giftId).executeTakeFirstOrThrow()).stock_remaining).toBe(1);
    const ledger = await db.selectFrom('reward_points_ledger').selectAll().where('related_order_id', '=', winner.orderId).orderBy('points_delta').execute();
    expect(ledger.map((entry) => entry.points_delta)).toEqual([-100, 100]); expect(ledger[1]!.compensates_ledger_id).toBe(ledger[0]!.id);
    expect(await db.selectFrom('redemption_orders').select('id').where('gift_id', '=', giftId).execute()).toHaveLength(1);
  }, 30_000);
});

async function waitForLobby(person: Account, predicate: (state: LobbyState) => boolean, timeout = 6000): Promise<LobbyState> {
  let state: LobbyState;
  await expect.poll(async () => { state = await lobby(person); return predicate(state); }, { timeout, interval: 25 }).toBe(true);
  return state!;
}

describe('account-keyed prep and global accept coordination over HTTP', () => {
  it('keeps prep through navigation, enforces host/subject permissions and hides private preferences', async () => {
    const host = await account(), member = await account();
    const initial = await enter(host, 'quick');
    const code = initial.prepRoom!.roomCode;
    await ok('/api/learning/dashboard', host.token);
    await ok('/api/me', host.token);
    const again = await enter(host, 'deep');
    expect(again.prepRoom!.roomCode).toBe(code); expect(again.prepRoom!.durationMode).toBe('quick');
    const joined = await ok<LobbyState>('/api/lobby/join-code', member.token, { roomCode: code.toLowerCase() });
    expect(joined.prepRoom!.members).toHaveLength(2);
    const denied = await http('/api/lobby/settings', member.token, { sharedSubject: 'math' }, 'PATCH');
    expect(denied.status).toBe(403); expect(denied.body.error).toBe('HOST_ONLY');
    const locked = await http('/api/lobby/member-prefs', member.token, { subject: 'math' }, 'PATCH');
    expect(locked.status).toBe(409); expect(locked.body.error).toBe('RANKED_SUBJECT_LOCKED');
    await ok('/api/lobby/member-prefs', member.token, { learningStartSelections: { english: 'member-only-node' }, preferredArena: 'event_horizon_observatory' }, 'PATCH');
    await ok('/api/lobby/ready', member.token, { ready: true });
    const own = await lobby(member), publicState = await lobby(host);
    expect(own.selfPrefs!.learningStartSelections).toEqual({ english: 'member-only-node' });
    expect(own.selfPrefs!.preferredArena).toBe('event_horizon_observatory');
    expect(JSON.stringify(publicState)).not.toContain('member-only-node');
    expect(publicState.prepRoom!.members.find((m) => m.userId === member.profile.userId)?.ready).toBe(true);
    await ok('/api/lobby/start', host.token, {});
    await ok('/api/lobby/cancel-queue', host.token, {});
    expect((await lobby(host)).prepRoom!.status).toBe('idle');
    await ok('/api/lobby/leave', member.token, {});
    expect((await lobby(member)).prepRoom).toBeNull();
    expect((await lobby(host)).prepRoom!.members).toHaveLength(1);
    await ok('/api/lobby/leave', host.token, {});
  });

  it('persists validated tacticians through both PATCH routes and only projects the public ID to other members', async () => {
    const host = await account(), guest = await account();
    const prep = await enter(host, 'quick');
    await ok('/api/lobby/join-code', guest.token, { roomCode: prep.prepRoom!.roomCode });
    expect(guest.profile.preferredTacticianId).toBe(DEFAULT_TACTICIAN_ID);
    for (const path of ['/api/me/profile', '/api/lobby/member-prefs']) {
      const rejected = await http(path, guest.token, { preferredTacticianId: 'custom-pilot' }, 'PATCH');
      expect(rejected).toMatchObject({ status: 400, body: { error: 'VALIDATION_ERROR' } });
    }
    const profileUpdate = await ok<UserProfile>('/api/me/profile', guest.token, {
      preferredTacticianId: 'tactician_europa_fin', learningStartSelections: { english: 'private-start-node' },
    }, 'PATCH');
    expect(profileUpdate.preferredTacticianId).toBe('tactician_europa_fin');
    const hostView = await lobby(host);
    expect(hostView.prepRoom!.members.find(({ userId }) => userId === guest.profile.userId)).toMatchObject({ tacticianId: 'tactician_europa_fin', avatarFrameId: null });
    expect(JSON.stringify(hostView)).not.toContain('private-start-node');
    expect((await lobby(guest)).selfPrefs?.learningStartSelections).toEqual({ english: 'private-start-node' });
    const prefsUpdate = await ok<LobbyState & { profile: UserProfile }>('/api/lobby/member-prefs', guest.token,
      { preferredTacticianId: 'tactician_singularity_mew' }, 'PATCH');
    expect(prefsUpdate.profile.preferredTacticianId).toBe('tactician_singularity_mew');
    expect(prefsUpdate.selfPrefs?.preferredTacticianId).toBe('tactician_singularity_mew');
    const { profile } = await ok<{ profile: UserProfile }>('/api/me', guest.token);
    expect(profile).toMatchObject({ preferredTacticianId: 'tactician_singularity_mew', avatarFrameId: null });
    await ok('/api/lobby/leave', guest.token, {});
    await ok('/api/me/profile', guest.token, { preferredTacticianId: DEFAULT_TACTICIAN_ID }, 'PATCH');
    const rejoined = await ok<LobbyState>('/api/lobby/join-code', guest.token, { roomCode: prep.prepRoom!.roomCode });
    expect(rejoined.selfPrefs?.preferredTacticianId).toBe(DEFAULT_TACTICIAN_ID);
    await ok('/api/lobby/leave', guest.token, {});
    await ok('/api/lobby/leave', host.token, {});
  });

  it('merges two prep parties globally, cancels eight declines and creates no match for zero acceptances', async () => {
    const people = await Promise.all(Array.from({ length: 8 }, () => account()));
    const first = (await enter(people[0]!, 'quick')).prepRoom!.roomCode;
    const second = (await enter(people[4]!, 'quick')).prepRoom!.roomCode;
    for (const [start, code] of [[0, first], [4, second]] as const) {
      for (let i = start + 1; i < start + 4; i++) {
        await ok('/api/lobby/join-code', people[i]!.token, { roomCode: code });
      }
      await Promise.all(people.slice(start + 1, start + 4).map((person) => ok('/api/lobby/ready', person.token, { ready: true })));
    }
    const before = await db.selectFrom('matches').select('id').execute();
    await ok('/api/lobby/start', people[0]!.token, {});
    await ok('/api/lobby/start', people[4]!.token, {});
    const states = await Promise.all(people.map(lobby));
    expect(new Set(states.map((state) => state.acceptPrompt!.ticketId)).size).toBe(1);
    expect(states.every((state) => state.acceptPrompt!.totalCandidateHumans === 8)).toBe(true);
    await Promise.all(people.map((person, i) => accept(person, states[i]!.acceptPrompt!.ticketId, false)));
    expect((await lobby(people[0]!)).acceptPrompt).toBeNull();
    expect(await db.selectFrom('matches').select('id').execute()).toHaveLength(before.length);
    for (const person of people) await ok('/api/lobby/leave', person.token, {});
    const pending = await account();
    await enter(pending, 'standard'); await ok('/api/lobby/start', pending.token, {});
    await waitForLobby(pending, (state) => state.acceptPrompt !== null);
    await waitForLobby(pending, (state) => state.acceptPrompt === null && state.prepRoom!.status === 'idle');
    expect(await db.selectFrom('matches').select('id').execute()).toHaveLength(before.length);
    expect(await ok('/api/matches/history', pending.token)).toEqual([]);
    await ok('/api/lobby/leave', pending.token, {});
  }, 20_000);
});

async function requestLearning(inbox: Inbox, action: 'advance' | 'submit', questionId?: string, submission?: unknown): Promise<CommandReply> {
  const requestId = randomUUID();
  const waiting = inbox.wait<CommandReply>('learning_result', (r) => r.requestId === requestId, inbox.messages.length);
  inbox.room.send('learning', { requestId, action, ...(questionId ? { questionId } : {}), ...(submission ? { submission } : {}) });
  return waiting;
}
function assertPrivateSnapshot(snapshot: Snapshot, queueType: string) {
  expect(snapshot.seats).toHaveLength(8); expect(new Set(snapshot.seats.map((seat) => seat.seatId)).size).toBe(8);
  expect(snapshot.self.id).toBe(snapshot.seatId); expect(snapshot.self.shop).toHaveLength(5);
  for (const seat of snapshot.seats) {
    expect(TacticianIdSchema.safeParse(seat.tacticianId).success).toBe(true);
    for (const key of ['shop', 'gold', 'inventoryItems', 'profile', 'preferredTacticianId', 'learningStartSelections', 'learning', 'fsrs', 'submissions', 'answerSpec']) expect(seat).not.toHaveProperty(key);
    if (queueType !== 'solo') expect(seat).not.toHaveProperty('isBot');
  }
  if (snapshot.learning) safeQuestions(snapshot.learning.clientQuestions);
}

describe.each([
  ['quick', 'ranked'], ['standard', 'casual'], ['deep', 'solo'],
] as const)('%s authoritative %s match with the real SDK', (mode, queueType) => {
  it('runs its whole clock, restores the same seat after login takeover and persists an immutable final result', async () => {
    const person = await account(), other = await account(), intruder = await account();
    let selected: LobbyState;
    if (queueType === 'solo') {
      await ok('/api/me/profile', person.token, { preferredTacticianId: 'tactician_europa_fin' }, 'PATCH');
      const prep = await enter(person, mode, queueType);
      const invite = await http('/api/lobby/join-code', other.token, { roomCode: prep.prepRoom!.roomCode });
      expect(invite.status).toBe(409); expect(invite.body.error).toBe('SOLO_INVITES_DISABLED');
      selected = await ok<LobbyState>('/api/lobby/start', person.token, {});
      expect(selected.acceptPrompt).toBeNull(); expect(selected.match).not.toBeNull();
    } else if (queueType === 'ranked') {
      const prep = await enter(person, mode, queueType);
      await ok('/api/lobby/join-code', other.token, { roomCode: prep.prepRoom!.roomCode });
      await ok('/api/lobby/ready', other.token, { ready: true });
      await ok('/api/lobby/start', person.token, {});
      const prompt = (await waitForLobby(person, (state) => state.acceptPrompt !== null)).acceptPrompt!;
      expect(prompt.totalCandidateHumans).toBe(2);
      const accepted = await accept(person, prompt.ticketId, true);
      expect(accepted.acceptPrompt!.selfDecision).toBe('accepted'); expect(accepted.match).toBeNull();
      selected = await waitForLobby(person, (state) => state.match !== null);
      const timedOut = await lobby(other); expect(timedOut.match).toBeNull(); expect(timedOut.prepRoom!.status).toBe('idle');
    } else {
      await enter(person, mode, queueType, 'english'); await enter(other, mode, queueType, 'math');
      await ok('/api/lobby/start', person.token, {}); await ok('/api/lobby/start', other.token, {});
      const prompt = (await waitForLobby(person, (state) => state.acceptPrompt !== null)).acceptPrompt!;
      const otherPrompt = (await lobby(other)).acceptPrompt!;
      expect(prompt.ticketId).toBe(otherPrompt.ticketId); expect(prompt.totalCandidateHumans).toBe(2);
      await Promise.all([accept(person, prompt.ticketId, true), accept(other, prompt.ticketId, true)]);
      selected = await lobby(person);
      expect((await lobby(other)).match!.roomId).toBe(selected.match!.roomId);
    }
    const roomId = selected.match!.roomId, matchId = selected.match!.matchId;
    const inbox = await join(roomId, person.token);
    const streams = [inbox];
    const initial = await inbox.snapshot();
    expect(initial.phase).toBe('entry'); expect(initial.mode).toBe(mode); expect(initial.queueType).toBe(queueType);
    expect(initial.matchId).toBe(matchId); assertPrivateSnapshot(initial, queueType);
    expect(initial.versionLock).toMatchObject({ seasonTermId: seasonTerm, gameSetVersion: 'season1-v1', coursePackVersion: englishPack.manifest.coursePackVersion });
    const seatId = initial.seatId;
    if (queueType === 'solo') {
      expect(initial.seats.find((seat) => seat.seatId === seatId)?.tacticianId).toBe('tactician_europa_fin');
      expect(initial.seats.filter((seat) => seat.seatId !== seatId).every((seat) => seat.tacticianId === DEFAULT_TACTICIAN_ID)).toBe(true);
      await ok('/api/me/profile', person.token, { preferredTacticianId: 'tactician_singularity_mew' }, 'PATCH');
      expect((await inbox.snapshot()).seats.find((seat) => seat.seatId === seatId)?.tacticianId).toBe('tactician_europa_fin');
    }
    await expect(sdk.joinById(roomId, { token: intruder.token })).rejects.toBeTruthy();
    const blocked = await inbox.command({ type: 'REFRESH_SHOP' });
    expect(blocked).toMatchObject({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
    const noReturn = await http('/api/matches/return-to-prep', person.token, {});
    expect(noReturn.status).toBe(409); expect(noReturn.body.error).toBe('MATCH_IN_PROGRESS');

    let studyInbox = inbox;
    let staleSnapshotCount = 0;
    if (queueType === 'ranked') {
      const aSeat = await ok<{ activeSeat: { seatId: string } }>('/api/matches/active', person.token);
      expect(aSeat.activeSeat!.seatId).toBe(seatId);
      const next = await ok<{ token: string; sessionEpoch: number; activeSeat: { seatId: string; matchId: string } }>('/api/auth/login', undefined,
        { username: person.profile.username, password });
      expect(next.activeSeat).toMatchObject({ seatId, matchId });
      const superseded = await inbox.command({ type: 'SET_LINEUP_PLAN', unitIds: ['S01'] });
      expect(superseded).toMatchObject({ ok: false, reason: 'SESSION_SUPERSEDED' });
      staleSnapshotCount = inbox.messages.filter((message) => message.type === 'snapshot').length;
      const oldHttp = await http('/api/lobby/member-prefs', person.token, { ready: false }, 'PATCH');
      expect(oldHttp.status).toBe(401); expect(oldHttp.body.error).toBe('SESSION_SUPERSEDED');
      person.token = next.token;
      studyInbox = await join(roomId, person.token); streams.push(studyInbox);
      expect((await studyInbox.snapshot()).seatId).toBe(seatId);
    }
    let secondInbox: Inbox | undefined;
    if (queueType === 'casual') {
      secondInbox = await join(roomId, other.token);
      const second = await secondInbox.snapshot();
      expect(second.seatId).not.toBe(seatId); assertPrivateSnapshot(second, queueType);
    }
    const lesson = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'learning' && s.nodeIndex === 0);
    expect(lesson.learning).not.toBeNull(); assertPrivateSnapshot(lesson, queueType);
    if (queueType === 'ranked') {
      expect(await studyInbox.command({ type: 'BUY_CARD', shopIndex: 0 })).toMatchObject({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
      const denied = await studyInbox.snapshot();
      expect(denied.self.gold).toBe(lesson.self.gold); expect(denied.self.shop).toEqual(lesson.self.shop);
      expect(denied.self.goldLedger.filter((entry) => entry.reason === 'learning')).toEqual([]);
    }
    if (queueType === 'casual') {
      const secondLesson = await secondInbox!.wait<Snapshot>('snapshot', (s) => s.phase === 'learning' && s.nodeIndex === 0);
      expect(secondLesson.learning!.currentStep).toBe('material');
      expect((await requestLearning(secondInbox!, 'advance')).ok).toBe(true);
      const secondPractice = await secondInbox!.snapshot();
      expect(secondPractice.learning!.clientQuestions.length).toBeGreaterThan(0);
      expect(secondPractice.learning!.clientQuestions.every((q) => q.subject === 'math')).toBe(true);
      safeQuestions(secondPractice.learning!.clientQuestions);
    }
    let current = lesson;
    const firstNodeQuestionIds = new Set<string>();
    for (let step = 0; step < 8 && current.learning && !current.learning.complete; step++) {
      safeQuestions(current.learning.clientQuestions);
      expect(current.learning.clientQuestions.every((q) => q.subject === 'english')).toBe(true);
      if (current.learning.currentStep === 'material' || current.learning.currentStep === 'remediation') {
        expect((await requestLearning(studyInbox, 'advance')).ok).toBe(true);
      } else {
        for (const q of current.learning.clientQuestions) {
          if (queueType === 'ranked') {
            const poison = await requestLearning(studyInbox, 'submit', q.questionId, { questionId: 'wrong-question-id', answer: 'x' });
            expect(poison).toMatchObject({ ok: false, reason: 'INVALID_MESSAGE' });
          }
          expect((await requestLearning(studyInbox, 'submit', q.questionId, answerFor(q.questionId))).ok).toBe(true);
          firstNodeQuestionIds.add(q.questionId);
        }
      }
      current = await studyInbox.snapshot();
    }
    expect(current.learning!.complete).toBe(true);
    if (queueType === 'ranked') {
      expect(current.phase).toBe('learning'); expect(current.phaseIndex).toBe(lesson.phaseIndex);
      expect(current.deadlineEpochMs).toBe(lesson.deadlineEpochMs);
      expect(current.self.gold).toBe(lesson.self.gold); expect(current.self.shop).toEqual(lesson.self.shop);
      expect(current.self.goldLedger.filter((entry) => entry.reason === 'learning')).toEqual([]);
      expect(await studyInbox.command({ type: 'BUY_CARD', shopIndex: 0 })).toMatchObject({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
      const stillLearning = await studyInbox.snapshot();
      expect(stillLearning.phase).toBe('learning'); expect(stillLearning.deadlineEpochMs).toBe(lesson.deadlineEpochMs);
      expect(stillLearning.self.gold).toBe(lesson.self.gold); expect(stillLearning.self.shop).toEqual(lesson.self.shop);
      const resource = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'resource' && s.nodeIndex === 0);
      expect(resource.resourceSettlement).toMatchObject({ nodeIndex: 0, rawEarnedCents: 180, carryInCents: 0,
        grantedIntegerGold: 1, carryOutCents: 80, orbSplits: [1] });
      expect(resource.self.gold).toBe(lesson.self.gold + 1);
      expect(resource.self.learningChargeCents).toBe(80); expect(resource.self.learningGoldOrbs).toEqual([1]);
      expect(resource.self.learningGoldOrbs.every(Number.isInteger)).toBe(true);
      expect(resource.self.goldLedger.filter((entry) => entry.reason === 'learning')).toEqual([{ reason: 'learning', amount: 1 }]);
      const persistedLearning = await studyInbox.wait<{ nodeIndex: number; rewardPointsGranted: number; attemptIds: string[] }>(
        'learning_persisted', (event) => event.nodeIndex === 0);
      expect(persistedLearning.rewardPointsGranted).toBeGreaterThan(0); expect(persistedLearning.attemptIds.length).toBeGreaterThan(0);
      expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(persistedLearning.rewardPointsGranted);
    }
    const strategy = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'strategy' && s.round === 1);
    if (queueType === 'ranked') {
      expect(MODE_BUDGETS.modes[mode].timeline[strategy.phaseIndex]!.duration).toBe(50);
      expect(strategy.remainingSeconds).toBeGreaterThan(49); expect(strategy.remainingSeconds).toBeLessThanOrEqual(50);
      expect(await studyInbox.command({ type: 'PICK_AUGMENT', slotIndex: 0 })).toMatchObject({ ok: false, reason: 'CHOICE_WINDOW_REQUIRED' });
      expect(strategy.self.shop[0]).toBe('S07');
      expect(strategy.self.units.filter((unit) => unit.unitId === 'S07' && unit.star === 1)).toHaveLength(2);
      const cost = SEASON1_UNITS_BY_ID.get(strategy.self.shop[0]!)!.cost;
      expect(await studyInbox.command({ type: 'BUY_CARD', shopIndex: 0 })).toMatchObject({ ok: true });
      const bought = await studyInbox.snapshot();
      expect(bought.self.gold).toBe(strategy.self.gold - cost); expect(bought.self.shop[0]).toBeNull();
      expect(bought.self.goldLedger.filter((entry) => entry.reason === 'buy_card')).toEqual([{ reason: 'buy_card', amount: -cost }]);
      const merged = bought.self.units.filter((unit) => unit.unitId === 'S07');
      expect(merged).toHaveLength(1); expect(merged[0]!.star).toBe(2);
      expect(bought.self.units).toHaveLength(strategy.self.units.length - 1);
      expect(await studyInbox.command({ type: 'MOVE_UNIT', instanceId: merged[0]!.instanceId, to: { zone: 'board', row: 0, col: 0 } })).toMatchObject({ ok: true });
      const moved = await studyInbox.snapshot();
      expect(moved.self.units.find((unit) => unit.instanceId === merged[0]!.instanceId)!.location).toEqual({ zone: 'board', row: 0, col: 0 });
      expect(moved.self.gold).toBe(bought.self.gold);
    }
    const beforeShop = strategy.self.shopLocked;
    const once = randomUUID();
    expect((await studyInbox.command({ type: 'TOGGLE_LOCK_SHOP' }, once)).ok).toBe(true);
    expect((await studyInbox.command({ type: 'TOGGLE_LOCK_SHOP' }, once)).ok).toBe(true);
    const protectedSeat = await studyInbox.snapshot();
    expect(protectedSeat.self.shopLocked).toBe(!beforeShop);
    await studyInbox.room.leave(); sockets.delete(studyInbox.room);
    studyInbox = await join(roomId, person.token); streams.push(studyInbox);
    const resumed = await studyInbox.snapshot();
    expect(resumed.seatId).toBe(seatId);
    expect(resumed.self.gold).toBe(protectedSeat.self.gold); expect(resumed.self.shop).toEqual(protectedSeat.self.shop);
    expect(resumed.self.units).toEqual(protectedSeat.self.units);
    const forgedId = randomUUID();
    const forgedReply = studyInbox.wait<CommandReply>('command_result', (r) => r.requestId === forgedId, studyInbox.messages.length);
    studyInbox.room.send('command', { requestId: forgedId, seatId: 'seat-7', command: { type: 'REFRESH_SHOP' } });
    expect(await forgedReply).toMatchObject({ ok: false, reason: 'INVALID_MESSAGE' });
    const battle = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'battle' && s.round === 1);
    const frozenGold = battle.self.gold;
    expect(await studyInbox.command({ type: 'BUY_XP' })).toMatchObject({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
    expect((await studyInbox.snapshot()).self.gold).toBe(frozenGold);
    if (queueType === 'ranked') {
      expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBeGreaterThan(0);
      const author = serializeCoursePackToAuthoring(englishPack);
      const draft = await ok<{ draftId: string }>('/api/admin/packs/compile-preview', adminToken, {
        meta: { ...author.meta, coursePackVersion: '2.1.0' }, csvSources: [{ file: 'questions.csv', text: author.csvText }],
        mdSources: [{ file: 'lessons.md', text: author.mdText }], createdAtIso: author.createdAtIso,
      });
      await ok('/api/admin/packs/publish', adminToken, { draftId: draft.draftId, activate: true });
      try {
        expect((await getCoursePack(db, englishPack.manifest.packId)).manifest.coursePackVersion).toBe('2.1.0');
        const laterNode = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'learning' && s.nodeIndex === 1);
        expect(laterNode.versionLock).toEqual(initial.versionLock);
      } finally {
        await ok('/api/admin/packs/activate', adminToken, { packId: englishPack.manifest.packId, version: englishPack.manifest.coursePackVersion });
      }
      const choice = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'choice' && s.round === 2);
      expect(choice.self.augmentOffer).not.toBeNull();
      expect(await studyInbox.command({ type: 'BUY_CARD', shopIndex: 0 })).toMatchObject({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
      expect((await studyInbox.snapshot()).self.gold).toBe(choice.self.gold);
      expect(await studyInbox.command({ type: 'REROLL_AUGMENT_SLOT', slotIndex: 0 })).toMatchObject({ ok: true });
      expect(await studyInbox.command({ type: 'PICK_AUGMENT', slotIndex: 0 })).toMatchObject({ ok: true });
      expect((await studyInbox.snapshot()).self.chosenAugments).toHaveLength(choice.self.chosenAugments.length + 1);
      const roundTwo = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'strategy' && s.round === 2);
      const roundThree = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'strategy' && s.round === 3);
      expect(roundTwo.resourceSettlement).toMatchObject({ nodeIndex: 1, rawEarnedCents: 0, carryInCents: 80, grantedIntegerGold: 0, carryOutCents: 80 });
      expect(roundThree.resourceSettlement).toEqual(roundTwo.resourceSettlement);
      expect(roundThree.self.learningChargeCents).toBe(80);
      expect(roundThree.self.goldLedger.filter((entry) => entry.reason === 'learning')).toEqual([{ reason: 'learning', amount: 1 }]);
      expect(roundThree.self.goldLedger.filter((entry) => entry.reason === 'learning')).toEqual(roundTwo.self.goldLedger.filter((entry) => entry.reason === 'learning'));
    }
    const summary = await studyInbox.wait<{ competitive: { finalBoardSnapshot: unknown; standing: unknown }; learning: { wrongQuestionIds: string[]; nodes: unknown[] } }>('summary', () => true, 0, 55_000);
    expect(summary.competitive).toBeTruthy(); expect(summary.learning).toBeTruthy();
    FinalBoardSnapshotSchema.parse(summary.competitive.finalBoardSnapshot);
    expect(summary.learning.nodes).toHaveLength(MODE_BUDGETS.modes[mode].learning.length);
    expect(summary.learning.wrongQuestionIds.length).toBeGreaterThan(0);
    if (queueType === 'ranked') expect(summary.competitive.standing).toMatchObject({ status: 'ranked', matchesPlayed: 1 });
    else expect(summary.competitive.standing).toBeNull();
    const exit = await studyInbox.wait<Snapshot>('snapshot', (s) => s.phase === 'exit');
    expect(exit.versionLock).toEqual(initial.versionLock); expect(exit.summary).toEqual(summary);
    const snapshots = streams.flatMap((stream) => stream.messages)
      .filter((message) => message.type === 'snapshot').map((message) => message.data as Snapshot);
    const indexes = [...new Set(snapshots.map((snapshot) => snapshot.phaseIndex))];
    expect(indexes).toEqual(MODE_BUDGETS.modes[mode].timeline.map((_, index) => index));
    const phases = indexes.map((index) => snapshots.find((s) => s.phaseIndex === index)!.phase);
    expect(phases).toEqual(MODE_BUDGETS.modes[mode].timeline.map((event) => event.kind));
    for (const snapshot of snapshots) {
      expect(snapshot.versionLock).toEqual(initial.versionLock); expect(snapshot.remainingSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(snapshot.deadlineEpochMs)).toBe(true); assertPrivateSnapshot(snapshot, queueType);
    }
    const persisted = await db.selectFrom('matches').selectAll().where('id', '=', matchId).executeTakeFirstOrThrow();
    expect(persisted.status).toBe('completed'); expect(persisted.duration_mode).toBe(mode); expect(persisted.completed_at).not.toBeNull();
    expect(persisted.course_pack_version).toBe(initial.versionLock.coursePackVersion);
    const participants = await db.selectFrom('match_participants').selectAll().where('match_id', '=', matchId).execute();
    expect(participants).toHaveLength(8);
    expect(participants.filter((p) => !p.is_bot)).toHaveLength(queueType === 'casual' ? 2 : 1);
    expect(participants.filter((p) => p.is_bot).every((p) => p.user_id === null)).toBe(true);
    for (const participant of participants) {
      FinalBoardSnapshotSchema.parse(participant.final_board_snapshot);
      expect(participant.final_rank).toBe(1 + participants.filter((otherSeat) => otherSeat.quarter_points > participant.quarter_points).length);
    }
    const own = participants.find((p) => p.user_id === person.profile.userId)!;
    expect(own.seat_id).toBe(seatId); expect(own.final_board_snapshot).toEqual(summary.competitive.finalBoardSnapshot);
    expect(own.wrong_question_ids).toEqual(summary.learning.wrongQuestionIds);
    const attempts = await db.selectFrom('learning_attempts').selectAll().where('user_id', '=', person.profile.userId).execute();
    expect(attempts.length).toBeGreaterThan(0); expect(attempts.every((a) => !a.is_offline_unverified)).toBe(true);
    expect(attempts.every((a) => a.course_pack_version === initial.versionLock.coursePackVersion)).toBe(true);
    expect((await getPrivateFsrsCards(db, person.profile.userId)).length).toBeGreaterThan(0);
    const standings = await db.selectFrom('mode_standings').selectAll().where('user_id', '=', person.profile.userId).execute();
    expect(standings).toHaveLength(queueType === 'ranked' ? 1 : 0);
    if (queueType === 'casual') {
      expect(await db.selectFrom('learning_attempts').select('id').where('user_id', '=', other.profile.userId).execute()).toEqual([]);
      expect(await getPrivateFsrsCards(db, other.profile.userId)).toEqual([]);
      expect((await ok<{ balance: number }>('/api/rewards/balance', other.token)).balance).toBe(0);
    }
    if (queueType === 'ranked') {
      expect(standings[0]!.duration_mode).toBe(mode);
      expect(inbox.messages.filter((message) => message.type === 'snapshot')).toHaveLength(staleSnapshotCount);
      expect(await ok('/api/matches/history', other.token)).toEqual([]);
      expect(await db.selectFrom('match_participants').select('seat_id').where('user_id', '=', other.profile.userId).execute()).toEqual([]);
      expect((await lobby(other)).match).toBeNull();
      const balanceBefore = (await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance;
      expect(balanceBefore).toBeGreaterThan(0);
      let direct = await ok<DirectState>('/api/learning/standalone/start', person.token, { mode: 'quick', nodeIndex: 0, selectedSubjects: ['english'] });
      const directFamilies = new Set<string>();
      for (let step = 0; step < 5; step++) {
        for (const question of direct.currentStep.questions) {
          directFamilies.add(englishPack.items.find((q) => q.questionId === question.questionId)!.familyId);
          await ok('/api/learning/standalone/submit', person.token, { sessionId: direct.sessionId, questionId: question.questionId, submission: answerFor(question.questionId) });
        }
        direct = step < 4
          ? await ok<DirectState>('/api/learning/standalone/submit', person.token, { sessionId: direct.sessionId, action: 'advance' })
          : await ok<DirectState>(`/api/learning/direct/sessions/${direct.sessionId}`, person.token);
      }
      const matchFamilies = new Set([...firstNodeQuestionIds].map((id) => englishPack.items.find((q) => q.questionId === id)!.familyId));
      expect(directFamilies.size).toBeGreaterThan(0); expect(directFamilies).toEqual(matchFamilies);
      expect(direct.completed).toBe(true); expect(direct.result!.rewardPointsGranted).toBe(0);
      expect((await ok<{ balance: number }>('/api/rewards/balance', person.token)).balance).toBe(balanceBefore);
    }
    const history = await ok<{ matchId: string; finalBoardSnapshot: unknown }[]>('/api/matches/history', person.token);
    expect(history).toHaveLength(1); expect(history[0]!.matchId).toBe(matchId); expect(history[0]!.finalBoardSnapshot).toEqual(own.final_board_snapshot);
    const returned = await ok<LobbyState>('/api/matches/return-to-prep', person.token, {});
    expect(returned.match).toBeNull(); expect(returned.prepRoom!.status).toBe('idle');
    expect(returned.prepRoom!.durationMode).toBe(mode);
    await ok('/api/lobby/leave', person.token, {});
    if (queueType !== 'solo') await ok('/api/lobby/leave', other.token, {});
  }, 90_000);
});

it('voids an unfinished authoritative match on real server shutdown without participants or ratings', async () => {
  const person=await account();
  await enter(person,'quick','solo');
  const selected=await ok<LobbyState>('/api/lobby/start',person.token,{});
  expect(selected.match).not.toBeNull();
  const matchId=selected.match!.matchId;
  expect((await db.selectFrom('matches').select('status').where('id','=',matchId).executeTakeFirstOrThrow()).status).toBe('active');
  await server.close();
  expect((await db.selectFrom('matches').select('status').where('id','=',matchId).executeTakeFirstOrThrow()).status).toBe('completed');
  expect(await db.selectFrom('match_participants').select('seat_id').where('match_id','=',matchId).execute()).toEqual([]);
  expect(await db.selectFrom('mode_standings').select('user_id').where('user_id','=',person.profile.userId).execute()).toEqual([]);
});
