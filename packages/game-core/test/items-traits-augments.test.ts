import { describe, expect, it } from 'vitest';
import { MODE_BUDGETS, SEASON1_AUGMENTS, SEASON1_ITEMS, SEASON1_TRAITS, SEASON1_UNITS, lookupCraftRecipe, type DurationMode } from '@pkg/contracts';
import { computeActiveTraits, beginCryoPrep, toggleCryoPod } from '../src/traits.js';
import { createAnvil, equipItem, getUnitRecommendedBuilds, itemComponentValue, pickAnvilOption, previewItemEquip, useMagneticRemover, useReforger } from '../src/items.js';
import { beginAugmentPrep, createRoomAugmentOffers, pickAugment, rerollAugmentSlot } from '../src/augments.js';
import { assertGoldConservation } from '../src/economy.js';
import { assertPoolConservation, createPool } from '../src/pool.js';
import { cloneState, createRng, hashState } from '../src/rng.js';
import type { GameState, SeatState, UnitInstance } from '../src/types.js';

function unit(unitId = 'S01', instanceId = unitId): UnitInstance {
  return { unitId, instanceId, star: 1, location: { zone: 'board', row: 0, col: 0 }, items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0 };
}
function seat(id = 'a'): SeatState {
  return { id, level: 4, xp: 0, gold: 20, initialGold: 20, goldLedger: [], units: [], shop: Array(5).fill(null), shopLocked: false,
    inventoryItems: [], magneticCharges: 1, reforgerCharges: 0, cryoPodEnabled: false, chosenAugments: [], augmentOffer: null,
    anvils: [], previousBattleTraits: [], lineupPlan: [], victoryPoints: 0, pvpWinStreak: 0, moraleGoldGranted: 0,
    rerollVouchers: 0, voucherRound: null, vouchersGranted: 0, learningChargeCents: 0, learningGoldOrbs: [],
    pendingAugmentRerollRounds: 0, pendingLevelFreeRefreshes: 0, pendingCommands: [], isBot: false, botDifficulty: 'standard' };
}
function game(mode: DurationMode = 'standard'): GameState {
  return { mode, round: 2, phase: 'prep', rng: createRng(11), pool: createPool(), seats: [seat()], seatOrder: ['a'],
    nextInstanceId: 100, completedNonFinalPvp: 0, settledRounds: [], itemComponentsGranted: 0 };
}
function offer(s: SeatState, id: string, finalStage = false): void {
  const a = SEASON1_AUGMENTS.find(a => a.id === id)!;
  s.augmentOffer = { tier: a.tier, options: [id], rerolls: [true, true, true], node: 1, finalStage, eligibleTraits: [] };
}
function itemValue(s: SeatState): number {
  return [...s.inventoryItems, ...s.units.flatMap(u => u.items)].reduce((n, id) => n + itemComponentValue(id), 0)
    + s.anvils.reduce((n, a) => n + (a.kind === 'component' ? 1 : 2), 0);
}

describe('distinct-card traits', () => {
  it('counts all 8 factions, 6 roles and 4 uniques from content', () => {
    const traits = computeActiveTraits(SEASON1_UNITS.map(u => unit(u.id)));
    expect(traits).toHaveLength(18);
    for (const def of [...SEASON1_TRAITS.factions, ...SEASON1_TRAITS.roles, ...SEASON1_TRAITS.uniques]) {
      const actual = traits.find(t => t.traitName === def.name)!;
      expect(actual.activeTier).toBe(def.thresholds.filter(t => t <= ('nativeCount' in def ? def.nativeCount : 1)).length);
      expect(actual.count).toBe('nativeCount' in def ? def.nativeCount : 1);
    }
  });
  it('does not count duplicate cards, bench cards or frozen cards', () => {
    const b = unit('S02'); b.location = { zone: 'bench', slot: 0 };
    const c = unit('S10'); c.frozenUntilRound = 3;
    const traits = computeActiveTraits([unit('S01', 'one'), unit('S01', 'two'), b, c]);
    expect(traits.find(t => t.traitName === '戴森工团')).toMatchObject({ count: 1, activeTier: 0 });
  });
  it('caps faction emblems at one and does not count a native emblem twice', () => {
    const natives = SEASON1_UNITS.filter(u => u.faction === '戴森工团').map(u => unit(u.id));
    natives[0]!.items = ['E_DYSON'];
    expect(computeActiveTraits(natives).find(t => t.traitName === '戴森工团')?.count).toBe(6);
    const a = unit('S03'); a.items = ['E_DYSON'];
    const b = unit('S04'); b.items = ['E_DYSON'];
    expect(computeActiveTraits([...natives, a, b]).find(t => t.traitName === '戴森工团')).toMatchObject({ count: 7, activeTier: 4 });
  });
});

describe('atomic equipment and tools', () => {
  it('crafts every ordinary recipe and emblem and flag without losing component shares', () => {
    const recipes = [...SEASON1_ITEMS.completedItems, ...SEASON1_ITEMS.emblems, SEASON1_ITEMS.special.mothershipFlag];
    for (const recipe of recipes) {
      const u = unit(); u.items = [recipe.components[0]!];
      const preview = previewItemEquip(u, recipe.components[1]!);
      expect(preview).toMatchObject({ ok: true, items: [recipe.id], craftedItemId: recipe.id });
      expect(u.items).toEqual([recipe.components[0]]);
      expect(itemComponentValue(recipe.id)).toBe(2);
      expect(lookupCraftRecipe(recipe.components[1]!, recipe.components[0]!)?.id).toBe(recipe.id);
    }
  });
  it('allows crafting at three slots but rejects a fourth item and duplicate unique result', () => {
    const u = unit(); u.items = ['I_NEUTRON_PLATE', 'I_ONEILL_ARMOR', 'C_ROD'];
    expect(previewItemEquip(u, 'C_ROD')).toMatchObject({ ok: true, craftedItemId: 'I_STELLAR_CROWN' });
    expect(previewItemEquip(u, 'I_FUSION_BLADE').ok).toBe(false);
    u.items = ['I_FUSION_BLADE', 'C_SWORD'];
    expect(previewItemEquip(u, 'C_SWORD').ok).toBe(false);
    expect(previewItemEquip(u, 'I_FUSION_BLADE').ok).toBe(false);
  });
  it('rejects a second emblem, including one crafted in place, without spending inventory', () => {
    const s = seat(); s.units = [unit()]; s.units[0]!.items = ['E_DYSON', 'C_TEAR']; s.inventoryItems = ['C_RUBBING'];
    const before = hashState(s);
    expect(equipItem(s, 0, 'S01').ok).toBe(false); expect(hashState(s)).toBe(before);
    expect(previewItemEquip(s.units[0]!, 'E_CLOUD').ok).toBe(false);
  });
  it('equips atomically, rejects invalid indices and unknown items', () => {
    const s = seat(); s.units = [unit()]; s.inventoryItems = ['C_SWORD', 'C_BOW'];
    expect(equipItem(s, -1, 'S01').ok).toBe(false);
    expect(previewItemEquip(s.units[0]!, 'wrong').ok).toBe(false);
    expect(equipItem(s, 0, 'S01').ok).toBe(true); expect(equipItem(s, 0, 'S01').ok).toBe(true);
    expect(s.units[0]!.items).toEqual(['I_LORENTZ_RAIL']); expect(s.inventoryItems).toEqual([]);
    expect(itemValue(s)).toBe(2);
  });
  it('removes all equipment without loss and uses exactly one charge', () => {
    const s = seat(); s.units = [unit()]; s.units[0]!.items = ['I_FUSION_BLADE', 'C_TEAR', 'E_CLOUD'];
    const before = itemValue(s);
    expect(useMagneticRemover(s, 'S01').ok).toBe(true); expect(itemValue(s)).toBe(before);
    expect(s.magneticCharges).toBe(0); expect(s.units[0]!.items).toEqual([]);
    expect(useMagneticRemover(s, 'S01').ok).toBe(false);
  });
  it('reforges to other same-grade items, keeps protected items, and preserves every share', () => {
    const s = seat(); s.units = [unit()]; s.units[0]!.items = ['C_SWORD', 'I_FUSION_BLADE', 'I_MOTHERSHIP_FLAG']; s.reforgerCharges = 1;
    const before = itemValue(s); const b = cloneState(s);
    expect(useReforger(s, 'S01', createRng(10)).ok).toBe(true);
    expect(useReforger(b, 'S01', createRng(10)).ok).toBe(true); expect(s).toEqual(b);
    expect(itemValue(s)).toBe(before); expect(s.units[0]!.items).toEqual(['I_MOTHERSHIP_FLAG']);
    expect(s.inventoryItems).not.toContain('C_SWORD'); expect(s.inventoryItems).not.toContain('I_FUSION_BLADE');
    const c = seat(); c.units = [unit()]; c.units[0]!.items = ['C_RUBBING', 'I_MOTHERSHIP_FLAG']; c.reforgerCharges = 1;
    expect(useReforger(c, 'S01', createRng(10)).ok).toBe(false); expect(c.reforgerCharges).toBe(1); expect(itemValue(c)).toBe(3);
  });
  it('rejects all equipment actions on frozen units', () => {
    const s = seat(); s.units = [unit()]; s.units[0]!.items = ['C_SWORD']; s.units[0]!.frozenUntilRound = 3; s.reforgerCharges = 1;
    expect(previewItemEquip(s.units[0]!, 'C_BOW').ok).toBe(false);
    expect(useMagneticRemover(s, 'S01').ok).toBe(false); expect(useReforger(s, 'S01', createRng(1)).ok).toBe(false);
  });
  it('shows recipe highlights with correct repeated-component quantities', () => {
    const builds = getUnitRecommendedBuilds('S04', ['C_ROD']);
    const crown = builds.find(b => b.itemId === 'I_STELLAR_CROWN')!;
    expect(crown.components.map(c => c.highlight)).toEqual([true, false]); expect(crown.craftable).toBe(false);
    expect(getUnitRecommendedBuilds('S04', ['C_ROD', 'C_ROD'])[0]!.craftable).toBe(true);
    expect(getUnitRecommendedBuilds('invalid', [])).toEqual([]);
  });
});

describe('tailored anvils', () => {
  it('guarantees a craftable recommendation and distinct options for many seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = seat(); s.units = [unit('S04')]; s.inventoryItems = ['C_ROD'];
      const a = createAnvil(s, 'component', createRng(seed), `a-${seed}`);
      expect(a.options).toHaveLength(3); expect(new Set(a.options).size).toBe(3);
      expect(a.options.some(id => id === 'C_ROD' || id === 'C_TEAR')).toBe(true);
      const b = createAnvil(s, 'completed', createRng(seed), `b-${seed}`);
      expect(b.options).toHaveLength(4); expect(new Set(b.options).size).toBe(4);
      expect(b.options.some(id => ['I_STELLAR_CROWN', 'I_SUPERCOMP_ARRAY'].includes(id))).toBe(true);
    }
  });
  it('picks exactly once and never loses an anvil on invalid choice', () => {
    const s = seat(); const a = createAnvil(s, 'completed', createRng(1), 'a'); const before = itemValue(s);
    expect(pickAnvilOption(s, 'a', -1).ok).toBe(false); expect(s.anvils).toHaveLength(1);
    expect(pickAnvilOption(s, 'a', 0).ok).toBe(true); expect(s.inventoryItems).toEqual([a.options[0]]);
    expect(itemValue(s)).toBe(before); expect(pickAnvilOption(s, 'a', 0).ok).toBe(false);
  });
});

describe('cryo and magnetic recharge', () => {
  it.each(['quick', 'standard', 'deep'] as const)('enforces one-round cryo, two rewards, final-round ban in %s', mode => {
    const s = seat(); const target = unit('S01'); target.location = { zone: 'bench', slot: 8 }; s.units = [unit('S02'), unit('S05'), target];
    s.chosenAugments = ['AUG_S02'];
    expect(toggleCryoPod(s, true, 1, mode).ok).toBe(true); expect(toggleCryoPod(s, false, 1, mode).ok).toBe(false);
    beginCryoPrep(s, 1, mode); expect(target.bonusHp).toBe(0);
    beginCryoPrep(s, 2, mode); expect(target.bonusHp).toBe(180); expect(target.bonusSkillEfficiency).toBe(12);
    beginCryoPrep(s, 2, mode); expect(target.bonusHp).toBe(180);
    expect(toggleCryoPod(s, true, 2, mode).ok).toBe(true); beginCryoPrep(s, 3, mode);
    expect(target.cryoRounds).toBe(2); expect(target.bonusHp).toBe(360); expect(toggleCryoPod(s, true, 3, mode).ok).toBe(false);
    target.cryoRounds = 0; expect(toggleCryoPod(s, true, MODE_BUDGETS.modes[mode].rounds, mode).ok).toBe(false);
    const rounds: readonly number[] = MODE_BUDGETS.economy_and_event_policy.magnetic_remover.recharge_to_one_rounds[mode];
    for (let r = 1; r <= MODE_BUDGETS.modes[mode].rounds; r++) { s.magneticCharges = 0; beginCryoPrep(s, r, mode); expect(s.magneticCharges).toBe(rounds.includes(r) ? 1 : 0); }
  });
  it('requires an active biocare and a real ninth-slot target', () => {
    const s = seat(); expect(toggleCryoPod(s, true, 1, 'quick').ok).toBe(false);
    s.units = [unit('S02'), unit('S05')]; expect(toggleCryoPod(s, true, 1, 'quick').ok).toBe(false);
  });
});

describe('room augment offers and actual rewards', () => {
  it('uses one room tier and unique options, one independent reroll per slot', () => {
    const g = game(); g.seats.push(seat('b')); const offers = createRoomAugmentOffers(g, 1);
    expect(offers[0]!.tier).toBe(offers[1]!.tier);
    for (const s of g.seats) {
      expect(new Set(s.augmentOffer!.options).size).toBe(3);
      const old = [...s.augmentOffer!.options]; expect(rerollAugmentSlot(s, 0, g.rng).ok).toBe(true);
      expect(s.augmentOffer!.options[0]).not.toBe(old[0]); expect(s.augmentOffer!.options.slice(1)).toEqual(old.slice(1));
      expect(rerollAugmentSlot(s, 0, g.rng).ok).toBe(false); expect(s.augmentOffer!.rerolls.slice(1)).toEqual([true, true]);
    }
  });
  it('tailors two later slots from the previous battle and reserves one generic', () => {
    const g = game(); const s = g.seats[0]!;
    s.previousBattleTraits = ['戴森工团', '云端星环'].map(traitName => ({ traitName, count: 2, activeTier: 1, kind: 'faction' }));
    createRoomAugmentOffers(g, 2, 'gold');
    const defs = s.augmentOffer!.options.map(id => SEASON1_AUGMENTS.find(a => a.id === id)!);
    expect(defs.slice(0, 2).map(d => d.id).sort()).toEqual(['AUG_G03', 'AUG_G04']); expect(defs[2]!.tailorTraits).toEqual([]);
    s.previousBattleTraits = []; createRoomAugmentOffers(g, 2, 'gold');
    expect(s.augmentOffer!.options.every(id => SEASON1_AUGMENTS.find(a => a.id === id)!.tailorTraits.length === 0)).toBe(true);
  });
  it.each(['quick', 'standard', 'deep'] as const)('excludes delayed-growth augments at the final node in %s', mode => {
    for (const tier of ['silver', 'gold', 'prismatic'] as const) {
      const g = game(mode); const s = g.seats[0]!; createRoomAugmentOffers(g, MODE_BUDGETS.modes[mode].economy.augment_count, tier);
      expect(s.augmentOffer!.options.every(id => !SEASON1_AUGMENTS.find(a => a.id === id)!.forbidFinalStage)).toBe(true);
      rerollAugmentSlot(s, 0, g.rng); expect(s.augmentOffer!.options.every(id => !SEASON1_AUGMENTS.find(a => a.id === id)!.forbidFinalStage)).toBe(true);
    }
  });
  it.each(['quick', 'standard', 'deep'] as const)('picks all 24 augments with real grants and conservation in %s', mode => {
    for (const a of SEASON1_AUGMENTS) {
      const g = game(mode); const s = g.seats[0]!; offer(s, a.id);
      const before = hashState(g); expect(pickAugment(s, 0, mode, 2, g).ok, a.id).toBe(true);
      expect(hashState(g)).not.toBe(before); expect(s.chosenAugments).toContain(a.id); expect(s.augmentOffer).toBeNull();
      assertGoldConservation(s); assertPoolConservation(g);
      const v = a.modeValues[mode];
      const numeric = (key: string) => typeof v[key] === 'number' ? v[key] as number : 0;
      const expectedShares = numeric('componentAnvils') + 2 * numeric('completedAnvils') + numeric('grantRubbing')
        + (typeof v.compId === 'string' ? 1 : 0) + (v.grantCrown ? 4 : 0);
      expect(itemValue(s)).toBe(expectedShares);
      expect(g.itemComponentsGranted).toBe(0);
      const values = a.modeValues[mode]; if (typeof values.gold === 'number') expect(s.gold).toBe(20 + values.gold);
      if (typeof values.unitId === 'string') expect(s.units.some(u => u.unitId === values.unitId)).toBe(true);
      if (a.id === 'AUG_S02') expect(s.units[0] && SEASON1_UNITS.find(u => u.id === s.units[0]!.unitId)?.cost).toBe(2);
      if (a.id === 'AUG_P04') expect(s.units).toHaveLength(1);
      expect(pickAugment(s, 0, mode, 2, g).ok).toBe(false);
    }
  });
  for (const mode of ['quick', 'standard', 'deep'] as const) {
    it.each([
      ['戴森工团', 'E_DYSON', 'I_POLAR_SHIELD_ARMOR', 'S28', 0],
      ['钟慢远征', 'E_DILATION', 'I_FUSION_BLADE', 'S29', 0],
      ['云端星环', 'E_CLOUD', 'I_STELLAR_CROWN', 'S20', 1],
    ] as const)(`${mode}: grants the exact configured %s crown package with equal card/gold value`, (faction, emblem, item, unitId, bonusGold) => {
      const g = game(mode); const s = g.seats[0]!;
      s.previousBattleTraits = [{ traitName: faction, count: 4, activeTier: 2, kind: 'faction' }];
      offer(s, 'AUG_P04'); expect(pickAugment(s, 0, mode, 2, g).ok).toBe(true);
      expect(s.units.map(u => u.unitId)).toEqual([unitId]); expect(s.inventoryItems).toEqual([emblem, item]);
      expect(s.gold).toBe(s.initialGold + bonusGold);
      expect(SEASON1_UNITS.find(u => u.id === unitId)!.cost + bonusGold).toBe(4);
      expect(itemValue(s)).toBe(4); assertGoldConservation(s); assertPoolConservation(g);
      if (bonusGold) expect(s.goldLedger).toContainEqual({ reason: 'AUG_P04:crown-compensation', amount: bonusGold });
    });
  }
  it('G02 gives two vouchers at each of exactly the next two prep starts', () => {
    const g = game(); const s = g.seats[0]!; offer(s, 'AUG_G02'); pickAugment(s, 0, 'standard', 2, g);
    expect(s.rerollVouchers).toBe(0); expect(s.pendingAugmentRerollRounds).toBe(2);
    beginAugmentPrep(s, 3); expect(s.rerollVouchers).toBe(2); beginAugmentPrep(s, 4); expect(s.rerollVouchers).toBe(2);
    expect(s.pendingAugmentRerollRounds).toBe(0); s.rerollVouchers = 0; beginAugmentPrep(s, 5); expect(s.rerollVouchers).toBe(0);
  });
  it('rejects a full-bench card reward without touching RNG, offer, pool or any ledger', () => {
    const g = game(); const s = g.seats[0]!;
    s.units = SEASON1_UNITS.slice(0, 9).map((d, slot) => { g.pool[d.id]!--; const u = unit(d.id); u.location = { zone: 'bench', slot }; return u; });
    offer(s, 'AUG_G03'); const before = hashState(g);
    expect(pickAugment(s, 0, 'standard', 2, g).ok).toBe(false); expect(hashState(g)).toBe(before); assertPoolConservation(g);
  });
  it('replays offers, rerolls and reward choices with the same seed', () => {
    const a = game(), b = cloneState(a);
    for (const g of [a, b]) { createRoomAugmentOffers(g, 1, 'gold'); rerollAugmentSlot(g.seats[0]!, 1, g.rng); pickAugment(g.seats[0]!, 0, 'standard', 2, g); }
    expect(hashState(a)).toBe(hashState(b));
  });
});
