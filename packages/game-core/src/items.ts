import { lookupCraftRecipe, lookupItemById, MAX_UNIT_ITEMS, SEASON1_ITEMS, SEASON1_UNITS_BY_ID } from '@pkg/contracts';
import { randomInt } from './rng.js';
import type { AnvilOffer, CommandResult, RngState, SeatState, UnitInstance } from './types.js';

export interface ItemEquipPreview extends CommandResult { items?: string[]; craftedItemId?: string }

function validateItems(items: readonly string[]): CommandResult {
  if (items.length > MAX_UNIT_ITEMS) return { ok: false, reason: 'item-slots-full' };
  let emblems = 0;
  const unique = new Set<string>();
  for (const id of items) {
    const entry = lookupItemById(id);
    if (!entry) return { ok: false, reason: 'unknown-item' };
    if (entry.kind === 'emblem' && ++emblems > 1) return { ok: false, reason: 'one-emblem-per-unit' };
    if (entry.kind === 'completed' || entry.kind === 'emblem' || entry.kind === 'flag') {
      if (unique.has(id)) return { ok: false, reason: 'duplicate-unique-item' };
      unique.add(id);
    }
  }
  return { ok: true };
}

export function previewItemEquip(unit: UnitInstance, itemId: string): ItemEquipPreview {
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'unit-frozen' };
  const entry = lookupItemById(itemId);
  if (!entry) return { ok: false, reason: 'unknown-item' };
  if (entry.kind === 'component' || entry.kind === 'spatula') {
    let conflict: CommandResult | undefined;
    for (let i = 0; i < unit.items.length; i++) {
      const recipe = lookupCraftRecipe(unit.items[i]!, itemId);
      if (!recipe) continue;
      const items = [...unit.items]; items[i] = recipe.id;
      const check = validateItems(items);
      if (check.ok) return { ok: true, items, craftedItemId: recipe.id };
      conflict = check;
    }
    if (conflict) return conflict;
  }
  const items = [...unit.items, itemId];
  const check = validateItems(items);
  return check.ok ? { ok: true, items } : check;
}

export function equipItem(seat: SeatState, inventoryIndex: number, targetId: string): CommandResult {
  if (!Number.isInteger(inventoryIndex) || inventoryIndex < 0 || inventoryIndex >= seat.inventoryItems.length) return { ok: false, reason: 'invalid-inventory-index' };
  const unit = seat.units.find(u => u.instanceId === targetId);
  if (!unit) return { ok: false, reason: 'unit-not-found' };
  const preview = previewItemEquip(unit, seat.inventoryItems[inventoryIndex]!);
  if (!preview.ok) return { ok: false, reason: preview.reason };
  seat.inventoryItems.splice(inventoryIndex, 1); unit.items = preview.items!;
  return { ok: true };
}

export function useMagneticRemover(seat: SeatState, id: string): CommandResult {
  const unit = seat.units.find(u => u.instanceId === id);
  if (!unit) return { ok: false, reason: 'unit-not-found' };
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'unit-frozen' };
  if (seat.magneticCharges < 1) return { ok: false, reason: 'no-remover-charge' };
  if (!unit.items.length) return { ok: false, reason: 'no-items' };
  seat.inventoryItems.push(...unit.items); unit.items = []; seat.magneticCharges = 0;
  return { ok: true };
}

export function useReforger(seat: SeatState, id: string, rng: RngState): CommandResult {
  const unit = seat.units.find(u => u.instanceId === id);
  if (!unit) return { ok: false, reason: 'unit-not-found' };
  if (unit.frozenUntilRound !== null) return { ok: false, reason: 'unit-frozen' };
  if (seat.reforgerCharges < 1) return { ok: false, reason: 'no-reforger-charge' };
  const replacements: string[] = [], retained: string[] = [];
  for (const itemId of unit.items) {
    const entry = lookupItemById(itemId);
    const pool = entry?.kind === 'component' ? SEASON1_ITEMS.components.map(i => i.id)
      : entry?.kind === 'completed' ? SEASON1_ITEMS.completedItems.map(i => i.id)
      : entry?.kind === 'emblem' ? SEASON1_ITEMS.emblems.map(i => i.id) : [];
    const alternatives = pool.filter(i => i !== itemId);
    if (!alternatives.length) retained.push(itemId);
    else replacements.push(alternatives[randomInt(rng, alternatives.length)]!);
  }
  if (!replacements.length) return { ok: false, reason: 'no-reforgeable-items' };
  unit.items = retained; seat.inventoryItems.push(...replacements); seat.reforgerCharges--;
  return { ok: true };
}

export function itemComponentValue(itemId: string): number {
  const entry = lookupItemById(itemId);
  return !entry ? 0 : entry.kind === 'component' || entry.kind === 'spatula' ? 1 : 2;
}

export interface RecommendedBuild {
  itemId: string;
  name: string;
  components: { itemId: string; owned: boolean; highlight: boolean }[];
  craftable: boolean;
}
export function getUnitRecommendedBuilds(unitId: string, inventoryItems: readonly string[]): RecommendedBuild[] {
  return (SEASON1_UNITS_BY_ID.get(unitId)?.recommendedItems ?? []).flatMap(itemId => {
    const entry = lookupItemById(itemId);
    if (!entry || !('components' in entry.item)) return [];
    const available = [...inventoryItems];
    const components = entry.item.components.map(id => {
      const index = available.indexOf(id); const owned = index >= 0;
      if (owned) available.splice(index, 1);
      return { itemId: id, owned, highlight: owned };
    });
    return [{ itemId, name: entry.item.name, components, craftable: components.every(c => c.owned) }];
  });
}

export function createAnvil(seat: SeatState, kind: AnvilOffer['kind'], rng: RngState, instanceId: string): AnvilOffer {
  if (seat.anvils.some(a => a.instanceId === instanceId)) throw new Error('duplicate-anvil-instance');
  const pool = kind === 'component' ? SEASON1_ITEMS.components.map(i => i.id) : SEASON1_ITEMS.completedItems.map(i => i.id);
  const units = seat.units.filter(u => u.location.zone === 'board' && u.frozenUntilRound === null);
  const candidates = units.length ? units : seat.units;
  const recommended = [...new Set(candidates.flatMap(u => SEASON1_UNITS_BY_ID.get(u.unitId)?.recommendedItems ?? []))];
  const owned = [...seat.inventoryItems, ...candidates.flatMap(u => u.items)];
  const fit: string[] = [];
  for (const id of recommended) {
    const entry = lookupItemById(id);
    if (entry?.kind !== 'completed') continue;
    if (kind === 'completed') fit.push(id);
    else {
      const [a, b] = entry.item.components;
      if (a && b) {
        if (owned.includes(a)) fit.push(b);
        if (owned.includes(b)) fit.push(a);
      }
    }
  }
  const fallback = kind === 'component' ? recommended.flatMap(id => {
    const e = lookupItemById(id); return e?.kind === 'completed' ? e.item.components : [];
  }) : recommended;
  const guarantee = [...new Set((fit.length ? fit : fallback).filter(id => pool.includes(id)))];
  const firstPool = guarantee.length ? guarantee : pool;
  const options = [firstPool[randomInt(rng, firstPool.length)]!];
  while (options.length < (kind === 'component' ? 3 : 4)) {
    const rest = pool.filter(id => !options.includes(id)); options.push(rest[randomInt(rng, rest.length)]!);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1); [options[i], options[j]] = [options[j]!, options[i]!];
  }
  const offer = { instanceId, kind, options }; seat.anvils.push(offer); return offer;
}

export function pickAnvilOption(seat: SeatState, id: string, index: number): CommandResult {
  const at = seat.anvils.findIndex(a => a.instanceId === id);
  if (at < 0) return { ok: false, reason: 'anvil-not-found' };
  const offer = seat.anvils[at]!;
  if (!Number.isInteger(index) || index < 0 || index >= offer.options.length) return { ok: false, reason: 'invalid-option' };
  seat.inventoryItems.push(offer.options[index]!); seat.anvils.splice(at, 1); return { ok: true };
}
