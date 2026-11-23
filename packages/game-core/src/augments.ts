import { MODE_BUDGETS, SEASON1_AUGMENTS, SEASON1_ITEMS, SEASON1_UNITS, type AugmentDef, type AugmentTier, type DurationMode } from '@pkg/contracts';
import { addExperience, grantGold } from './economy.js';
import { createAnvil } from './items.js';
import { receiveUnit } from './board-ops.js';
import { cloneState, randomInt } from './rng.js';
import type { AugmentOffer, CommandResult, GameState, RngState, SeatState } from './types.js';

const byId = new Map(SEASON1_AUGMENTS.map(a => [a.id, a]));
const tiers: AugmentTier[] = ['silver', 'gold', 'prismatic'];
function available(seat: SeatState, offer: AugmentOffer, excluded: readonly string[]): AugmentDef[] {
  return SEASON1_AUGMENTS.filter(a => a.tier === offer.tier && !seat.chosenAugments.includes(a.id)
    && !excluded.includes(a.id) && !(offer.finalStage && a.forbidFinalStage));
}
function select(candidates: readonly AugmentDef[], rng: RngState): string {
  if (!candidates.length) throw new Error('augment-pool-exhausted');
  return candidates[randomInt(rng, candidates.length)]!.id;
}
function slotCandidates(seat: SeatState, offer: AugmentOffer, slot: number, excluded: readonly string[]): AugmentDef[] {
  const all = available(seat, offer, excluded);
  if (offer.node <= 1) return all;
  const generic = all.filter(a => a.tailorTraits.length === 0);
  if (slot === 2) return generic.length ? generic : all;
  const tailored = all.filter(a => a.tailorTraits.some(t => offer.eligibleTraits.includes(t)));
  return tailored.length ? tailored : generic.length ? generic : all;
}

export function createRoomAugmentOffers(game: GameState, node: number, tier?: AugmentTier): AugmentOffer[] {
  if (!Number.isInteger(node) || node < 1 || node > MODE_BUDGETS.modes[game.mode].economy.augment_count) throw new RangeError('invalid-augment-node');
  const roomTier = tier ?? tiers[randomInt(game.rng, tiers.length)]!;
  return game.seats.map(seat => {
    const offer: AugmentOffer = {
      tier: roomTier, options: [], rerolls: [true, true, true], node,
      finalStage: node === MODE_BUDGETS.modes[game.mode].economy.augment_count,
      eligibleTraits: seat.previousBattleTraits.filter(t => t.count >= 2 && t.activeTier > 0).map(t => t.traitName),
    };
    for (let slot = 0; slot < 3; slot++) offer.options.push(select(slotCandidates(seat, offer, slot, offer.options), game.rng));
    seat.augmentOffer = offer; return offer;
  });
}

export function rerollAugmentSlot(seat: SeatState, slot: number, rng: RngState): CommandResult {
  const offer = seat.augmentOffer;
  if (!offer || !Number.isInteger(slot) || slot < 0 || slot > 2) return { ok: false, reason: 'invalid-augment-slot' };
  if (!offer.rerolls[slot]) return { ok: false, reason: 'augment-reroll-used' };
  const candidates = slotCandidates(seat, offer, slot, offer.options);
  if (!candidates.length) return { ok: false, reason: 'augment-pool-exhausted' };
  offer.options[slot] = select(candidates, rng); offer.rerolls[slot] = false;
  return { ok: true };
}

export function grantVouchers(seat: SeatState, count: number, round: number): void {
  if (!count) return;
  if (seat.voucherRound !== round) seat.rerollVouchers = 0;
  seat.rerollVouchers += count; seat.voucherRound = round;
}
export function beginAugmentPrep(seat: SeatState, round: number): void {
  if (seat.pendingAugmentRerollRounds > 0) {
    grantVouchers(seat, 2, round); seat.pendingAugmentRerollRounds--;
  }
}

export function pickAugment(seat: SeatState, slot: number, mode: DurationMode, round: number, game: GameState): CommandResult {
  const draft = cloneState(game);
  const nextSeat = draft.seats.find(s => s.id === seat.id);
  if (!nextSeat) return { ok: false, reason: 'seat-not-found' };
  const result = applyAugment(nextSeat, slot, mode, round, draft);
  if (!result.ok) return result;
  const seats = game.seats;
  for (let i = 0; i < seats.length; i++) Object.assign(seats[i]!, draft.seats[i]!);
  Object.assign(game, draft, { seats });
  return result;
}

function applyAugment(seat: SeatState, slot: number, mode: DurationMode, round: number, game: GameState): CommandResult {
  const offer = seat.augmentOffer;
  if (!offer || !Number.isInteger(slot) || slot < 0 || slot >= offer.options.length) return { ok: false, reason: 'invalid-augment-slot' };
  const augment = byId.get(offer.options[slot]!);
  if (!augment || seat.chosenAugments.includes(augment.id)) return { ok: false, reason: 'invalid-augment' };
  if ((offer.finalStage || round >= MODE_BUDGETS.modes[mode].rounds) && augment.forbidFinalStage) return { ok: false, reason: 'augment-forbidden-final-stage' };
  const values = augment.modeValues[mode];
  const number = (key: string) => typeof values[key] === 'number' ? values[key] as number : 0;
  const rng = game.rng;
  seat.chosenAugments.push(augment.id); seat.augmentOffer = null;
  grantGold(seat, number('gold'), augment.id);
  grantVouchers(seat, number('freeRerolls'), round);
  seat.reforgerCharges += number('reforgers');
  seat.magneticCharges = Math.min(1, seat.magneticCharges + number('removerCharge'));
  if (number('nextRoundsRerolls')) seat.pendingAugmentRerollRounds = 2;
  if (number('xp')) addExperience(seat, number('xp'), mode);
  const grantItem = (id: string) => {
    seat.inventoryItems.push(id);
  };
  if (typeof values.compId === 'string') grantItem(values.compId);
  for (let i = 0; i < number('grantRubbing'); i++) grantItem(SEASON1_ITEMS.special.spatulaComponent.id);
  for (const [key, kind] of [['componentAnvils', 'component'], ['completedAnvils', 'completed']] as const) {
    for (let i = 0; i < number(key); i++) {
      const id = `anvil-${game.nextInstanceId++}`;
      createAnvil(seat, kind, rng, id);
    }
  }
  if (number('grant2Cost')) {
    const pool = SEASON1_UNITS.filter(u => u.cost === 2 && game.pool[u.id]! > 0);
    if (!pool.length) return { ok: false, reason: 'POOL_EMPTY' };
    let roll = randomInt(rng, pool.reduce((n, u) => n + game.pool[u.id]!, 0));
    const chosen = pool.find(u => (roll -= game.pool[u.id]!) < 0)!;
    const received = receiveUnit(game, seat, chosen.id); if (!received.ok) return received;
  }
  if (typeof values.unitId === 'string') {
    const received = receiveUnit(game, seat, values.unitId); if (!received.ok) return received;
  }
  if (values.grantCrown) {
    type CrownPackage = { emblemId: string; itemId: string; unitId: string; bonusGold: number };
    const packages = values.crownPackages as Record<string, CrownPackage> | undefined;
    if (!packages || !Object.keys(packages).length) return { ok: false, reason: 'invalid-crown-packages' };
    const choices = Object.entries(packages);
    const weight = (faction: string) => seat.previousBattleTraits.find(t => t.traitName === faction)?.count ?? 0;
    const best = Math.max(...choices.map(([faction]) => weight(faction)));
    const fits = choices.filter(([faction]) => weight(faction) === best);
    const [, crown] = fits[randomInt(rng, fits.length)]!;
    grantItem(crown.emblemId); grantItem(crown.itemId);
    grantGold(seat, crown.bonusGold, `${augment.id}:crown-compensation`);
    const received = receiveUnit(game, seat, crown.unitId); if (!received.ok) return received;
  }
  return { ok: true };
}
