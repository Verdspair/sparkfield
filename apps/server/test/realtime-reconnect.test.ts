import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql } from 'kysely';
import { createAppServer } from '../src/index.js';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import type { ClientQuestionView, LessonStepKind } from '@pkg/contracts';
import type { RoundBattle, SeatState } from '@pkg/game-core';

interface ActionAck { requestId?: string; ok: boolean; reason?: string }
interface MatchRoomSnapshot {
  matchId: string; seatId: string; phase: string; round: number; self: SeatState;
  battle?: { round: number; battles: RoundBattle[] } | null;
  learning: { currentStep: LessonStepKind | null; clientQuestions: ClientQuestionView[];
    submittedQuestionIds: string[]; steps: { kind: LessonStepKind; corrections: unknown[] }[] } | null;
}
interface ConnectedMatchSocket {
  sessionId: string;
  sendCommand(command: { type: string; unitIds?: string[]; shopIndex?: number }): Promise<ActionAck>;
  sendLearningSubmit(questionId: string, submission: { answer: null; status: 'skipped'; questionId: string }): Promise<ActionAck>;
  sendLearningAdvance(): Promise<ActionAck>;
  leave(consented?: boolean): Promise<void>;
}
const clientSocketPath = '../../client/src/api/matchSocket.js';
const { connectAuthoritativeMatch } = await import(clientSocketPath) as {
  connectAuthoritativeMatch(roomId: string, token: string, handlers: {
    onSnapshot(snapshot: MatchRoomSnapshot): void;
    onCommandAck?(ack: ActionAck): void;
    onConnectionStateChange?(state: string): void;
    onActionPendingChange?(pending: boolean): void;
  }): Promise<ConnectedMatchSocket>;
};

interface Room {
  roomId: string;
  sessionId: string;
  reconnectionToken: string;
  reconnection: { enabled: boolean; minUptime: number; minDelay: number; maxDelay: number };
  send(type: string, payload?: unknown): void;
  leave(consented?: boolean): Promise<unknown>;
  onMessage(type: '*', handler: (type: string | number, payload: MatchRoomSnapshot) => void): void;
  onMessage<T>(type: string, handler: (payload: T) => void): void;
  onError(handler: (code: number, message?: string) => void): void;
  onDrop(handler: () => void): void;
}

const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { Client } = clientRequire('@colyseus/sdk') as {
  Client: new (url: string) => {
    joinById(roomId: string, options: { token: string }): Promise<Room>;
    reconnect(token: string): Promise<Room>;
  };
};
const databaseUrl = 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const schema = `realtime_reconnect_${randomUUID().replaceAll('-', '')}`;
const adminDb = createDatabase(databaseUrl);
let db: AppDatabase;
let server: Awaited<ReturnType<typeof createAppServer>>;
let origin: string;
const sockets = new Set<{ leave(consented?: boolean): Promise<unknown> }>();

function stream<T>() {
  const values: T[] = [];
  const listeners = new Set<() => void>();
  return {
    values,
    push(value: T) { values.push(value); for (const listener of [...listeners]) listener(); },
    wait(predicate: (value: T) => boolean = () => true, after = 0, timeoutMs = 3000): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.delete(check); reject(new Error('realtime event timed out')); }, timeoutMs);
        const check = () => {
          const value = values.slice(after).find(predicate);
          if (value !== undefined) { clearTimeout(timer); listeners.delete(check); resolve(value); }
        };
        listeners.add(check); check();
      });
    },
  };
}

async function startMatch() {
  const profile = await server.auth.register({ username: `reconnect_${randomUUID().replaceAll('-', '').slice(0, 18)}`,
    password: 'network-reconnect-test-password', nickname: '重连回归同学' });
  const { token } = await server.auth.login({ username: profile.username, password: 'network-reconnect-test-password' });
  await server.lobby.enterMode(profile, { durationMode: 'quick', queueType: 'solo', sharedSubject: 'english' });
  const lobby = await server.lobby.start(profile.userId);
  const room = server.matches.getRoom(lobby.match!.roomId)!;
  return { profile, token, room };
}

function drop(room: NonNullable<ReturnType<typeof server.matches.getRoom>>, sessionId: string) {
  const client = room.clients.find((candidate) => candidate.sessionId === sessionId)!;
  (client.ref as unknown as { terminate(): void }).terminate();
}

beforeAll(async () => {
  await sql.raw(`create schema ${schema}`).execute(adminDb);
  const url = new URL(databaseUrl); url.searchParams.set('options', `-c search_path=${schema}`);
  db = createDatabase(url.toString());
  server = await createAppServer({ db, gameSeed: 4, timeScale: 0.04, reconnectProtectionMs: 1000 });
  origin = await server.listen(0);
  vi.stubEnv('VITE_SERVER_ORIGIN', origin);
}, 30_000);

afterEach(async () => {
  await Promise.allSettled([...sockets].map((socket) => socket.leave(true)));
  sockets.clear();
});

afterAll(async () => {
  if (server) await server.close();
  if (db) await db.destroy();
  await sql.raw(`drop schema if exists ${schema} cascade`).execute(adminDb);
  await adminDb.destroy();
  vi.unstubAllEnvs();
}, 30_000);

describe('authoritative transport recovery on the real Colyseus listener', () => {
  it('recovers an early drop with the same seat, fresh snapshot and usable controller', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const states = stream<string>();
    const acks = stream<{ requestId?: string; ok: boolean }>();
    let socket: ConnectedMatchSocket;
    const blocked: string[] = [];
    socket = await connectAuthoritativeMatch(room.roomId, token, {
      onSnapshot: snapshots.push,
      onCommandAck: acks.push,
      onConnectionStateChange: (state) => {
        states.push(state);
        if (state === 'reconnecting') {
          void socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S09'] })
            .catch((error: Error) => blocked.push(error.message));
        }
      },
    });
    sockets.add(socket);
    const initial = await snapshots.wait();
    const after = snapshots.values.length;
    drop(room, socket.sessionId);
    await states.wait((state) => state === 'reconnecting');
    const restored = await snapshots.wait((snapshot) => snapshot.seatId === initial.seatId, after);
    expect(restored.matchId).toBe(initial.matchId);
    expect(room.clients.some((client) => client.sessionId === socket.sessionId)).toBe(true);
    expect(blocked).toEqual(['MATCH_CONNECTION_NOT_READY']);
    expect(await socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S01'] })).toMatchObject({ ok: true });
    expect((await snapshots.wait((snapshot) => snapshot.self.lineupPlan.includes('S01'), after)).self.lineupPlan).toEqual(['S01']);
  });

  it('rejects a second action until its acknowledgement and snapshot, then unlocks after success or rejection', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const pending = stream<boolean>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, {
      onSnapshot: snapshots.push, onActionPendingChange: pending.push,
    }); sockets.add(socket);
    await snapshots.wait();
    const first = socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S01'] });
    await expect(socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S02'] })).rejects.toThrow('MATCH_ACTION_PENDING');
    expect(await first).toMatchObject({ ok: true });
    expect(snapshots.values.at(-1)!.self.lineupPlan).toEqual(['S01']);
    await expect(socket.sendCommand({ type: 'BUY_CARD', shopIndex: 0 })).rejects.toThrow('STRATEGY_PHASE_REQUIRED');
    expect(await socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S06'] })).toMatchObject({ ok: true });
    expect(pending.values).toEqual([true, false, true, false, true, false]);
  });

  it('settles the action deadline and requires a fresh network snapshot before another action', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const states = stream<string>();
    const pending = stream<boolean>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, {
      onSnapshot: snapshots.push, onConnectionStateChange: states.push, onActionPendingChange: pending.push,
    }); sockets.add(socket);
    await snapshots.wait();
    const after = states.values.length;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const action = socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S01'] });
    vi.advanceTimersByTime(10_000);
    vi.useRealTimers();
    await expect(action).rejects.toThrow('MATCH_ACTION_TIMEOUT');
    expect(pending.values).toEqual([true, false]);
    await expect(socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S02'] })).rejects.toThrow('MATCH_CONNECTION_NOT_READY');
    await states.wait((state) => state === 'connected', after);
    expect(await socket.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S06'] })).toMatchObject({ ok: true });
  });

  it('expires a dropped reservation and lets a new connection reclaim the same human seat', async () => {
    const { token, room } = await startMatch();
    const sdk = new Client(origin);
    const old = await sdk.joinById(room.roomId, { token }); sockets.add(old);
    old.reconnection.enabled = false;
    const messages = stream<{ type: string | number; data: MatchRoomSnapshot }>();
    old.onMessage('*', (type, data) => messages.push({ type, data }));
    old.send('snapshot');
    const initial = (await messages.wait((message) => message.type === 'snapshot')).data;
    const reconnectToken = old.reconnectionToken;
    drop(room, old.sessionId);
    await expect.poll(() => room['bindings'].has(old.sessionId), { timeout: 2500, interval: 25 }).toBe(false);
    await expect(sdk.reconnect(reconnectToken)).rejects.toBeTruthy();
    const replacement = await sdk.joinById(room.roomId, { token }); sockets.add(replacement);
    const next = stream<MatchRoomSnapshot>();
    replacement.onMessage('snapshot', next.push); replacement.send('snapshot');
    expect((await next.wait()).seatId).toBe(initial.seatId);
    expect(replacement.sessionId).not.toBe(old.sessionId);
  });

  it('does not let a dropped session steal control back from a newer join', async () => {
    const { token, room } = await startMatch();
    const sdk = new Client(origin);
    const old = await sdk.joinById(room.roomId, { token }); sockets.add(old);
    old.reconnection.minUptime = 0;
    old.reconnection.minDelay = 500;
    old.reconnection.maxDelay = 500;
    const oldErrors = stream<string>();
    old.onError((_code, message) => oldErrors.push(message ?? ''));
    old.onMessage('*', () => undefined);
    const joined = stream<MatchRoomSnapshot>(); old.onMessage('snapshot', joined.push);
    old.send('snapshot'); await joined.wait();
    const dropped = stream<boolean>(); old.onDrop(() => dropped.push(true));
    drop(room, old.sessionId); await dropped.wait();
    const replacement = await sdk.joinById(room.roomId, { token }); sockets.add(replacement);
    replacement.onMessage('*', () => undefined);
    await oldErrors.wait((message) => message === 'SESSION_SUPERSEDED');
    const acks = stream<{ requestId?: string; ok: boolean }>();
    replacement.onMessage('command_result', acks.push);
    replacement.send('command', { requestId: 'new-controller', command: { type: 'SET_LINEUP_PLAN', unitIds: ['S06'] } });
    expect(await acks.wait((ack) => ack.requestId === 'new-controller')).toMatchObject({ ok: true });
  });

  it('keeps skipped resource evidence frozen while remediation advances to verification', async () => {
    const { token, room, profile } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: snapshots.push }); sockets.add(socket);
    let snapshot = await snapshots.wait((value) => value.phase === 'learning');
    const resourceIds: string[] = [];
    while (snapshot.learning?.currentStep !== 'remediation') {
      const learning = snapshot.learning!;
      if (learning.currentStep === 'material') await socket.sendLearningAdvance();
      else {
        for (const question of learning.clientQuestions.filter((value) => !learning.submittedQuestionIds.includes(value.questionId))) {
          if (learning.currentStep === 'resource_check') resourceIds.push(question.questionId);
          await socket.sendLearningSubmit(question.questionId, { answer: null, status: 'skipped', questionId: question.questionId });
        }
      }
      snapshot = snapshots.values.at(-1)!;
      expect(snapshot.phase).toBe('learning');
    }
    expect(resourceIds.length).toBeGreaterThan(0);
    expect(snapshot.learning!.steps.find((step) => step.kind === 'remediation')!.corrections.length).toBeGreaterThan(0);
    const submissions = room['lessons'].get(profile.userId)!.submissions;
    const frozen = Object.fromEntries(resourceIds.map((id) => [id, structuredClone(submissions[id])]));
    await socket.sendLearningAdvance();
    expect(snapshots.values.at(-1)!.learning!.currentStep).toBe('verification');
    for (const id of resourceIds) expect(submissions[id]).toEqual(frozen[id]);
    expect(room['learningTotals'].get(profile.userId)!.rewardPointsGranted).toBe(0);
  });

  it('includes the current battle in snapshots for a player who joins after its broadcast', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: snapshots.push }); sockets.add(socket);
    await snapshots.wait((snapshot) => snapshot.phase === 'battle', 0, 7000);
    await socket.leave(true); sockets.delete(socket);
    const restored = stream<MatchRoomSnapshot>();
    const replacement = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: restored.push }); sockets.add(replacement);
    const snapshot = await restored.wait();
    expect(snapshot.phase).toBe('battle');
    expect(snapshot.battle?.round).toBe(snapshot.round);
    expect(snapshot.battle?.battles.some((battle) => battle.leftSeatId === snapshot.seatId || battle.rightSeatId === snapshot.seatId)).toBe(true);
  }, 10_000);
});
