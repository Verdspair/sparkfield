import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { ConfigurableCommunicationPolicy, type CommunicationEnvelope, type CoursePack, type DurationMode, type UserProfile } from '@pkg/contracts';
import { createAppServer } from '../src/index.js';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import { DEFAULT_SEASON_TERM_ID } from '../src/db/migrate.js';
import { getCoursePack } from '../src/db/repositories.js';
import type { CommunicationDelivery, LobbyState } from '../src/lobby/lobbyService.js';

const DATABASE_URL = 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const schema = `lobby_e2e_${randomUUID().replaceAll('-', '')}`;
const adminDb = createDatabase(DATABASE_URL);
const seasonTerm = DEFAULT_SEASON_TERM_ID;
const MATCH_WAIT_MS = 1600;
const policy = new ConfigurableCommunicationPolicy({ allowTextChat: true, allowSignalsAndEmotes: true });
const password = 'real-lobby-network-password';
interface Account { profile: UserProfile; token: string }
interface SdkRoom {
  roomId: string;
  onMessage(type: '*', callback: (type: string | number, data: unknown) => void): () => void;
  send(type: string, data?: unknown): void;
  leave(consented?: boolean): Promise<number>;
}
interface SdkClient { joinById(roomId: string, options: { token: string }): Promise<SdkRoom> }
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { Client } = clientRequire('@colyseus/sdk') as { Client: new (url: string) => SdkClient };
let db: AppDatabase;
let server: Awaited<ReturnType<typeof createAppServer>>;
let baseURL: string;
let pack: CoursePack;
const people: Account[] = [];
const sockets = new Set<SdkRoom>();

async function http<T>(path: string, person?: Account, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, { method,
    headers: { ...(person ? { authorization: `Bearer ${person.token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  expect(response.status, `${method} ${path}: ${text}`).toBeGreaterThanOrEqual(200);
  expect(response.status, `${method} ${path}: ${text}`).toBeLessThan(300);
  return JSON.parse(text) as T;
}
const state = (person: Account) => http<LobbyState>('/api/lobby/state', person);
async function party(members: Account[], mode: DurationMode = 'quick', queueType = 'ranked'): Promise<string> {
  const host = members[0]!;
  const entered = await http<LobbyState>('/api/lobby/enter-mode', host, { durationMode: mode, queueType, sharedSubject: 'english' });
  const code = entered.prepRoom!.roomCode;
  for (const member of members.slice(1)) await http('/api/lobby/join-code', member, { roomCode: code });
  await Promise.all(members.slice(1).map((member) => http('/api/lobby/ready', member, { ready: true })));
  return code;
}
async function waitForState(person: Account, predicate: (value: LobbyState) => boolean, timeout = 6000): Promise<LobbyState> {
  let current: LobbyState | undefined;
  await expect.poll(async () => { current = await state(person); return predicate(current); }, { interval: 25, timeout }).toBe(true);
  return current!;
}
async function declineAll(members: Account[]): Promise<void> {
  const states = await Promise.all(members.map(state));
  await Promise.all(members.map((person, index) => {
    const prompt = states[index]!.acceptPrompt;
    return prompt ? http('/api/lobby/accept-match', person, { ticketId: prompt.ticketId, accept: false }) : Promise.resolve();
  }));
  for (const member of members) {
    const current = await state(member);
    expect(current.acceptPrompt).toBeNull(); expect(current.match).toBeNull();
  }
  expect(await db.selectFrom('matches').select('id').execute()).toEqual([]);
  expect(await db.selectFrom('match_participants').select('seat_id').execute()).toEqual([]);
}
async function standing(person: Account, score: number, mode: DurationMode = 'quick'): Promise<void> {
  await db.insertInto('mode_standings').values({ season_term_id: seasonTerm, duration_mode: mode,
    user_id: person.profile.userId, mu: 25, sigma: 25 / 3, ordinal: 0, tier_label: '真实SQL历史夹具',
    rank_score: score, matches_played: 12 }).execute();
}
async function attempts(person: Account, count: number, correct: boolean, options: {
  createdAt?: Date; offline?: boolean; practice?: boolean; hinted?: boolean;
} = {}): Promise<void> {
  const question = pack.items.find((item) => item.stepRole === 'verification')!;
  await db.insertInto('learning_attempts').values(Array.from({ length: count }, () => ({
    id: randomUUID(), user_id: person.profile.userId, question_id: question.questionId,
    family_id: question.familyId, subject: question.subject, course_pack_version: pack.manifest.coursePackVersion,
    knowledge_node: question.knowledgeNode, is_correct: correct, is_offline_unverified: options.offline ?? false,
    created_at: options.createdAt ?? new Date(),
    answer_json: JSON.stringify({ stepRole: options.practice ? 'practice' : 'verification',
      submission: { answer: correct ? question.answerSpec : 'incorrect historical answer', hintUsed: options.hinted ?? false } }),
  }))).execute();
}
class Inbox {
  readonly messages: Array<{ type: string | number; data: Record<string, unknown> }> = [];
  private readonly listeners = new Set<() => void>();
  constructor(readonly room: SdkRoom) {
    room.onMessage('*', (type, data) => { this.messages.push({ type, data: data as Record<string, unknown> });
      for (const listener of [...this.listeners]) listener(); });
  }
  wait<T>(type: string, predicate: (value: T) => boolean, after: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.listeners.delete(check); reject(new Error(`No real socket ${type} reply`)); }, 5000);
      const check = () => {
        const message = this.messages.slice(after).find((entry) => entry.type === type && predicate(entry.data as T));
        if (message) { clearTimeout(timeout); this.listeners.delete(check); resolve(message.data as T); }
      };
      this.listeners.add(check); check();
    });
  }
  async communicate(payload: string): Promise<{ ok: boolean; msgId: string }> {
    const requestId = randomUUID();
    const response = this.wait<{ requestId: string; ok: boolean; msgId: string }>('communication_result',
      (value) => value.requestId === requestId, this.messages.length);
    this.room.send('communicate', { requestId, clientMsgId: randomUUID(), channel: 'match', targetId: this.room.roomId, kind: 'text', payload });
    return response;
  }
}

beforeAll(async () => {
  const version = await sql<{ server_version: string }>`show server_version`.execute(adminDb);
  expect(version.rows[0]?.server_version).toMatch(/^17\./);
  await sql.raw(`create schema ${schema}`).execute(adminDb);
  const url = new URL(DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
  db = createDatabase(url.toString());
  server = await createAppServer({ db, timeScale: 0.001, matchWaitMs: MATCH_WAIT_MS, acceptWaitMs: 3000,
    matchingWindow: { initialScoreGap: 40, widenPerSecond: 400, maxScoreGap: 300 },
    matchmakingScore: { recentAttemptLimit: 50, lookbackDays: 30, rankingWeight: 1, learningWeight: 1000 },
    communicationPolicy: policy });
  await db.updateTable('season_terms').set({ starts_at: new Date(Date.now() - 86_400_000), ends_at: new Date(Date.now() + 86_400_000) })
    .where('id', '=', seasonTerm).execute();
  server.app.log.level = 'warn';
  baseURL = await server.listen(0);
  expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/);
  for (let index = 0; index < 8; index++) {
    const username = `lobby_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const registered = await http<{ profile: UserProfile }>('/api/auth/register', undefined, { username, password, nickname: `匹配证据同学${index}` });
    const login = await http<{ token: string }>('/api/auth/login', undefined, { username, password });
    people.push({ profile: registered.profile, token: login.token });
  }
  pack = await getCoursePack(db, 'english-core-starter');
}, 30_000);
beforeEach(async () => {
  await db.deleteFrom('mode_standings').execute();
  const createdAt = new Date(Date.now() - 1000);
  await Promise.all(people.map(async (person) => {
    await attempts(person, 25, true, { createdAt });
    await attempts(person, 25, false, { createdAt });
  }));
});
afterEach(async () => {
  await Promise.all(people.map((person) => http('/api/lobby/leave', person, {})));
});
afterAll(async () => {
  await Promise.allSettled([...sockets].map((room) => room.leave()));
  if (server) await server.close();
  if (db) await db.destroy();
  await sql.raw(`drop schema if exists ${schema} cascade`).execute(adminDb);
  await adminDb.destroy();
}, 30_000);

describe('production lobby scoring with real PostgreSQL, HTTP and wall-clock windows', () => {
  it('uses the requested mode standing and never exposes private candidate scores over HTTP', async () => {
    const [a, b] = people as [Account, Account, ...Account[]];
    await standing(a, 1000); await standing(b, 1020);
    await standing(a, 2500, 'deep'); await standing(b, 300, 'deep');
    await party([a]); await party([b]);
    await http('/api/lobby/start', a, {}); await http('/api/lobby/start', b, {});
    const first = await waitForState(a, (value) => value.acceptPrompt !== null);
    const second = await state(b);
    expect(first.acceptPrompt!.totalCandidateHumans).toBe(2);
    expect(first.acceptPrompt!.ticketId).toBe(second.acceptPrompt!.ticketId);
    for (const tokenSeed of ['partyScore', 'rank_score', 'accuracy', 'learning_attempts', 'matchingScore']) expect(JSON.stringify(first)).not.toContain(tokenSeed);
    await declineAll([a, b]);
  }, 15_000);

  it('averages complete invited parties and immediately combines two nearby four-person parties', async () => {
    const values = [400, 1200, 1200, 1200, 1000, 1000, 1000, 1000];
    await Promise.all(people.map((person, index) => standing(person, values[index]!)));
    await party(people.slice(0, 4)); await party(people.slice(4));
    await http('/api/lobby/start', people[0]!, {}); await http('/api/lobby/start', people[4]!, {});
    const states = await Promise.all(people.map(state));
    expect(states.every((value) => value.acceptPrompt?.totalCandidateHumans === 8)).toBe(true);
    expect(new Set(states.map((value) => value.acceptPrompt!.ticketId)).size).toBe(1);
    expect(new Set(states.map((value) => value.prepRoom!.roomCode)).size).toBe(2);
    await declineAll(people);
  }, 15_000);

  it('uses real verified independent answer accuracy to keep equally ranked but distant learners apart', async () => {
    const [a, b] = people as [Account, Account, ...Account[]];
    await standing(a, 1000); await standing(b, 1000);
    await attempts(a, 50, false); await attempts(b, 50, true);
    await party([a]); await party([b]);
    await http('/api/lobby/start', a, {}); await http('/api/lobby/start', b, {});
    const first = await waitForState(a, (value) => value.acceptPrompt !== null);
    const second = await waitForState(b, (value) => value.acceptPrompt !== null);
    expect(first.acceptPrompt!.totalCandidateHumans).toBe(1); expect(second.acceptPrompt!.totalCandidateHumans).toBe(1);
    expect(first.acceptPrompt!.ticketId).not.toBe(second.acceptPrompt!.ticketId);
    await declineAll([a, b]);
  }, 15_000);

  it('uses only the latest fifty eligible attempts and excludes old, offline, practice and hinted evidence', async () => {
    const [a, b] = people as [Account, Account, ...Account[]];
    await standing(a, 1000); await standing(b, 500);
    await attempts(b, 50, false, { createdAt: new Date(Date.now() - 60_000) });
    await attempts(b, 50, true);
    await attempts(b, 20, false, { createdAt: new Date(), offline: true });
    await attempts(b, 20, false, { createdAt: new Date(), practice: true });
    await attempts(b, 20, false, { createdAt: new Date(), hinted: true });
    await attempts(b, 20, false, { createdAt: new Date(Date.now() - 40 * 86_400_000) });
    await party([a]); await party([b]);
    await http('/api/lobby/start', a, {}); await http('/api/lobby/start', b, {});
    const first = await waitForState(a, (value) => value.acceptPrompt !== null);
    expect(first.acceptPrompt!.totalCandidateHumans).toBe(2);
    expect(first.acceptPrompt!.ticketId).toBe((await state(b)).acceptPrompt!.ticketId);
    expect((await db.selectFrom('learning_attempts').select('id').where('user_id', '=', b.profile.userId).execute()).length).toBeGreaterThanOrEqual(230);
    await declineAll([a, b]);
  }, 15_000);

  it('opens a score window on real elapsed time and fills eight before the maximum wait', async () => {
    await Promise.all(people.map((person, index) => standing(person, index < 4 ? 1000 : 1200)));
    await party(people.slice(0, 4)); await party(people.slice(4));
    const started = Date.now();
    await http('/api/lobby/start', people[0]!, {}); await http('/api/lobby/start', people[4]!, {});
    expect((await state(people[0]!)).acceptPrompt).toBeNull();
    const formed = await waitForState(people[0]!, (value) => value.acceptPrompt !== null);
    expect(Date.now() - started).toBeGreaterThanOrEqual(350);
    expect(Date.now() - started).toBeLessThan(MATCH_WAIT_MS - 150);
    expect(formed.acceptPrompt!.totalCandidateHumans).toBe(8);
    expect((await state(people[4]!)).acceptPrompt!.ticketId).toBe(formed.acceptPrompt!.ticketId);
    await declineAll(people);
  }, 15_000);

  it('caps the score window and offers one-human bot-fill candidates at timeout instead of waiting forever', async () => {
    const [a, b] = people as [Account, Account, ...Account[]];
    await standing(a, 1000); await standing(b, 2000);
    await party([a]); await party([b]);
    const started = Date.now();
    await http('/api/lobby/start', a, {}); await http('/api/lobby/start', b, {});
    const first = await waitForState(a, (value) => value.acceptPrompt !== null);
    const second = await waitForState(b, (value) => value.acceptPrompt !== null);
    expect(Date.now() - started).toBeGreaterThanOrEqual(MATCH_WAIT_MS - 100);
    expect(Date.now() - started).toBeLessThan(MATCH_WAIT_MS + 3000);
    expect(first.acceptPrompt!.totalCandidateHumans).toBe(1); expect(second.acceptPrompt!.totalCandidateHumans).toBe(1);
    expect(first.acceptPrompt!.ticketId).not.toBe(second.acceptPrompt!.ticketId);
    await declineAll([a, b]);
    expect(await http('/api/matches/history', a)).toEqual([]); expect(await http('/api/matches/history', b)).toEqual([]);
  }, 15_000);

  it('shares HTTP block policy with a real solo Colyseus room and completes one human plus seven program bots', async () => {
    const [a, b] = people as [Account, Account, ...Account[]];
    const code = await party([a, b], 'quick', 'casual');
    await http('/api/lobby/blocked', a, { senderUserId: b.profile.userId, blocked: true });
    const prepMessage = await http<CommunicationDelivery>('/api/lobby/communicate', b, {
      clientMsgId: randomUUID(), channel: 'room', targetId: code, kind: 'text', payload: '真实房间消息',
      senderUserId: a.profile.userId, senderNickname: '不得信任客户端身份',
    });
    expect(prepMessage.message.senderUserId).toBe(b.profile.userId);
    expect(prepMessage.recipientUserIds).not.toContain(a.profile.userId);
    expect(await http<CommunicationEnvelope[]>('/api/lobby/communication', a)).toEqual([]);
    expect(policy.isSenderBlocked(a.profile.userId, b.profile.userId)).toBe(true);
    await http('/api/lobby/leave', b, {}); await http('/api/lobby/leave', a, {});
    await party([a], 'quick', 'solo');
    const selected = await http<LobbyState>('/api/lobby/start', a, {});
    expect(selected.acceptPrompt).toBeNull(); expect(selected.match).not.toBeNull();
    const sdk = new Client(baseURL.replace('http:', 'ws:'));
    const socket = await sdk.joinById(selected.match!.roomId, { token: a.token }); sockets.add(socket);
    const inbox = new Inbox(socket);
    await http('/api/lobby/blocked', a, { senderUserId: a.profile.userId, blocked: true });
    const blocked = await inbox.communicate('self-blocked through shared policy');
    expect(blocked.ok).toBe(true);
    expect(inbox.messages.filter((message) => message.type === 'communication' && message.data.msgId === blocked.msgId)).toEqual([]);
    await http('/api/lobby/blocked', a, { senderUserId: a.profile.userId, blocked: false });
    const delivered = await inbox.communicate('unblocked through shared policy');
    expect(delivered.ok).toBe(true);
    const received = inbox.messages.find((message) => message.type === 'communication' && message.data.msgId === delivered.msgId);
    expect(received?.data).toMatchObject({ senderUserId: a.profile.userId, payload: 'unblocked through shared policy' });
    await expect.poll(async () => (await db.selectFrom('matches').select('status').where('id', '=', selected.match!.matchId)
      .executeTakeFirst())?.status, { interval: 25, timeout: 15_000 }).toBe('completed');
    const participants = await db.selectFrom('match_participants').selectAll().where('match_id', '=', selected.match!.matchId).execute();
    expect(participants).toHaveLength(8);
    expect(participants.filter((participant) => !participant.is_bot).map((participant) => participant.user_id)).toEqual([a.profile.userId]);
    expect(participants.filter((participant) => participant.is_bot)).toHaveLength(7);
    expect(participants.filter((participant) => participant.is_bot).every((participant) => participant.user_id === null)).toBe(true);
    expect(await db.selectFrom('matches').select('id').execute()).toHaveLength(1);
    expect(await http('/api/matches/history', b)).toEqual([]);
    expect((await http<{ balance: number }>('/api/rewards/balance', a)).balance).toBe(0);
    await http('/api/matches/return-to-prep', a, {});
  }, 25_000);
});
