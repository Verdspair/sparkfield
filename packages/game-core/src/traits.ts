import { CRYO_BENCH_SLOT, MODE_BUDGETS, SEASON1_TRAITS, SEASON1_UNITS_BY_ID, type DurationMode } from '@pkg/contracts';
import type { ActiveTrait, CommandResult, SeatState, UnitInstance } from './types.js';

export function computeActiveTraits(units: readonly UnitInstance[]): ActiveTrait[] {
  const deployed = units.filter(u => u.location.zone === 'board' && u.frozenUntilRound === null);
  const counts = new Map<string, Set<string>>();
  const add = (name: string, id: string) => {
    const ids = counts.get(name) ?? new Set<string>(); ids.add(id); counts.set(name, ids);
  };
  for (const u of deployed) {
    const def = SEASON1_UNITS_BY_ID.get(u.unitId); if (!def) continue;
    add(def.faction, u.unitId); add(def.role, u.unitId);
    if (def.uniqueTrait) add(def.uniqueTrait, u.unitId);
  }
  for (const faction of SEASON1_TRAITS.factions) {
    const foreign = deployed.some(u => u.items.includes(faction.emblemId)
      && SEASON1_UNITS_BY_ID.has(u.unitId) && SEASON1_UNITS_BY_ID.get(u.unitId)!.faction !== faction.name);
    if (foreign) add(faction.name, `emblem:${faction.id}`);
  }
  const result: ActiveTrait[] = [];
  for (const [kind, defs] of [['faction', SEASON1_TRAITS.factions], ['role', SEASON1_TRAITS.roles], ['unique', SEASON1_TRAITS.uniques]] as const) {
    for (const def of defs) {
      const count = counts.get(def.name)?.size ?? 0;
      if (count) result.push({ traitName: def.name, count, activeTier: def.thresholds.filter(t => count >= t).length, kind });
    }
  }
  return result;
}

export function beginCryoPrep(seat: SeatState, round: number, mode: DurationMode): void {
  const role = SEASON1_TRAITS.roles.find(r => r.id === 'R_BIOCARE')!;
  for (const unit of seat.units) {
    if (unit.frozenUntilRound !== null && unit.frozenUntilRound <= round) {
      if (unit.cryoRounds < role.cryoMaxRounds!) {
        const mult = seat.chosenAugments.includes('AUG_S02') ? 1.5 : 1;
        unit.bonusHp += role.cryoBonusHpPerRound! * mult;
        unit.bonusSkillEfficiency += role.cryoBonusApPctPerRound! * mult;
        unit.cryoRounds++;
      }
      unit.frozenUntilRound = null;
      seat.cryoPodEnabled = false;
    }
  }
  const recharge: readonly number[] = MODE_BUDGETS.economy_and_event_policy.magnetic_remover.recharge_to_one_rounds[mode];
  if (recharge.includes(round)) seat.magneticCharges = 1;
  seat.magneticCharges = Math.min(1, seat.magneticCharges);
}

export function toggleCryoPod(seat: SeatState, enabled: boolean, round: number, mode: DurationMode): CommandResult {
  const unit = seat.units.find(u => u.location.zone === 'bench' && u.location.slot === CRYO_BENCH_SLOT);
  if (!enabled) {
    if (unit?.frozenUntilRound !== null && unit?.frozenUntilRound !== undefined) return { ok: false, reason: 'unit-frozen' };
    seat.cryoPodEnabled = false; return { ok: true };
  }
  if (round >= MODE_BUDGETS.modes[mode].rounds) return { ok: false, reason: 'final-round' };
  if (!computeActiveTraits(seat.units).some(t => t.traitName === '维生' && t.activeTier > 0)) return { ok: false, reason: 'biocare-inactive' };
  if (!unit) return { ok: false, reason: 'cryo-slot-empty' };
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'unit-frozen' };
  if (unit.cryoRounds >= 2) return { ok: false, reason: 'cryo-limit' };
  unit.frozenUntilRound = round + 1; seat.cryoPodEnabled = true;
  return { ok: true };
}
