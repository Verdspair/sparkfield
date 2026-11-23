import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql } from 'kysely';
import { createAppServer } from '../src/index.js';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import type { ClientQuestionView, GameCommand, LearningArcMeta, LessonStepKind, SubjectId } from '@pkg/contracts';
import type { RoundBattle, SeatState } from '@pkg/game-core';

interface ActionAck { requestId?: string; ok: boolean; reason?: string }
interface MatchRoomSnapshot {
  matchId: string; seatId: string; phase: string; round: number; nodeIndex: number; deadlineEpochMs: number; self: SeatState;
  battle?: { round: number; battles: RoundBattle[] } | null;
  learning: { currentStep: LessonStepKind | null; complete?: boolean; clientQuestions: ClientQuestionView[]; arcMeta: LearningArcMeta;
    readyHumansCount: number; totalHumansCount: number;
    submittedQuestionIds: string[]; steps: { kind: LessonStepKind; corrections: unknown[] }[] } | null;
}
interface ConnectedMatchSocket {
  sessionId: string;
  sendCommand(command: GameCommand): Promise<ActionAck>;
  sendLearningSubmit(questionId: string, submission: { answer: string | null; status: 'submitted' | 'skipped' | 'timed_out'; questionId: string }): Promise<ActionAck>;
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

async function startMatch(sharedSubject: SubjectId = 'english') {
  const profile = await server.auth.register({ username: `reconnect_${randomUUID().replaceAll('-', '').slice(0, 18)}`,
    password: 'network-reconnect-test-password', nickname: '重连回归同学' });
  const { token } = await server.auth.login({ username: profile.username, password: 'network-reconnect-test-password' });
  await server.lobby.enterMode(profile, { durationMode: 'quick', queueType: 'solo', sharedSubject });
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

  it('allows buying and moving during entry but rejects both before learning is complete', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: snapshots.push });
    sockets.add(socket);
    const entry = await snapshots.wait();
    expect(entry.phase).toBe('entry');

    const instanceId = entry.self.units.find((unit) => unit.location.zone === 'bench')!.instanceId;
    const to = { zone: 'board', row: 0, col: 0 } as const;
    expect(await socket.sendCommand({ type: 'MOVE_UNIT', instanceId, to })).toMatchObject({ ok: true });
    expect(snapshots.values.at(-1)!.self.units.find((unit) => unit.instanceId === instanceId)?.location).toEqual(to);

    const shopIndex = entry.self.shop.findIndex((unit) => unit !== null);
    expect(await socket.sendCommand({ type: 'BUY_CARD', shopIndex })).toMatchObject({ ok: true });
    expect(snapshots.values.at(-1)).toMatchObject({ phase: 'entry' });
    expect(snapshots.values.at(-1)!.self.shop[shopIndex]).toBeNull();
    const learning = await snapshots.wait((snapshot) => snapshot.phase === 'learning');
    expect(learning.learning?.complete).toBe(false);
    const nextShopIndex = learning.self.shop.findIndex((unit) => unit !== null);
    await expect(socket.sendCommand({ type: 'BUY_CARD', shopIndex: nextShopIndex })).rejects.toThrow('STRATEGY_PHASE_REQUIRED');
    await expect(socket.sendCommand({ type: 'MOVE_UNIT', instanceId, to: { ...to, col: 1 } })).rejects.toThrow('STRATEGY_PHASE_REQUIRED');
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
    await expect(socket.sendCommand({ type: 'PICK_AUGMENT', slotIndex: 0 })).rejects.toThrow('CHOICE_WINDOW_REQUIRED');
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
    const { token, room, profile } = await startMatch('math');
    const snapshots = stream<MatchRoomSnapshot>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: snapshots.push }); sockets.add(socket);
    const intro = await snapshots.wait((value) => value.phase === 'learning' && value.nodeIndex === 0);
    const study = room['studies'].get(profile.userId)!;
    if (intro.learning!.currentStep === 'material') await socket.sendLearningAdvance();
    const first = snapshots.values.at(-1)!.learning!.clientQuestions[0]!;
    await socket.sendLearningSubmit(first.questionId, { answer: '__wrong__', status: 'submitted', questionId: first.questionId });
    expect(study.attempts).toEqual([{ questionId: first.questionId, familyId: first.familyId, isCorrect: false, slotInArc: 0 }]);
    let snapshot = await snapshots.wait((value) => value.phase === 'learning' && value.nodeIndex === 2, 0, 22_000);
    expect(snapshot.learning!.arcMeta).toMatchObject({ stageKind: 'remediate', adaptiveBranch: 'remediation_inserted' });
    const resourceIds: string[] = [];
    while (snapshot.learning?.currentStep !== 'remediation') {
      const learning = snapshot.learning!;
      if (learning.currentStep === 'material') await socket.sendLearningAdvance();
      else {
        for (const question of learning.clientQuestions.filter((value) => !learning.submittedQuestionIds.includes(value.questionId))) {
          if (learning.currentStep === 'resource_check') resourceIds.push(question.questionId);
          await socket.sendLearningSubmit(question.questionId, { answer: null,
            status: resourceIds.length === 1 ? 'timed_out' : 'skipped', questionId: question.questionId });
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
    expect(study.attempts.map((attempt) => attempt.questionId)).toEqual([first.questionId]);
    expect(resourceIds.every((id) => study.usedQuestionIds.has(id))).toBe(true);
    expect(room['learningTotals'].get(profile.userId)!.rewardPointsGranted).toBe(0);
  }, 28_000);

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

  it('keeps the solo room in learning after the human finishes, then opens shared resources', async () => {
    const { token, room } = await startMatch();
    const snapshots = stream<MatchRoomSnapshot>();
    const socket = await connectAuthoritativeMatch(room.roomId, token, { onSnapshot: snapshots.push }); sockets.add(socket);
    let snapshot = await snapshots.wait((s) => s.phase === 'learning' && Boolean(s.learning), 0, 5000);
    const deadline = room.deadlineEpochMs;
    while (snapshot.phase === 'learning' && snapshot.learning && !snapshot.learning.complete) {
      const lrn = snapshot.learning;
      if (lrn.currentStep === 'material' || lrn.currentStep === 'remediation') {
        await socket.sendLearningAdvance();
      } else {
        for (const q of lrn.clientQuestions.filter((item) => !lrn.submittedQuestionIds.includes(item.questionId))) {
          await socket.sendLearningSubmit(q.questionId, { answer: null, status: 'skipped', questionId: q.questionId });
        }
      }
      snapshot = snapshots.values.at(-1)!;
    }
    expect(snapshot).toMatchObject({ phase: 'learning', learning: { complete: true } });
    expect(room.deadlineEpochMs).toBe(deadline);
    const resourceSnap = await snapshots.wait((s) => s.phase === 'resource' && s.nodeIndex === snapshot.nodeIndex, 0, 5000);
    expect(resourceSnap.phase).toBe('resource');
  }, 12_000);

  it('allows an online player who finished learning to enter strategy actions immediately without waiting for other humans', async () => {
    const p1 = await server.auth.register({ username: `early_a_${randomUUID().replaceAll('-', '').slice(0, 12)}`, password: 'early-test-password', nickname: '甲' });
    const p2 = await server.auth.register({ username: `early_b_${randomUUID().replaceAll('-', '').slice(0, 12)}`, password: 'early-test-password', nickname: '乙' });
    const t1 = (await server.auth.login({ username: p1.username, password: 'early-test-password' })).token;
    const t2 = (await server.auth.login({ username: p2.username, password: 'early-test-password' })).token;
    const u1 = { profile: p1, token: t1 };
    const u2 = { profile: p2, token: t2 };
    const basePref = { subject: 'english' as const, learningStartSelections: {}, preferredArena: 'orbital_elevator_port' as const, displaySettings: { fullscreen: false, orientation: 'landscape' as const } };
    const created = await server.matches.createMatch({
      ticketId: randomUUID(),
      prepRoomCodes: [],
      durationMode: 'quick',
      queueType: 'casual',
      sharedSubject: 'english',
      humans: [u1.profile, u2.profile],
      humanPrefs: { [u1.profile.userId]: basePref, [u2.profile.userId]: basePref },
    });
    const room = server.matches.getRoom(created.roomId)!;
    const s1 = stream<MatchRoomSnapshot>();
    const s2 = stream<MatchRoomSnapshot>();
    const sock1 = await connectAuthoritativeMatch(room.roomId, u1.token, { onSnapshot: s1.push }); sockets.add(sock1);
    const sock2 = await connectAuthoritativeMatch(room.roomId, u2.token, { onSnapshot: s2.push }); sockets.add(sock2);

    let snap1 = await s1.wait((s) => s.phase === 'learning' && Boolean(s.learning), 0, 5000);
    const otherAtStart = await s2.wait((s) => s.phase === 'learning' && Boolean(s.learning), 0, 5000);
    const afterStart = s2.values.length;

    while (snap1.phase === 'learning' && snap1.learning && !snap1.learning.complete) {
      const lrn = snap1.learning;
      if (lrn.currentStep === 'material' || lrn.currentStep === 'remediation') {
        await sock1.sendLearningAdvance();
      } else {
        for (const q of lrn.clientQuestions.filter((item) => !lrn.submittedQuestionIds.includes(item.questionId))) {
          await sock1.sendLearningSubmit(q.questionId, { answer: null, status: 'skipped', questionId: q.questionId });
        }
      }
      snap1 = s1.values.at(-1)!;
    }
    expect(snap1.phase).toBe('learning');
    expect(snap1.learning?.complete).toBe(true);
    const otherWaiting = await s2.wait((s) => s.phase === 'learning' && s.learning?.readyHumansCount === 1, afterStart);
    expect(otherWaiting).toMatchObject({ deadlineEpochMs: otherAtStart.deadlineEpochMs,
      learning: { complete: false, readyHumansCount: 1, totalHumansCount: 8 } });

    const shopIndex = snap1.self.shop.findIndex((unit) => unit !== null);
    expect(await sock1.sendCommand({ type: 'BUY_CARD', shopIndex })).toMatchObject({ ok: true });
    const afterBuy = s1.values.at(-1)!;
    expect(afterBuy.phase).toBe('learning');
    expect(afterBuy.self.shop[shopIndex]).toBeNull();
    const instanceId = afterBuy.self.units.find((unit) => unit.location.zone === 'bench')!.instanceId;
    const to = { zone: 'board', row: 0, col: 0 } as const;
    expect(await sock1.sendCommand({ type: 'MOVE_UNIT', instanceId, to })).toMatchObject({ ok: true });
    const afterMove = s1.values.at(-1)!;
    expect(afterMove.phase).toBe('learning');
    expect(afterMove.self.units.find((unit) => unit.instanceId === instanceId)?.location).toEqual(to);
    await expect(sock2.sendCommand({ type: 'BUY_XP' })).rejects.toThrow('STRATEGY_PHASE_REQUIRED');

    let snap2 = s2.values.at(-1)!;
    while (snap2.phase === 'learning' && snap2.learning && !snap2.learning.complete) {
      const lrn = snap2.learning;
      if (lrn.currentStep === 'material' || lrn.currentStep === 'remediation') {
        await sock2.sendLearningAdvance();
      } else {
        for (const q of lrn.clientQuestions.filter((item) => !lrn.submittedQuestionIds.includes(item.questionId))) {
          await sock2.sendLearningSubmit(q.questionId, { answer: null, status: 'skipped', questionId: q.questionId });
        }
      }
      snap2 = s2.values.at(-1)!;
    }
    const [resource1, resource2] = await Promise.all([s1, s2].map((snapshots) =>
      snapshots.wait((s) => s.phase === 'resource' && s.nodeIndex === 0, 0, 5000)));
    expect(resource1!.deadlineEpochMs).toBe(resource2!.deadlineEpochMs);
    const [gold1, gold2] = [u1, u2].map(user => room['settlements'].get(user.profile.userId)?.[0]);
    expect(gold1).toMatchObject({ nodeIndex: 0, centBudget: 700, verificationWeightPercent: 0 });
    expect(gold2).toMatchObject({ nodeIndex: 0, centBudget: 700, verificationWeightPercent: 0 });
  }, 15_000);

  it('clears stale lobby match state and unlocks prep room after a match room disposes', async () => {
    const { profile, room } = await startMatch();
    const busy = await server.lobby.getState(profile.userId);
    expect(busy.match?.roomId).toBe(room.roomId);
    expect(busy.prepRoom?.status).toBe('in_match');

    await room.disconnect();

    const recovered = await server.lobby.getState(profile.userId);
    expect(recovered.match).toBeNull();
    expect(recovered.prepRoom?.status).toBe('idle');

    const updated = await server.lobby.updateSettings(profile.userId, {
      durationMode: 'standard',
      queueType: 'solo',
      sharedSubject: 'english',
    });
    expect(updated.prepRoom?.durationMode).toBe('standard');
    expect(updated.prepRoom?.status).toBe('idle');
  });
});
