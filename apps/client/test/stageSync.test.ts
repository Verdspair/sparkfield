import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { createGame, finalizePrepDeadline, resolveRoundBattles } from '@pkg/game-core';
import type { MatchRoomSnapshot } from '../src/api/matchSocket.js';
import { LiveBattleChoreographer, SnapshotStageSynchronizer } from '../src/hud/stageSync.js';
import { BoardStageEngine, benchSlotToStageXZ, getSeatWorldOrigin, hexToStageXZ, SELL_ZONE_Z_THRESHOLD, type StageUnitState } from '../src/stage/index.js';

describe('live battle stage ownership', () => {
  it('enters battle mode and cancels a strategy interaction before the first combat frame', () => {
    const game = createGame('quick', 4);
    const home = game.seats[0]!;
    const snapshot = {
      roomId: 'stage-room', matchId: 'stage-match', mode: 'quick', queueType: 'solo', phase: 'strategy',
      phaseIndex: 3, deadlineEpochMs: Date.now() + 50_000, remainingSeconds: 50, round: 1, nodeIndex: 0,
      versionLock: { seasonTermId: 's1', gameSetVersion: 'v1', coursePackVersion: 'v1' }, seatId: home.id,
      self: structuredClone(home), seats: game.seats.map((seat) => ({ seatId: seat.id, nickname: seat.id,
        level: seat.level, units: structuredClone(seat.units), victoryPoints: 0, chosenAugments: [] })),
      learning: null, resourceSettlement: null, summary: null, completed: false, failure: null,
    } satisfies MatchRoomSnapshot;
    const stage = new BoardStageEngine();
    const choreographer = new LiveBattleChoreographer();
    try {
      new SnapshotStageSynchronizer().syncSnapshot(stage, snapshot);
      stage['selectedInstanceId'] = home.units[0]!.instanceId;
      stage['draggingInstanceId'] = home.units[0]!.instanceId;
      finalizePrepDeadline(game);
      const resolved = resolveRoundBattles(game);
      choreographer.start({ stage, snapshot: { ...snapshot, phase: 'battle', self: structuredClone(home) },
        battlePayload: { round: 1, battles: resolved.battles }, viewedSeatId: home.id, stageSeatIndex: 0 });
      expect(stage['currentPhase']).toBe('battle');
      expect(stage['draggingInstanceId']).toBeNull();
      expect(stage['selectedInstanceId']).toBeNull();
      expect(stage['canControlUnitsNow']()).toBe(false);
    } finally {
      choreographer.stop(); stage.dispose();
    }
  });
});

function scoutUnit(seatIndex: number, zone: 'board' | 'bench'): StageUnitState {
  return { instanceId: `${zone}-${seatIndex}`, unitId: 'S01', star: 1,
    allegiance: seatIndex === 0 ? 'ally' : 'enemy', seatIndex,
    location: zone === 'board' ? { zone, row: 0, col: 3, coordSpace: 'deploy4x7' } : { zone, slot: 4 },
    hp: 600, maxHp: 600, mana: 0, maxMana: 100 };
}

function projectedPoint(stage: BoardStageEngine, seatIndex: number, local: { x: number; z: number }) {
  const origin = getSeatWorldOrigin(seatIndex);
  const world = { x: origin.x + local.x, z: origin.z + local.z };
  const ndc = new Vector3(world.x, 0, world.z).project(stage['camera']);
  return { world, ndc, clientX: (ndc.x + 1) * 640, clientY: (1 - ndc.y) * 360 };
}

describe('scouted board picking uses the viewed seat coordinate space', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('resolves board, bench and sell-zone picks on seat %i without losing world coordinates', (seatIndex) => {
    const stage = new BoardStageEngine();
    try {
      stage.syncUnits(Array.from({ length: 8 }, (_, seat) => [scoutUnit(seat, 'board'), scoutUnit(seat, 'bench')]).flat());
      stage.scoutSeat(seatIndex); stage.stepManual(0.4);
      const board = projectedPoint(stage, seatIndex, hexToStageXZ(4, 3));
      const pick = stage.pickAtNdc(board.ndc.x, board.ndc.y);
      expect(pick).toMatchObject({ kind: 'board_hex', row: 4, col: 3, deployRow: 0, unitInstanceId: `board-${seatIndex}` });
      expect(pick.worldX).toBeCloseTo(board.world.x, 8);
      expect(pick.worldZ).toBeCloseTo(board.world.z, 8);
      const bench = projectedPoint(stage, seatIndex, benchSlotToStageXZ(4));
      expect(stage.pickAtNdc(bench.ndc.x, bench.ndc.y)).toMatchObject({ kind: 'bench_slot', slot: 4, unitInstanceId: `bench-${seatIndex}` });
      const sell = projectedPoint(stage, seatIndex, { x: 0, z: SELL_ZONE_Z_THRESHOLD + 1 });
      expect(stage.pickAtNdc(sell.ndc.x, sell.ndc.y).kind).toBe('sell_zone');
    } finally { stage.dispose(); }
  });

  it('inspects remote units without moving the selected home unit, then restores home picking and control', () => {
    const inspect = vi.fn(); const move = vi.fn();
    const stage = new BoardStageEngine(undefined, { callbacks: { onInspectUnit: inspect, onMoveUnit: move } });
    try {
      stage['container'] = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } as unknown as HTMLElement;
      stage.syncUnits([scoutUnit(0, 'board'), scoutUnit(2, 'board')]);
      stage['selectedInstanceId'] = 'board-0';
      stage.scoutSeat(2); stage.stepManual(0.4);
      const remote = projectedPoint(stage, 2, hexToStageXZ(4, 3));
      stage['handlePointerDown']({ button: 0, clientX: remote.clientX, clientY: remote.clientY } as PointerEvent);
      expect(inspect).toHaveBeenLastCalledWith('board-2', { x: remote.clientX, y: remote.clientY });
      expect(stage['canControlUnitsNow']()).toBe(false);
      expect(stage['draggingInstanceId']).toBeNull();
      expect(move).not.toHaveBeenCalled();
      stage.returnHome(); stage.stepManual(0.4);
      expect(stage.getActiveSeatIndex()).toBe(0);
      expect(stage['canControlUnitsNow']()).toBe(true);
      const home = projectedPoint(stage, 0, hexToStageXZ(4, 3));
      expect(stage.pickAtNdc(home.ndc.x, home.ndc.y)).toMatchObject({ kind: 'board_hex', unitInstanceId: 'board-0' });
      stage['handlePointerDown']({ button: 0, clientX: home.clientX, clientY: home.clientY } as PointerEvent);
      const target = projectedPoint(stage, 0, hexToStageXZ(5, 3));
      stage['handlePointerUp']({ button: 0, clientX: target.clientX, clientY: target.clientY } as PointerEvent);
      expect(move).toHaveBeenCalledExactlyOnceWith('board-0', { zone: 'board', row: 1, col: 3 }, { row: 5, col: 3 });
    } finally { stage['container'] = null; stage.dispose(); }
  });
});
