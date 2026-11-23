import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { SEASON1_UNITS, type ArenaThemeId } from '@pkg/contracts';
import { createGame, finalizePrepDeadline, resolveRoundBattles, runCombat } from '@pkg/game-core';
import type { MatchRoomSnapshot } from '../src/api/matchSocket.js';
import { LiveBattleChoreographer, SnapshotStageSynchronizer } from '../src/hud/stageSync.js';
import {
  BENCH_Z_OFFSET,
  BoardStageEngine,
  PbrMaterialLibrary,
  SELL_ZONE_Z_THRESHOLD,
  TACTICIAN_IDS,
  UnitMeshFactory,
  benchSlotToStageXZ,
  clearPortraitCache,
  createTacticianRig,
  getArenaPreviewUrl,
  getSeatWorldOrigin,
  getTacticianPortraitUrl,
  getUnitPortraitUrl,
  hexToStageXZ,
  prebakePortraitsAsync,
  type StageUnitState,
} from '../src/stage/index.js';

describe('live battle stage ownership', () => {
  it('catches up to the shared battle start and replays the exact result through 45 seconds', async () => {
    vi.useFakeTimers();
    const game = createGame('quick', 4);
    const [left, right] = game.seats;
    for (const seat of [left!, right!]) {
      seat.units = [{ ...seat.units[0]!, unitId: 'S01', bonusHp: 10_000, location: { zone: 'board', row: 0, col: 3 } }];
    }
    const result = runCombat(left!, right!, 'quick', 123);
    const startedAtEpochMs = Date.now() - 19_950;
    const snapshot = {
      roomId: 'stage-room', matchId: 'stage-match', mode: 'quick', queueType: 'solo', phase: 'battle',
      phaseIndex: 4, deadlineEpochMs: startedAtEpochMs + 46_800, remainingSeconds: 26.85, round: 1, nodeIndex: 0,
      versionLock: { seasonTermId: 's1', gameSetVersion: 'v1', coursePackVersion: 'v1' }, seatId: left!.id,
      self: left!, seats: [left!, right!].map(seat => ({ seatId: seat.id, nickname: seat.id,
        level: seat.level, units: seat.units, victoryPoints: 0, chosenAugments: seat.chosenAugments })),
      learning: null, resourceSettlement: null, summary: null, completed: false, failure: null,
    } satisfies MatchRoomSnapshot;
    const stage = {
      setPhase: vi.fn(), syncUnits: vi.fn(), playUnitSkillCast: vi.fn(), playUnitAttack: vi.fn(),
      triggerUnitHit: vi.fn(), spawnDamageNumber: vi.fn(), triggerTacticianEmote: vi.fn(),
    } as unknown as BoardStageEngine;
    const choreographer = new LiveBattleChoreographer();
    const onTelemetry = vi.fn();
    try {
      choreographer.start({ stage, snapshot, viewedSeatId: left!.id, stageSeatIndex: 0, onTelemetry,
        battlePayload: { round: 1, overtimeAtMs: 30_000, longestBattleMs: result.elapsedMs, startedAtEpochMs,
          battles: [{ leftSeatId: left!.id, rightSeatId: right!.id, pve: false, result }] } });
      expect(choreographer['combat']?.elapsedMs).toBe(19_950);
      await vi.advanceTimersByTimeAsync(10_050);
      expect(choreographer['combat']?.elapsedMs).toBe(30_000);
      expect(choreographer['combat']?.result).toBeNull();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(choreographer['combat']?.result).toEqual(result);
      expect(result).toMatchObject({ elapsedMs: 45_000, enteredOvertime: true, outcome: 'draw' });
      expect(onTelemetry).toHaveBeenLastCalledWith(result.telemetry);
      expect(choreographer['timer']).toBeNull();
    } finally { choreographer.stop(); vi.useRealTimers(); }
  });

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

describe('dual-scene starport showcase, 3 tacticians, zero-occlusion camera, 36 bespoke units, and portrait baker', () => {
  it('switches across splash, lobby, prep, subpage, and match modes with interactive turntable & emotes', () => {
    const onTap = vi.fn();
    const stage = new BoardStageEngine(undefined, {
      initialSceneMode: 'splash',
      callbacks: { onTacticianTap: onTap },
    });
    try {
      expect(stage.getSceneMode()).toBe('splash');
      stage.stepManual(0.5);
      stage.skipSplashIntro();
      stage.stepManual(0.1);
      expect(stage.getLobbyStage().isSplashCompleted()).toBe(true);

      stage.setSceneMode('lobby');
      expect(stage.getSceneMode()).toBe('lobby');
      stage['handlePointerDown']({ button: 0, clientX: 600, clientY: 360 } as PointerEvent);
      stage['handlePointerMove']({ clientX: 720, clientY: 360 } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: 720, clientY: 360 } as PointerEvent);
      stage.stepManual(0.2);
      expect(Math.abs(stage.getLobbyStage().getTacticianYaw())).toBeGreaterThan(0.2);

      for (let i = 0; i < 30; i += 1) {
        stage.stepManual(0.15);
      }
      expect(Math.abs(stage.getLobbyStage().getTacticianYaw())).toBeLessThan(0.08);

      stage['handlePointerDown']({ button: 0, clientX: 640, clientY: 360 } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: 642, clientY: 360 } as PointerEvent);
      expect(onTap).toHaveBeenCalledWith('tactician_lumina_bell', 0);

      stage.setSceneMode('prep');
      for (let i = 0; i < 20; i += 1) {
        stage.stepManual(0.05);
      }
      expect(stage.getLobbyStage().camera.position.x).toBeGreaterThan(1.8);

      stage.setSceneMode('subpage');
      expect(stage.getPerfStats().sceneMode).toBe('subpage');

      stage.setSceneMode('match');
      expect(stage.getSceneMode()).toBe('match');
    } finally {
      stage.dispose();
    }
  });

  it('builds and hot-swaps all 3 original tacticians cleanly', () => {
    const materials = new PbrMaterialLibrary();
    const stage = new BoardStageEngine(undefined, { initialSceneMode: 'match' });
    try {
      for (const tid of TACTICIAN_IDS) {
        const rig = createTacticianRig(tid, materials);
        expect(rig.id).toBe(tid);
        expect(rig.triggerEmote('tap')).toBe(0);
        expect(rig.triggerEmote('cheer')).toBe(1);
        expect(rig.triggerEmote('collect_orb')).toBe(0);
        rig.update(0.05, 1.2);
        rig.dispose();

        stage.setTactician(tid);
        expect(stage.getTacticianId()).toBe(tid);
        stage.triggerTacticianEmote('cheer');
        stage.stepManual(0.05);
      }
      stage.syncLootOrbs([{ orbId: 'orb-1', goldAmount: 3, row: 5, col: 3 }]);
      expect(stage.collectLootOrb('orb-1')).toBe(true);
      stage.stepManual(0.2);
    } finally {
      stage.dispose();
      materials.dispose();
    }
  });

  it('positions 9 bench slots strictly above bottom shop in bottom_open mode and shifts cleanly in top_or_collapsed mode', () => {
    const stage = new BoardStageEngine(undefined, {
      initialSceneMode: 'match',
      initialShopCameraLayout: 'bottom_open',
    });
    try {
      stage.setShopCameraLayout('bottom_open', true);
      const benchTopNdc = new Vector3(0, 0, BENCH_Z_OFFSET - 0.65).project(stage.camera);
      const benchBotNdc = new Vector3(0, 0, BENCH_Z_OFFSET + 0.65).project(stage.camera);
      const benchTopPct = (1 - benchTopNdc.y) * 50;
      const benchBotPct = (1 - benchBotNdc.y) * 50;
      expect(benchTopPct).toBeGreaterThan(69.5);
      expect(benchTopPct).toBeLessThan(72.5);
      expect(benchBotPct).toBeGreaterThan(78.0);
      expect(benchBotPct).toBeLessThan(81.0);

      const landmarkNdc = new Vector3(0, -0.55, -10.4).project(stage.camera);
      const landmarkPct = (1 - landmarkNdc.y) * 50;
      expect(landmarkPct).toBeGreaterThan(3.0);
      expect(landmarkPct).toBeLessThan(15.0);

      stage.setShopCameraLayout('top_or_collapsed', true);
      const collapsedTopPct = (1 - new Vector3(0, 0, BENCH_Z_OFFSET - 0.65).project(stage.camera).y) * 50;
      const collapsedBotPct = (1 - new Vector3(0, 0, BENCH_Z_OFFSET + 0.65).project(stage.camera).y) * 50;
      expect(collapsedTopPct).toBeGreaterThan(81.0);
      expect(collapsedBotPct).toBeLessThan(94.5);

      const themes: ArenaThemeId[] = [
        'orbital_elevator_port',
        'mercury_dyson_forge',
        'event_horizon_observatory',
      ];
      for (const theme of themes) {
        stage.setArenaTheme(theme);
        expect(stage.getArenaTheme()).toBe(theme);
        stage.setGoldAndCharge(50);
        stage.stepManual(0.05);
      }
    } finally {
      stage.dispose();
    }
  });

  it('constructs bespoke 3D models for all 36 Season 1 units and supports 1-3 star scaling', () => {
    const materials = new PbrMaterialLibrary();
    const factory = new UnitMeshFactory(materials);
    try {
      const registered = new Set(factory.getRegisteredBespokeUnitIds());
      expect(SEASON1_UNITS.length).toBe(36);
      for (const unit of SEASON1_UNITS) {
        expect(registered.has(unit.id)).toBe(true);
        const rig = factory.createUnitRig(`test-${unit.id}`, unit.id, 1, 'ally');
        expect(rig.scaleSpring.value).toBeCloseTo(1.0, 2);
        rig.applyStarTier(2);
        expect(rig.scaleSpring.target).toBeCloseTo(1.14, 2);
        rig.applyStarTier(3);
        expect(rig.scaleSpring.target).toBeCloseTo(1.30, 2);
        rig.update(0.05, 1.0);
        rig.dispose();
      }
    } finally {
      factory.dispose();
      materials.dispose();
    }
  });

  it('produces synchronous SVG DataURL portraits for all 36 units, 3 tacticians, and 3 arenas without WebGL errors', async () => {
    clearPortraitCache();
    await prebakePortraitsAsync({ size: 512, includeArenas: true });

    for (const unit of SEASON1_UNITS) {
      const url = getUnitPortraitUrl(unit.id, { size: 512 });
      expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      expect(decodeURIComponent(url)).toContain(unit.name);
    }

    for (const tid of TACTICIAN_IDS) {
      const url = getTacticianPortraitUrl(tid, { size: 512 });
      expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    }

    for (const theme of [
      'orbital_elevator_port',
      'mercury_dyson_forge',
      'event_horizon_observatory',
    ] as const) {
      const url = getArenaPreviewUrl(theme, { size: 512 });
      expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    }
  });

  it('walks the tactician to clicked loot orbs, auto-collects along empty-hex walks, and auto-sweeps on battle transition', () => {
    const collected: { id: string; gold: number }[] = [];
    const stage = new BoardStageEngine(undefined, {
      initialSceneMode: 'match',
      callbacks: {
        onCollectLootOrb: (id, gold) => collected.push({ id, gold }),
      },
    });
    try {
      stage['container'] = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
      } as unknown as HTMLElement;

      stage.syncLootOrbs([
        { orbId: 'orb-a', goldAmount: 2, row: 5, col: 2 },
        { orbId: 'orb-b', goldAmount: 3, row: 5, col: 4 },
        { orbId: 'orb-c', goldAmount: 2, row: 6, col: 5 },
      ]);
      for (let i = 0; i < 30; i += 1) {
        stage.stepManual(0.05);
      }

      const startPos = stage.getTacticianWorldPos();
      const orbAPos = stage.getLootOrbWorldPos('orb-a')!;
      expect(orbAPos).not.toBeNull();

      const orbANdc = new Vector3(orbAPos.x, 0.44, orbAPos.z).project(stage.camera);
      stage['handlePointerDown']({
        button: 0,
        clientX: (orbANdc.x + 1) * 640,
        clientY: (1 - orbANdc.y) * 360,
      } as PointerEvent);

      expect(collected.length).toBe(0);

      for (let i = 0; i < 45; i += 1) {
        stage.stepManual(0.04);
      }

      const afterOrbAPos = stage.getTacticianWorldPos();
      expect(Math.hypot(afterOrbAPos.x - startPos.x, afterOrbAPos.z - startPos.z)).toBeGreaterThan(2.0);
      expect(Math.hypot(afterOrbAPos.x - orbAPos.x, afterOrbAPos.z - orbAPos.z)).toBeLessThan(1.2);
      expect(collected).toContainEqual({ id: 'orb-a', gold: 2 });

      const destHex = hexToStageXZ(5, 5);
      const destPt = projectedPoint(stage, 0, destHex);
      stage['handlePointerDown']({
        button: 0,
        clientX: destPt.clientX,
        clientY: destPt.clientY,
      } as PointerEvent);

      for (let i = 0; i < 45; i += 1) {
        stage.stepManual(0.04);
      }
      expect(collected).toContainEqual({ id: 'orb-b', gold: 3 });

      stage.setPhase('battle');
      for (let i = 0; i < 20; i += 1) {
        stage.stepManual(0.04);
      }
      expect(collected).toContainEqual({ id: 'orb-c', gold: 2 });
    } finally {
      stage['container'] = null;
      stage.dispose();
    }
  });

  it('toggles inspect on repeat click, switches inspect without swapping on clicking another unit, moves to empty hex on click, and swaps on drag', () => {
    const inspect = vi.fn();
    const move = vi.fn();
    const stage = new BoardStageEngine(undefined, { callbacks: { onInspectUnit: inspect, onMoveUnit: move } });
    try {
      stage['container'] = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } as unknown as HTMLElement;
      stage.setSceneMode('match');
      stage.setPhase('strategy');
      const unitA: StageUnitState = {
        instanceId: 'ally-a',
        unitId: 'S01',
        star: 1,
        allegiance: 'ally',
        seatIndex: 0,
        location: { zone: 'board', row: 0, col: 1, coordSpace: 'deploy4x7' },
        hp: 600,
        maxHp: 600,
        mana: 0,
        maxMana: 60,
        items: [],
      };
      const unitB: StageUnitState = {
        ...unitA,
        instanceId: 'ally-b',
        unitId: 'S02',
        location: { zone: 'board', row: 0, col: 4, coordSpace: 'deploy4x7' },
      };
      stage.syncUnits([unitA, unitB]);
      stage.stepManual(0.2);

      const ptA = projectedPoint(stage, 0, hexToStageXZ(4, 1));
      const ptB = projectedPoint(stage, 0, hexToStageXZ(4, 4));
      const ptEmpty = projectedPoint(stage, 0, hexToStageXZ(5, 2));

      stage['handlePointerDown']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      expect(inspect).toHaveBeenLastCalledWith('ally-a', { x: ptA.clientX, y: ptA.clientY });
      expect(move).not.toHaveBeenCalled();

      stage['handlePointerDown']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      expect(inspect).toHaveBeenLastCalledWith(null);
      expect(move).not.toHaveBeenCalled();

      stage['handlePointerDown']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      expect(inspect).toHaveBeenLastCalledWith('ally-a', { x: ptA.clientX, y: ptA.clientY });

      stage['handlePointerDown']({ button: 0, clientX: ptB.clientX, clientY: ptB.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptB.clientX, clientY: ptB.clientY } as PointerEvent);
      expect(inspect).toHaveBeenLastCalledWith('ally-b', { x: ptB.clientX, y: ptB.clientY });
      expect(move).not.toHaveBeenCalled();

      stage['handlePointerDown']({ button: 0, clientX: ptEmpty.clientX, clientY: ptEmpty.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptEmpty.clientX, clientY: ptEmpty.clientY } as PointerEvent);
      expect(move).toHaveBeenCalledTimes(1);
      expect(move).toHaveBeenLastCalledWith('ally-b', { zone: 'board', row: 1, col: 2 }, { row: 5, col: 2 });
      expect(inspect).toHaveBeenLastCalledWith(null);

      stage['handlePointerDown']({ button: 0, clientX: ptA.clientX, clientY: ptA.clientY } as PointerEvent);
      stage['handlePointerMove']({ clientX: ptB.clientX, clientY: ptB.clientY } as PointerEvent);
      stage['handlePointerUp']({ button: 0, clientX: ptB.clientX, clientY: ptB.clientY } as PointerEvent);
      expect(move).toHaveBeenCalledTimes(2);
      expect(move).toHaveBeenLastCalledWith('ally-a', { zone: 'board', row: 0, col: 4 }, { row: 4, col: 4 });
    } finally {
      stage['container'] = null;
      stage.dispose();
    }
  });
});
