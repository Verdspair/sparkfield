import modeBudgetsJson from '../../../content/modes/mode-budgets.json' with { type: 'json' };
import unitsJson from '../../../content/game/units.json' with { type: 'json' };
import traitsJson from '../../../content/game/traits.json' with { type: 'json' };
import itemsJson from '../../../content/game/items.json' with { type: 'json' };
import augmentsJson from '../../../content/game/augments.json' with { type: 'json' };
import season1LoreJson from '../../../content/lore/season1-lore.json' with { type: 'json' };
import { AugmentDefSchema, UnitDefSchema, type AugmentDef, type UnitDef } from './game.js';

export const MODE_BUDGETS = modeBudgetsJson;
export const SEASON1_UNITS: readonly UnitDef[] = unitsJson.units.map((u) => UnitDefSchema.parse(u));
export const SEASON1_UNITS_BY_ID: ReadonlyMap<string, UnitDef> = new Map(SEASON1_UNITS.map((u) => [u.id, u]));
export const SEASON1_TRAITS = traitsJson;
export const SEASON1_ITEMS = itemsJson;
export const SEASON1_AUGMENTS: readonly AugmentDef[] = augmentsJson.augments.map((a) => AugmentDefSchema.parse(a));
export const SEASON1_LORE = season1LoreJson;

const recipeMap = new Map<string, (typeof itemsJson.completedItems)[number] | (typeof itemsJson.emblems)[number] | typeof itemsJson.special.mothershipFlag>();
for (const item of itemsJson.completedItems) {
  const key = [...item.components].sort().join('+');
  recipeMap.set(key, item);
}
for (const emb of itemsJson.emblems) {
  const key = [...emb.components].sort().join('+');
  recipeMap.set(key, emb);
}
recipeMap.set('C_RUBBING+C_RUBBING', itemsJson.special.mothershipFlag);

export function lookupCraftRecipe(compA: string, compB: string) {
  const key = [compA, compB].sort().join('+');
  return recipeMap.get(key) ?? null;
}

export function lookupItemById(itemId: string) {
  const comp = itemsJson.components.find((c) => c.id === itemId);
  if (comp) return { kind: 'component' as const, item: comp };
  if (itemId === itemsJson.special.spatulaComponent.id) {
    return { kind: 'spatula' as const, item: itemsJson.special.spatulaComponent };
  }
  const completed = itemsJson.completedItems.find((i) => i.id === itemId);
  if (completed) return { kind: 'completed' as const, item: completed };
  const emblem = itemsJson.emblems.find((e) => e.id === itemId);
  if (emblem) return { kind: 'emblem' as const, item: emblem };
  if (itemId === itemsJson.special.mothershipFlag.id) {
    return { kind: 'flag' as const, item: itemsJson.special.mothershipFlag };
  }
  return null;
}
