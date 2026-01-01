import { MODE_BUDGETS, SEASON1_UNITS, type UnitStar } from '@pkg/contracts';
import { nextRandom, randomInt } from './rng.js';
import { spendGold } from './economy.js';
import type { CommandResult, GameState, RngState, SeatState } from './types.js';
export function createPool(): Record<string, number> { return Object.fromEntries(SEASON1_UNITS.map(u => [u.id, u.poolCopies])); }
export function starCopies(star: UnitStar): number { return 3 ** (star - 1); }
export function takeFromPool(pool: Record<string, number>, unitId: string, count = 1): boolean {
  if (!Number.isInteger(count) || count < 1 || (pool[unitId] ?? 0) < count) return false;
  pool[unitId]! -= count; return true;
}
export function returnToPool(pool: Record<string, number>, unitId: string, count = 1): void {
  if (!(unitId in pool) || !Number.isInteger(count) || count < 1) throw new Error('Invalid pool return');
  pool[unitId]! += count;
}
export function drawUnitOfCost(pool: Record<string, number>, cost: number, rng: RngState): string | null {
  const eligible = SEASON1_UNITS.filter(u => u.cost === cost && pool[u.id]! > 0);
  const sum = eligible.reduce((n, u) => n + pool[u.id]!, 0); if (!sum) return null;
  let roll = randomInt(rng, sum);
  for (const u of eligible) { roll -= pool[u.id]!; if (roll < 0) { pool[u.id]!--; return u.id; } }
  return null;
}
export function drawShopCard(pool: Record<string, number>, level: number, rng: RngState): string | null {
  const odds = (MODE_BUDGETS.shop_odds as Record<string, number[]>)[String(level)];
  if (!odds) throw new RangeError('Shop level must be Lv3..Lv10');
  const weights = odds.map((w, i) => SEASON1_UNITS.some(u => u.cost === i + 1 && pool[u.id]! > 0) ? w : 0);
  const total = weights.reduce((a, b) => a + b, 0); if (!total) return null;
  let roll = nextRandom(rng) * total;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll < 0) return drawUnitOfCost(pool, i + 1, rng); }
  return null;
}
export function releaseShop(game: GameState, seat: SeatState): void {
  for (const id of seat.shop) if (id !== null) returnToPool(game.pool, id);
  seat.shop = Array(5).fill(null) as null[];
}
export function refreshShop(game: GameState, seat: SeatState, paid = true): CommandResult {
  const odds = (MODE_BUDGETS.shop_odds as Record<string, number[]>)[String(seat.level)]!;
  const canDraw = SEASON1_UNITS.some(u => odds[u.cost - 1]! > 0 && (game.pool[u.id]! > 0 || seat.shop.includes(u.id)));
  if (paid && !canDraw) return { ok: false, reason: 'SHOP_POOL_EMPTY' };
  const voucher = paid && seat.rerollVouchers > 0 && seat.voucherRound === game.round;
  if (paid && !voucher && !spendGold(seat, 2, 'refresh_shop')) return { ok: false, reason: 'INSUFFICIENT_GOLD' };
  if (voucher) seat.rerollVouchers--;
  releaseShop(game, seat);
  seat.shop = Array.from({ length: 5 }, () => drawShopCard(game.pool, seat.level, game.rng));
  return { ok: true };
}
export function naturalRefreshShop(game: GameState, seat: SeatState): void {
  if (seat.shopLocked) { seat.shopLocked = false; return; }
  refreshShop(game, seat, false);
}
export function poolAccounting(game: GameState): Record<string, number> {
  const totals = { ...game.pool };
  for (const seat of game.seats) {
    for (const id of seat.shop) if (id) totals[id]!++;
    for (const unit of seat.units) totals[unit.unitId]! += starCopies(unit.star);
  }
  return totals;
}
export function assertPoolConservation(game: GameState): void {
  const totals = poolAccounting(game);
  for (const u of SEASON1_UNITS) if (totals[u.id] !== u.poolCopies || game.pool[u.id]! < 0) throw new Error('Pool conservation violated: ' + u.id);
}
