import { MODE_BUDGETS, SEASON1_ITEMS, type DurationMode } from '@pkg/contracts';
import type { CommandResult, SeatState } from './types.js';
export const economyFor = (mode: DurationMode) => MODE_BUDGETS.modes[mode].economy;
export function grantGold(seat: SeatState, amount: number, reason: string): void {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('Gold grants must be nonnegative integers');
  seat.gold += amount; if (amount) seat.goldLedger.push({ reason, amount });
}
export function spendGold(seat: SeatState, amount: number, reason: string): boolean {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('Gold costs must be nonnegative integers');
  if (seat.gold < amount) return false;
  seat.gold -= amount; if (amount) seat.goldLedger.push({ reason, amount: -amount }); return true;
}
export function populationCap(seat: SeatState, mode: DurationMode): number {
  const flag = SEASON1_ITEMS.special.mothershipFlag.id;
  const hasFlag = seat.units.some(u => u.frozenUntilRound === null && u.items.includes(flag));
  return Math.min(seat.level, economyFor(mode).base_level_cap) + (hasFlag ? 1 : 0);
}
export function addExperience(seat: SeatState, amount: number, mode: DurationMode): void {
  seat.xp += amount;
  const cap = economyFor(mode).base_level_cap;
  while (seat.level < cap) {
    const cost = (MODE_BUDGETS.xp_to_next as Record<string, number>)[String(seat.level)]!;
    if (seat.xp < cost) break;
    seat.xp -= cost; seat.level++;
    if (seat.chosenAugments.includes('AUG_G01')) seat.pendingLevelFreeRefreshes++;
  }
}
export function buyExperience(seat: SeatState, mode: DurationMode): CommandResult {
  if (seat.level >= economyFor(mode).base_level_cap) return { ok: false, reason: 'LEVEL_CAP' };
  if (!spendGold(seat, 4, 'buy_xp')) return { ok: false, reason: 'INSUFFICIENT_GOLD' };
  addExperience(seat, seat.chosenAugments.includes('AUG_P02') ? 6 : 4, mode); return { ok: true };
}
export function applyLearningGoldGrant(seat: SeatState, grantedIntegerGold: number, carryOutCents: number): void {
  if (!Number.isInteger(carryOutCents) || carryOutCents < 0 || carryOutCents > 99) throw new RangeError('Charge cents must be 0..99');
  grantGold(seat, grantedIntegerGold, 'learning');
  seat.learningChargeCents = carryOutCents;
  seat.learningGoldOrbs = Array.from({ length: grantedIntegerGold }, () => 1);
}
export function settleSeatEconomy(seat: SeatState, mode: DurationMode, finalRound: boolean, goldForInterest = seat.gold): void {
  if (finalRound) return;
  const e = economyFor(mode); const interest = Math.min(e.interest_cap, Math.floor(goldForInterest / 10));
  grantGold(seat, e.base_income, 'base_income'); grantGold(seat, interest, 'interest'); addExperience(seat, e.free_xp, mode);
}
export function assertGoldConservation(seat: SeatState): void {
  if (seat.initialGold + seat.goldLedger.reduce((sum, e) => sum + e.amount, 0) !== seat.gold) throw new Error('Gold conservation violated: ' + seat.id);
}
