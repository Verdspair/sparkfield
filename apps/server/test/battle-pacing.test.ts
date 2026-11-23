import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODE_BUDGETS } from '@pkg/contracts';
import { createGame, getRoundPairings, type ResolvedRound } from '@pkg/game-core';
import { MatchRoom, type MatchRuntime } from '../src/rooms/matchRoom.js';

interface BattlePayload {
  round: number;
  battles: ResolvedRound['battles'];
  overtimeAtMs: number;
  longestBattleMs: number;
  startedAtEpochMs: number;
  timeScale: number;
}

function prepareRoom(withLongBattle: boolean): MatchRoom {
  const room = new MatchRoom();
  room.runtime = { timeScale: 0.5 } as MatchRuntime;
  room.game = createGame('quick', 4);
  room.phaseIndex = MODE_BUDGETS.modes.quick.timeline.findIndex(event => event.kind === 'battle') - 1;
  const [, lastPair] = getRoundPairings('quick', room.game.round, room.game.seatOrder);
  for (const seat of room.game.seats) {
    if (withLongBattle && lastPair!.includes(seat.id)) {
      const tank = seat.units[0]!;
      seat.units = [{ ...tank, unitId: 'S01', bonusHp: 10_000, location: { zone: 'bench', slot: 0 } }];
    } else seat.units = [];
  }
  return room;
}

const TRANSITION_CASES = [
  { name: 'all empty boards', withLongBattle: false, longestBattleMs: 50, expectedDurationMs: 2_800 },
  { name: 'one outlasting pair', withLongBattle: true, longestBattleMs: 45_000, expectedDurationMs: 46_800 },
];

describe('authoritative room battle barrier', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it.each(TRANSITION_CASES)('settles $name only at the computed room deadline', async ({ withLongBattle, longestBattleMs, expectedDurationMs }) => {
    vi.useFakeTimers();
    const room = prepareRoom(withLongBattle);
    let payload: BattlePayload | undefined;
    vi.spyOn(room, 'broadcast').mockImplementation((kind, message) => {
      if (kind === 'battle') payload = message as BattlePayload;
    });
    await room['transition']();
    expect(room.phase).toBe('battle');
    expect(room.game.phase).toBe('battle');
    expect(payload).toMatchObject({ round: 1, timeScale: 0.5, overtimeAtMs: 30_000, longestBattleMs });
    expect(payload!.battles.map(b => b.result.elapsedMs).sort((a, b) => b - a)).toEqual([longestBattleMs, 50, 50, 50]);
    if (withLongBattle) expect(payload!.battles.find(b => b.result.enteredOvertime)?.result.survivors.left).not.toHaveLength(0);
    const waitMs = expectedDurationMs * room.runtime.timeScale;
    expect(room.deadlineEpochMs).toBe(payload!.startedAtEpochMs + waitMs);
    await vi.advanceTimersByTimeAsync(waitMs - 1);
    expect(room.phase).toBe('battle');
    expect(room.game.settledRounds).toEqual([]);
    expect(room.game.round).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(room.phase).toBe('settlement');
    expect(room.game.settledRounds).toEqual([1]);
    await vi.advanceTimersByTimeAsync(MODE_BUDGETS.modes.quick.round_settle * 1000 * room.runtime.timeScale);
    expect(room.phase).toBe('learning');
    expect(room.game.round).toBe(2);
  });
});
