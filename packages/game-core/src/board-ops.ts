import { SEASON1_UNITS_BY_ID, lookupItemById, type UnitLocation, type UnitStar } from '@pkg/contracts';
import { cloneState } from './rng.js';
import { grantGold, populationCap, spendGold } from './economy.js';
import { returnToPool, starCopies, takeFromPool } from './pool.js';
import type { CommandResult, GameState, SeatState, UnitInstance } from './types.js';
export function makeUnit(game: GameState, unitId: string, location: UnitLocation, star: UnitStar = 1): UnitInstance {
  return { instanceId: 'u' + game.nextInstanceId++, unitId, star, location, items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0 };
}
function locationOrder(a: UnitInstance, b: UnitInstance): number {
  const order = (u: UnitInstance) => u.location.zone === 'board' ? u.location.row * 7 + u.location.col : 100 + u.location.slot;
  return order(a) - order(b) || a.instanceId.localeCompare(b.instanceId);
}
function isComponent(id: string): boolean { const kind = lookupItemById(id)?.kind; return kind === 'component' || kind === 'spatula'; }
function keepItem(items: string[], id: string): boolean {
  const kind = lookupItemById(id)?.kind;
  if (items.length >= 3) return false;
  if (!isComponent(id) && items.includes(id)) return false;
  if (kind === 'emblem' && items.some(i => lookupItemById(i)?.kind === 'emblem')) return false;
  return true;
}
export function combineUnits(seat: SeatState, unitId: string): void {
  for (const star of [1, 2] as const) {
    while (true) {
      const matches = seat.units.filter(u => u.unitId === unitId && u.star === star && u.frozenUntilRound === null).sort(locationOrder);
      if (matches.length < 3) break;
      const group = matches.slice(0, 3); const body = group[0]!;
      const complete = (u: UnitInstance) => u.items.filter(i => !isComponent(i));
      const others = group.slice(1);
      const ordered = [...complete(body), ...others.filter(u => u.location.zone === 'board').flatMap(complete), ...others.filter(u => u.location.zone === 'bench').flatMap(complete), ...group.flatMap(u => u.items.filter(isComponent))];
      const kept: string[] = [];
      for (const id of ordered) { if (keepItem(kept, id)) kept.push(id); else seat.inventoryItems.push(id); }
      body.items = kept; body.star = (star + 1) as UnitStar;
      const removed = new Set(others.map(u => u.instanceId)); seat.units = seat.units.filter(u => !removed.has(u.instanceId));
    }
  }
}
function simulateReceive(game: GameState, seat: SeatState, unitId: string): SeatState | null {
  const next = cloneState(seat);
  const unit: UnitInstance = { instanceId: 'u' + game.nextInstanceId, unitId, star: 1, location: { zone: 'bench', slot: 99 }, items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0 };
  next.units.push(unit); combineUnits(next, unitId);
  const unplaced = next.units.find(u => u.location.zone === 'bench' && u.location.slot === 99);
  if (unplaced) {
    const occupied = new Set(next.units.filter(u => u.location.zone === 'bench' && u.instanceId !== unplaced.instanceId).map(u => u.location.zone === 'bench' ? u.location.slot : -1));
    const slot = Array.from({ length: 9 }, (_, i) => i).find(i => !occupied.has(i));
    if (slot === undefined) return null;
    unplaced.location = { zone: 'bench', slot };
  }
  return next;
}
export function receiveUnit(game: GameState, seat: SeatState, unitId: string): CommandResult {
  if (!SEASON1_UNITS_BY_ID.has(unitId) || !game.pool[unitId]) return { ok: false, reason: 'POOL_EMPTY' };
  const next = simulateReceive(game, seat, unitId); if (!next) return { ok: false, reason: 'BENCH_FULL' };
  takeFromPool(game.pool, unitId); seat.units = next.units; seat.inventoryItems = next.inventoryItems; game.nextInstanceId++; return { ok: true };
}
export function buyCard(game: GameState, seat: SeatState, shopIndex: number): CommandResult {
  const unitId = seat.shop[shopIndex]; if (!unitId) return { ok: false, reason: 'EMPTY_SHOP_SLOT' };
  const cost = SEASON1_UNITS_BY_ID.get(unitId)!.cost;
  if (seat.gold < cost) return { ok: false, reason: 'INSUFFICIENT_GOLD' };
  const next = simulateReceive(game, seat, unitId); if (!next) return { ok: false, reason: 'BENCH_FULL' };
  spendGold(seat, cost, 'buy_card'); seat.units = next.units; seat.inventoryItems = next.inventoryItems;
  seat.shop[shopIndex] = null; game.nextInstanceId++; return { ok: true };
}
export function sellUnit(game: GameState, seat: SeatState, instanceId: string): CommandResult {
  const unit = seat.units.find(u => u.instanceId === instanceId); if (!unit) return { ok: false, reason: 'UNIT_NOT_FOUND' };
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'UNIT_FROZEN' };
  const copies = starCopies(unit.star); returnToPool(game.pool, unit.unitId, copies);
  grantGold(seat, SEASON1_UNITS_BY_ID.get(unit.unitId)!.cost * copies, 'sell_unit');
  seat.inventoryItems.push(...unit.items); seat.units = seat.units.filter(u => u !== unit); return { ok: true };
}
function sameLocation(a: UnitLocation, b: UnitLocation): boolean {
  return a.zone === 'board' && b.zone === 'board' ? a.row === b.row && a.col === b.col : a.zone === 'bench' && b.zone === 'bench' && a.slot === b.slot;
}
export function moveUnit(game: GameState, seat: SeatState, instanceId: string, to: UnitLocation): CommandResult {
  const unit = seat.units.find(u => u.instanceId === instanceId); if (!unit) return { ok: false, reason: 'UNIT_NOT_FOUND' };
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'UNIT_FROZEN' };
  const occupant = seat.units.find(u => u !== unit && sameLocation(u.location, to));
  if (occupant && occupant.frozenUntilRound !== null) return { ok: false, reason: 'UNIT_FROZEN' };
  const previous = unit.location; unit.location = { ...to }; if (occupant) occupant.location = previous;
  const boardCount = seat.units.filter(u => u.location.zone === 'board').length;
  if (boardCount > populationCap(seat, game.mode)) { unit.location = previous; if (occupant) occupant.location = to; return { ok: false, reason: 'POPULATION_FULL' }; }
  return { ok: true };
}
export function finalizePrepDeadline(game: GameState): void {
  if (game.phase !== 'prep') return;
  for (const seat of game.seats) {
    seat.pendingCommands = [];
    const bench = seat.units.filter(u => u.location.zone === 'bench' && u.frozenUntilRound === null).sort(locationOrder);
    for (const unit of bench) {
      if (seat.units.filter(u => u.location.zone === 'board').length >= populationCap(seat, game.mode)) break;
      const def = SEASON1_UNITS_BY_ID.get(unit.unitId)!;
      const rows = def.stats.range <= 2 ? [0, 1, 2, 3] : [3, 2, 1, 0]; const cols = [3, 2, 4, 1, 5, 0, 6];
      const to = rows.flatMap(row => cols.map(col => ({ zone: 'board' as const, row, col }))).find(loc => !seat.units.some(u => sameLocation(u.location, loc)));
      if (to) unit.location = to;
    }
  }
  game.phase = 'battle';
}
