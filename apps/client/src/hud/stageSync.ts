import {
  SEASON1_UNITS_BY_ID,
  type DurationMode,
  type UnitCombatTelemetry,
} from '@pkg/contracts';
import {
  createCombat,
  createSeat,
  stepCombat,
  type CombatState,
  type CombatUnit,
  type RoundBattle,
  type SeatState,
  type UnitInstance,
} from '@pkg/game-core';
import {
  getSeatWorldOrigin,
  hexToStageXZ,
  type BoardStageEngine,
  type StageLootOrbState,
  type StageUnitState,
} from '../stage/index.js';
import type { BattleBroadcastPayload, MatchRoomSnapshot } from '../api/matchSocket.js';

export function toStageSeatIndex(seatId: string, mySeatId: string, allSeatIds: readonly string[]): number {
  const myIdx = Math.max(0, allSeatIds.indexOf(mySeatId));
  const targetIdx = allSeatIds.indexOf(seatId);
  if (targetIdx === -1) return 0;
  return ((targetIdx - myIdx) % 8 + 8) % 8;
}

function baseUnitHp(unit: UnitInstance): number {
  const def = SEASON1_UNITS_BY_ID.get(unit.unitId);
  if (!def) return 600;
  const mult = def.starMultipliers[String(unit.star)] ?? (unit.star === 3 ? 2.8 : unit.star === 2 ? 1.7 : 1);
  return Math.round(def.stats.hp * mult + unit.bonusHp);
}

function buildStaticSeatUnits(
  units: readonly UnitInstance[],
  stageSeatIndex: number,
  allegiance: 'ally' | 'enemy',
): StageUnitState[] {
  return units.map((u) => {
    const def = SEASON1_UNITS_BY_ID.get(u.unitId);
    const maxHp = baseUnitHp(u);
    return {
      instanceId: u.instanceId,
      unitId: u.unitId,
      star: u.star,
      allegiance,
      seatIndex: stageSeatIndex,
      location:
        u.location.zone === 'bench'
          ? { zone: 'bench', slot: u.location.slot }
          : {
              zone: 'board',
              row: u.location.row,
              col: u.location.col,
              coordSpace: 'deploy4x7',
            },
      hp: maxHp,
      maxHp,
      shield: 0,
      mana: def?.stats.initialMana ?? 0,
      maxMana: def?.stats.maxMana ?? 100,
      items: u.items,
      statuses: {},
    };
  });
}

export function extractRawInstanceId(stageInstanceId: string): string {
  const colon = stageInstanceId.indexOf(':');
  return colon >= 0 ? stageInstanceId.slice(colon + 1) : stageInstanceId;
}

function buildSeatFromPublicView(
  snapshot: MatchRoomSnapshot,
  seatId: string,
): SeatState {
  if (seatId === snapshot.seatId) {
    return structuredClone(snapshot.self);
  }
  const pub = snapshot.seats.find((s) => s.seatId === seatId);
  const s = createSeat(seatId, snapshot.mode);
  if (pub) {
    s.level = pub.level;
    s.units = structuredClone(pub.units);
    s.chosenAugments = [...pub.chosenAugments];
    s.victoryPoints = pub.victoryPoints;
  }
  return s;
}

function buildPveSeat(mode: DurationMode, round: number, homeSeatId: string): SeatState {
  const npc = createSeat(`pve-${round}-${homeSeatId}`, mode);
  npc.units = ['S01', 'S06', 'S09'].map((unitId, i) => ({
    instanceId: `${npc.id}-${i}`,
    unitId,
    star: round >= 8 ? 2 : 1,
    location: { zone: 'board' as const, row: i === 2 ? 3 : 0, col: i + 2 },
    items: [],
    cryoRounds: 0,
    frozenUntilRound: null,
    bonusHp: 0,
    bonusSkillEfficiency: 0,
  }));
  return npc;
}

interface CombatUnitTracker {
  hp: number;
  attacks: number;
  castUntil: number;
}

export class LiveBattleChoreographer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private combat: CombatState | null = null;
  private flipPerspective = false;
  private stageSeatIndex = 0;
  private trackers = new Map<string, CombatUnitTracker>();
  private authoritativeTelemetry: UnitCombatTelemetry[] = [];
  private onTelemetryUpdate?: (telemetry: UnitCombatTelemetry[]) => void;

  public start(params: {
    stage: BoardStageEngine;
    snapshot: MatchRoomSnapshot;
    battlePayload: BattleBroadcastPayload | null;
    viewedSeatId: string;
    stageSeatIndex: number;
    onTelemetry?: (telemetry: UnitCombatTelemetry[]) => void;
  }): void {
    this.stop();
    const { stage, snapshot, battlePayload, viewedSeatId, stageSeatIndex, onTelemetry } = params;
    stage.setPhase('battle');
    this.stageSeatIndex = stageSeatIndex;
    this.onTelemetryUpdate = onTelemetry;

    const battle: RoundBattle | undefined = battlePayload?.battles.find(
      (b) => b.leftSeatId === viewedSeatId || b.rightSeatId === viewedSeatId,
    );

    let leftSeat: SeatState;
    let rightSeat: SeatState;
    if (battle) {
      leftSeat = buildSeatFromPublicView(snapshot, battle.leftSeatId);
      rightSeat = battle.pve
        ? buildPveSeat(snapshot.mode, snapshot.round, battle.leftSeatId)
        : buildSeatFromPublicView(snapshot, battle.rightSeatId);
      this.flipPerspective = battle.rightSeatId === viewedSeatId;
      this.authoritativeTelemetry = battle.result.telemetry;
    } else {
      leftSeat = buildSeatFromPublicView(snapshot, viewedSeatId);
      rightSeat = buildPveSeat(snapshot.mode, snapshot.round, viewedSeatId);
      this.flipPerspective = false;
      this.authoritativeTelemetry = [];
    }

    let seed = (snapshot.round * 2654435761) >>> 0;
    for (let i = 0; i < snapshot.matchId.length; i += 1) {
      seed = Math.imul(seed ^ snapshot.matchId.charCodeAt(i), 16777619) >>> 0;
    }

    this.combat = createCombat(leftSeat, rightSeat, snapshot.mode, seed || 1);
    this.trackers.clear();
    for (const u of this.combat.units) {
      this.trackers.set(u.id, { hp: u.hp, attacks: u.attacks, castUntil: u.castUntil });
    }

    this.pushCombatFrame(stage, snapshot);

    this.timer = setInterval(() => {
      if (!this.combat) return;
      if (!this.combat.result) {
        const prevPositions = new Map<string, { row: number; col: number }>();
        for (const u of this.combat.units) {
          prevPositions.set(u.id, { row: u.row, col: u.col });
        }
        stepCombat(this.combat, 50);
        this.emitStepEffects(stage, prevPositions);
        this.pushCombatFrame(stage, snapshot);
      } else {
        const allyWon =
          (this.combat.result.winnerSide === 0 && !this.flipPerspective) ||
          (this.combat.result.winnerSide === 1 && this.flipPerspective);
        if (allyWon) {
          stage.triggerTacticianEmote('cheer');
        }
        if (this.authoritativeTelemetry.length > 0) {
          this.onTelemetryUpdate?.(this.authoritativeTelemetry);
        }
        this.stopTimerOnly();
      }
    }, 50);
  }

  private mapBoardHex(row: number, col: number): { row: number; col: number } {
    return this.flipPerspective ? { row: 7 - row, col: 6 - col } : { row, col };
  }

  private isAllyUnit(u: CombatUnit): boolean {
    return this.flipPerspective ? u.side === 1 : u.side === 0;
  }

  private stageUnitId(u: CombatUnit): string {
    return u.instanceId || u.id;
  }

  private emitStepEffects(
    stage: BoardStageEngine,
    _prevPositions: Map<string, { row: number; col: number }>,
  ): void {
    if (!this.combat) return;
    const nowMs = this.combat.elapsedMs;

    for (const u of this.combat.units) {
      const prev = this.trackers.get(u.id);
      if (!prev) continue;
      const actorStageId = this.stageUnitId(u);
      const target = u.targetId ? this.combat.units.find((t) => t.id === u.targetId) : undefined;
      const targetStageId = target ? this.stageUnitId(target) : undefined;

      if (u.castUntil > prev.castUntil && u.alive) {
        stage.playUnitSkillCast(actorStageId, targetStageId);
      } else if (u.attacks > prev.attacks && u.alive) {
        stage.playUnitAttack(actorStageId, targetStageId, 'physical');
      }

      const hpDrop = prev.hp - u.hp;
      if (hpDrop >= 1) {
        stage.triggerUnitHit(actorStageId, 0, this.isAllyUnit(u) ? 1 : -1);
        const isMagic = hpDrop > 110;
        stage.spawnDamageNumber({
          targetInstanceId: actorStageId,
          amount: Math.round(hpDrop),
          kind: isMagic ? 'magic' : 'physical',
          isCrit: hpDrop > 190,
        });
      }

      prev.hp = u.hp;
      prev.attacks = u.attacks;
      prev.castUntil = u.castUntil;
    }

    const liveTelemetry: UnitCombatTelemetry[] = this.combat.units
      .filter((u) => this.isAllyUnit(u))
      .map((u) => ({ ...u.telemetry }));
    this.onTelemetryUpdate?.(
      this.combat.result && this.authoritativeTelemetry.length > 0
        ? this.authoritativeTelemetry
        : liveTelemetry,
    );

    void nowMs;
  }

  private pushCombatFrame(stage: BoardStageEngine, snapshot: MatchRoomSnapshot): void {
    if (!this.combat) return;
    const nowMs = this.combat.elapsedMs;
    const seatOrigin = getSeatWorldOrigin(this.stageSeatIndex);

    const benchUnits: StageUnitState[] =
      this.stageSeatIndex === 0
        ? buildStaticSeatUnits(
            snapshot.self.units.filter((u) => u.location.zone === 'bench'),
            0,
            'ally',
          )
        : [];

    const combatStageUnits: StageUnitState[] = this.combat.units
      .filter((u) => u.alive)
      .map((u) => {
        const mapped = this.mapBoardHex(u.row, u.col);
        let worldOverride: { x: number; z: number } | undefined;
        if (u.move && u.move.arriveAt > nowMs) {
          const destMapped = this.mapBoardHex(u.move.to.row, u.move.to.col);
          const fromXZ = hexToStageXZ(mapped.row, mapped.col);
          const toXZ = hexToStageXZ(destMapped.row, destMapped.col);
          const ratio = Math.max(0, Math.min(1, 1 - (u.move.arriveAt - nowMs) / 260));
          worldOverride = {
            x: seatOrigin.x + fromXZ.x + (toXZ.x - fromXZ.x) * ratio,
            z: seatOrigin.z + fromXZ.z + (toXZ.z - fromXZ.z) * ratio,
          };
        }
        const activeShield = u.shields
          .filter((sh) => sh.until > nowMs && sh.amount > 0)
          .reduce((sum, sh) => sum + sh.amount, 0);

        const activeKeys = new Set(
          u.buffs.filter((b) => b.until > nowMs && b.value > 0).map((b) => b.key),
        );

        return {
          instanceId: this.stageUnitId(u),
          unitId: u.unitId,
          star: u.star,
          allegiance: this.isAllyUnit(u) ? 'ally' : 'enemy',
          seatIndex: this.stageSeatIndex,
          location: {
            zone: 'board',
            row: mapped.row,
            col: mapped.col,
            coordSpace: 'full8x7',
          },
          ...(worldOverride ? { worldOverride } : {}),
          hp: Math.max(0, Math.round(u.hp)),
          maxHp: Math.max(1, Math.round(u.maxHp)),
          shield: Math.round(activeShield),
          mana: Math.max(0, Math.round(u.mana)),
          maxMana: Math.max(1, Math.round(u.maxMana)),
          items: u.items,
          statuses: {
            antiHeal: activeKeys.has('antiHeal'),
            armorShred: activeKeys.has('armorShred'),
            mrShred: activeKeys.has('mrShred'),
            ccImmune: activeKeys.has('ccImmune'),
          },
        };
      });

    stage.syncUnits([...benchUnits, ...combatStageUnits]);
  }

  private stopTimerOnly(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public stop(): void {
    this.stopTimerOnly();
    this.combat = null;
    this.trackers.clear();
  }
}

export class SnapshotStageSynchronizer {
  private prevStarByInstance = new Map<string, 1 | 2 | 3>();
  private collectedOrbKeys = new Set<string>();
  private lastMatchId = '';
  private lastOrbEmoteKey = '';

  public markOrbCollected(orbId: string): void {
    this.collectedOrbKeys.add(orbId);
  }

  public syncSnapshot(stage: BoardStageEngine, snapshot: MatchRoomSnapshot): void {
    if (snapshot.matchId !== this.lastMatchId) {
      this.lastMatchId = snapshot.matchId;
      this.prevStarByInstance.clear();
      this.collectedOrbKeys.clear();
      this.lastOrbEmoteKey = '';
    }

    stage.setPhase(snapshot.phase);
    stage.setGoldAndCharge(snapshot.self.gold);
    stage.setCryoPodEnabled(snapshot.self.cryoPodEnabled);

    const allSeatIds = snapshot.seats.map((s) => s.seatId);
    const units: StageUnitState[] = [];

    const homeUnits = buildStaticSeatUnits(snapshot.self.units, 0, 'ally');
    units.push(...homeUnits);

    for (const pub of snapshot.seats) {
      if (pub.seatId === snapshot.seatId) continue;
      const sIdx = toStageSeatIndex(pub.seatId, snapshot.seatId, allSeatIds);
      units.push(...buildStaticSeatUnits(pub.units, sIdx, 'enemy'));
    }

    stage.syncUnits(units);

    for (const u of snapshot.self.units) {
      const prevStar = this.prevStarByInstance.get(u.instanceId);
      if (prevStar && u.star > prevStar && (u.star === 2 || u.star === 3)) {
        stage.playStarUpConvergence(u.instanceId, u.star);
      }
      this.prevStarByInstance.set(u.instanceId, u.star);
    }

    if (snapshot.phase === 'resource' || snapshot.phase === 'strategy') {
      const orbs: StageLootOrbState[] = (snapshot.self.learningGoldOrbs ?? [])
        .map((goldAmount, idx) => ({
          orbId: `orb:${snapshot.matchId}:n${snapshot.nodeIndex}:${idx}`,
          goldAmount,
          row: 5 + (idx % 2),
          col: 2 + ((idx * 2) % 4),
        }))
        .filter((orb) => !this.collectedOrbKeys.has(orb.orbId));
      stage.syncLootOrbs(orbs);
      if (snapshot.phase === 'resource' && orbs.length > 0) {
        const orbKey = `${snapshot.matchId}:n${snapshot.nodeIndex}:p${snapshot.phaseIndex}`;
        if (this.lastOrbEmoteKey !== orbKey) {
          this.lastOrbEmoteKey = orbKey;
          stage.triggerTacticianEmote('collect_orb');
        }
      }
    } else {
      stage.syncLootOrbs([]);
    }
  }

  public syncAmbientDiorama(stage: BoardStageEngine): void {
    stage.setPhase('strategy');
    stage.setLearningOverlayActive(false);
    stage.setGoldAndCharge(30);
    stage.setCryoPodEnabled(false);
    stage.syncLootOrbs([]);
    const showcase: StageUnitState[] = [
      {
        instanceId: 'ambient:S33',
        unitId: 'S33',
        star: 2,
        allegiance: 'ally',
        seatIndex: 0,
        location: { zone: 'board', row: 1, col: 3, coordSpace: 'deploy4x7' },
        hp: 1800,
        maxHp: 1800,
        shield: 240,
        mana: 90,
        maxMana: 100,
      },
      {
        instanceId: 'ambient:S27',
        unitId: 'S27',
        star: 2,
        allegiance: 'ally',
        seatIndex: 0,
        location: { zone: 'board', row: 0, col: 2, coordSpace: 'deploy4x7' },
        hp: 2100,
        maxHp: 2100,
        shield: 0,
        mana: 40,
        maxMana: 100,
      },
      {
        instanceId: 'ambient:S30',
        unitId: 'S30',
        star: 1,
        allegiance: 'ally',
        seatIndex: 0,
        location: { zone: 'board', row: 3, col: 4, coordSpace: 'deploy4x7' },
        hp: 1100,
        maxHp: 1100,
        shield: 0,
        mana: 60,
        maxMana: 80,
      },
    ];
    stage.syncUnits(showcase);
  }
}
