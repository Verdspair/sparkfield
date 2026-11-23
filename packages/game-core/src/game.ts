import { GameCommandSchema, MODE_BUDGETS, SEASON1_ITEMS, type BattleOutcome, type DurationMode, type GameCommand } from '@pkg/contracts';
import { createRng, randomInt, shuffle } from './rng.js';
import { createPool, drawUnitOfCost, naturalRefreshShop, refreshShop } from './pool.js';
import { addExperience, buyExperience, economyFor, grantGold, settleSeatEconomy } from './economy.js';
import { buyCard, combineUnits, makeUnit, moveUnit, sellUnit } from './board-ops.js';
import { beginCryoPrep, computeActiveTraits, toggleCryoPod } from './traits.js';
import { createAnvil, equipItem, itemComponentValue, pickAnvilOption, useMagneticRemover, useReforger } from './items.js';
import { beginAugmentPrep, createRoomAugmentOffers, grantVouchers, pickAugment, rerollAugmentSlot } from './augments.js';
import { isPveRound, victoryPointsFor } from './schedule.js';
import type { CommandResult, GameState, SeatState } from './types.js';
type PrepAction = 'BUY_CARD' | 'BUY_XP' | 'EQUIP_ITEM' | 'REFRESH_SHOP';
type GameWithPrepActions = GameState & {
  prepActions?: { round: number; bySeat: Record<string, Partial<Record<PrepAction, number>>> };
};
export function countPrepActions(game: GameWithPrepActions, seatId: string, action: PrepAction): number {
  return game.prepActions?.round === game.round ? game.prepActions.bySeat[seatId]?.[action] ?? 0 : 0;
}
function recordPrepAction(game: GameWithPrepActions, seatId: string, action: PrepAction): void {
  if (game.prepActions?.round !== game.round) game.prepActions = { round: game.round, bySeat: {} };
  const actions = game.prepActions.bySeat[seatId] ??= {};
  actions[action] = (actions[action] ?? 0) + 1;
}
export function createSeat(id: string, mode: DurationMode): SeatState {
  const e = economyFor(mode);
  return { id, level: e.starting_level, xp: 0, gold: e.starting_gold, initialGold: e.starting_gold, goldLedger: [], units: [], shop: Array(5).fill(null) as null[], shopLocked: false, inventoryItems: [], magneticCharges: 1, reforgerCharges: 0, cryoPodEnabled: false, chosenAugments: [], augmentOffer: null, anvils: [], previousBattleTraits: [], lineupPlan: [], victoryPoints: 0, pvpWinStreak: 0, moraleGoldGranted: 0, rerollVouchers: 0, voucherRound: null, vouchersGranted: 0, learningChargeCents: 0, learningGoldOrbs: [], pendingAugmentRerollRounds: 0, pendingLevelFreeRefreshes: 0, pendingCommands: [], isBot: false, botDifficulty: 'standard' };
}
export function createGame(mode: DurationMode, seed = 1): GameState {
  const game: GameState = { mode, round: 1, phase: 'prep', rng: createRng(seed), pool: createPool(), seats: Array.from({ length: 8 }, (_, i) => createSeat('seat-' + (i + 1), mode)), seatOrder: [], nextInstanceId: 1, completedNonFinalPvp: 0, settledRounds: [], itemComponentsGranted: 0 };
  game.seatOrder = shuffle(game.seats.map(s => s.id), game.rng);
  for (const seat of game.seats) {
    for (let i = 0; i < economyFor(mode).starting_one_cost_units; i++) {
      const id = drawUnitOfCost(game.pool, 1, game.rng)!;
      seat.units.push(makeUnit(game, id, { zone: 'bench', slot: i })); combineUnits(seat, id);
    }
    refreshShop(game, seat, false);
  }
  grantRoundResources(game); return game;
}
function grantRoundResources(game: GameState): void {
  const before = itemComponentShares(game); const b = MODE_BUDGETS.modes[game.mode];
  const budget = b.economy.ordinary_component_budget;
  const allotment = Math.floor(budget * game.round / b.rounds) - Math.floor(budget * (game.round - 1) / b.rounds);
  for (const seat of game.seats) {
    let remaining = allotment;
    if (game.round === 1 && remaining > 0) {
      const components = SEASON1_ITEMS.components;
      seat.inventoryItems.push(components[randomInt(game.rng, components.length)]!.id);
      remaining--;
    }
    while (remaining >= 2) { createAnvil(seat, 'completed', game.rng, 'anvil-' + game.nextInstanceId++); remaining -= 2; }
    if (remaining > 0) createAnvil(seat, 'component', game.rng, 'anvil-' + game.nextInstanceId++);
  }
  game.itemComponentsGranted += itemComponentShares(game) - before;
  const augmentEvents = b.events_detail.filter(e => e.name.startsWith('强化'));
  const index = augmentEvents.findIndex(e => e.round === game.round);
  if (index >= 0) createRoomAugmentOffers(game, index + 1);
}
const LEARNING_BONUS_INVENTORY_CAP = 12;

export function applyLearningBonusGrant(
  game: GameState,
  seat: SeatState,
  nodeIndex: number,
  { bonusComponents, bonusRerollVouchers }: { bonusComponents: number; bonusRerollVouchers: number },
): { bonusItemIds: string[]; bonusRerollVouchers: number } {
  const components = SEASON1_ITEMS.components;
  const openSlots = Math.max(0, LEARNING_BONUS_INVENTORY_CAP - seat.inventoryItems.length);
  const count = Math.min(bonusComponents, openSlots);
  const offset = nodeIndex + game.seats.indexOf(seat);
  const bonusItemIds = Array.from({ length: count }, (_, i) => components[(offset + i) % components.length]!.id);
  seat.inventoryItems.push(...bonusItemIds);
  game.itemComponentsGranted += bonusItemIds.length;
  grantVouchers(seat, bonusRerollVouchers, game.round);
  return { bonusItemIds, bonusRerollVouchers };
}

export function itemComponentShares(game: GameState): number {
  return game.seats.reduce((n, seat) => n + [...seat.inventoryItems, ...seat.units.flatMap(u => u.items)].reduce((a, id) => a + itemComponentValue(id), 0) + seat.anvils.reduce((a, anvil) => a + (anvil.kind === 'completed' ? 2 : 1), 0), 0);
}
export function assertItemConservation(game: GameState): void {
  if (itemComponentShares(game) !== game.itemComponentsGranted) throw new Error('Item component conservation violated');
}
function flushLevelRefreshes(game: GameState, seat: SeatState): void {
  while (seat.pendingLevelFreeRefreshes > 0) { refreshShop(game, seat, false); seat.pendingLevelFreeRefreshes--; }
}
export function applyGameCommand(game: GameState, seatId: string, command: GameCommand): CommandResult {
  if (game.phase !== 'prep') return { ok: false, reason: 'NOT_PREPARATION' };
  const parsed = GameCommandSchema.safeParse(command); if (!parsed.success) return { ok: false, reason: 'INVALID_COMMAND' };
  const seat = game.seats.find(s => s.id === seatId); if (!seat) return { ok: false, reason: 'SEAT_NOT_FOUND' };
  const c = parsed.data; const shares = itemComponentShares(game); let result: CommandResult;
  switch (c.type) {
    case 'BUY_CARD': result = buyCard(game, seat, c.shopIndex); break;
    case 'SELL_UNIT': result = sellUnit(game, seat, c.instanceId); break;
    case 'REFRESH_SHOP': result = refreshShop(game, seat); break;
    case 'TOGGLE_LOCK_SHOP': seat.shopLocked = !seat.shopLocked; result = { ok: true }; break;
    case 'BUY_XP': result = buyExperience(seat, game.mode); break;
    case 'MOVE_UNIT': result = moveUnit(game, seat, c.instanceId, c.to); break;
    case 'EQUIP_ITEM': result = equipItem(seat, c.inventoryItemIndex, c.targetInstanceId); break;
    case 'USE_MAGNETIC_REMOVER': result = useMagneticRemover(seat, c.targetInstanceId); break;
    case 'USE_REFORGER': result = useReforger(seat, c.targetInstanceId, game.rng); break;
    case 'TOGGLE_CRYO_POD': result = toggleCryoPod(seat, c.enabled, game.round, game.mode); break;
    case 'PICK_ANVIL_OPTION': result = pickAnvilOption(seat, c.anvilInstanceId, c.optionIndex); break;
    case 'REROLL_AUGMENT_SLOT': result = rerollAugmentSlot(seat, c.slotIndex, game.rng); break;
    case 'PICK_AUGMENT': result = pickAugment(seat, c.slotIndex, game.mode, game.round, game); break;
    case 'SET_LINEUP_PLAN': seat.lineupPlan = [...c.unitIds]; result = { ok: true }; break;
  }
  if (result.ok) {
    if (c.type === 'PICK_AUGMENT') game.itemComponentsGranted += itemComponentShares(game) - shares;
    if (c.type === 'BUY_CARD' || c.type === 'BUY_XP' || c.type === 'EQUIP_ITEM' || c.type === 'REFRESH_SHOP') {
      recordPrepAction(game, seatId, c.type);
    }
    flushLevelRefreshes(game, seat);
  }
  return result;
}
export interface SeatRoundOutcome { seatId: string; outcome: BattleOutcome }
export function settleRound(game: GameState, outcomes: readonly SeatRoundOutcome[]): void {
  if (game.phase !== 'battle' || game.settledRounds.includes(game.round)) throw new Error('Round is not awaiting settlement');
  if (outcomes.length !== 8 || new Set(outcomes.map(o => o.seatId)).size !== 8 || outcomes.some(o => !game.seats.some(s => s.id === o.seatId) || !['win', 'draw', 'loss'].includes(o.outcome))) throw new Error('Settlement needs eight distinct seat outcomes');
  const final = game.round === MODE_BUDGETS.modes[game.mode].rounds; const pve = isPveRound(game.mode, game.round);
  for (const seat of game.seats) {
    const outcome = outcomes.find(o => o.seatId === seat.id)!.outcome; const goldForInterest = seat.gold;
    seat.victoryPoints += victoryPointsFor(game.mode, game.round, outcome);
    seat.previousBattleTraits = computeActiveTraits(seat.units);
    if (!pve) {
      if (outcome === 'win') {
        seat.pvpWinStreak++;
        if (seat.pvpWinStreak % 2 === 0 && seat.moraleGoldGranted < economyFor(game.mode).morale_gold_cap) { grantGold(seat, 1, 'morale'); seat.moraleGoldGranted++; }
      } else seat.pvpWinStreak = 0;
    }
    seat.rerollVouchers = 0; seat.voucherRound = null;
    settleSeatEconomy(seat, game.mode, final, goldForInterest);
  }
  if (!pve && !final) {
    game.completedNonFinalPvp++;
    if (game.completedNonFinalPvp % 2 === 0) for (const seat of game.seats) {
      if (seat.vouchersGranted < economyFor(game.mode).equal_reroll_vouchers_total) { seat.rerollVouchers = 1; seat.voucherRound = game.round + 1; seat.vouchersGranted++; }
    }
  }
  game.settledRounds.push(game.round); if (final) game.phase = 'finished';
}
export function beginNextRound(game: GameState): void {
  if (game.phase === 'finished') return;
  if (!game.settledRounds.includes(game.round)) throw new Error('Previous round not settled');
  game.round++; game.phase = 'prep';
  for (const seat of game.seats) {
    if (seat.voucherRound !== game.round) { seat.rerollVouchers = 0; seat.voucherRound = null; }
    beginCryoPrep(seat, game.round, game.mode);
    for (const unitId of new Set(seat.units.map(u => u.unitId))) combineUnits(seat, unitId);
    beginAugmentPrep(seat, game.round);
    naturalRefreshShop(game, seat); flushLevelRefreshes(game, seat);
  }
  grantRoundResources(game);
}
