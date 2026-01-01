import { z } from 'zod';
import { DurationModeSchema } from './modes.js';

export const BOARD_ROWS = 8; 
export const PLAYER_DEPLOY_ROWS = 4;
export const BOARD_COLS = 7;
export const BENCH_SLOTS = 9; 
export const CRYO_BENCH_SLOT = 8;
export const SHOP_SLOTS = 5;
export const MAX_UNIT_ITEMS = 3;
export const LINEUP_PLANNER_MAX_SLOTS = 10;

export const HexCoordSchema = z.object({
  row: z.number().int().min(0).max(BOARD_ROWS - 1),
  col: z.number().int().min(0).max(BOARD_COLS - 1),
});
export type HexCoord = z.infer<typeof HexCoordSchema>;

export const UnitLocationSchema = z.discriminatedUnion('zone', [
  z.object({
    zone: z.literal('board'),
    row: z.number().int().min(0).max(PLAYER_DEPLOY_ROWS - 1),
    col: z.number().int().min(0).max(BOARD_COLS - 1),
  }),
  z.object({
    zone: z.literal('bench'),
    slot: z.number().int().min(0).max(BENCH_SLOTS - 1),
  }),
]);
export type UnitLocation = z.infer<typeof UnitLocationSchema>;

export const UnitStarSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type UnitStar = z.infer<typeof UnitStarSchema>;

export const UnitDefSchema = z.object({
  id: z.string().regex(/^S\d{2}$/),
  name: z.string().min(1).max(7),
  nameLength: z.number().int().min(1).max(7),
  cost: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  poolCopies: z.number().int().positive(),
  faction: z.string().min(1),
  role: z.string().min(1),
  uniqueTrait: z.string().nullable(),
  stats: z.object({
    hp: z.number().int().positive(),
    atk: z.number().int().positive(),
    armor: z.number().int().nonnegative(),
    mr: z.number().int().nonnegative(),
    atkSpeed: z.number().positive(),
    range: z.number().int().min(1).max(5),
    initialMana: z.number().int().nonnegative(),
    maxMana: z.number().int().positive(),
    skillPowerBase: z.number().positive(),
    jumpOnSkill: z.boolean(),
  }),
  starMultipliers: z.record(z.string(), z.number().positive()),
  recommendedItems: z.array(z.string()).min(2).max(3),
  modelProfile: z.object({
    archetype: z.enum(['humanoid_rig', 'hard_surface_vessel']),
    silhouetteDesc: z.string(),
  }),
  skillSummary: z.string(),
  skillSpec: z.record(z.string(), z.unknown()),
});
export type UnitDef = z.infer<typeof UnitDefSchema>;

export const AugmentTierSchema = z.enum(['silver', 'gold', 'prismatic']);
export type AugmentTier = z.infer<typeof AugmentTierSchema>;

export const AugmentDefSchema = z.object({
  id: z.string(),
  tier: AugmentTierSchema,
  name: z.string(),
  category: z.enum(['economy', 'equipment', 'positioning', 'combat', 'trait', 'endgame']),
  tailorTraits: z.array(z.string()),
  forbidFinalStage: z.boolean(),
  desc: z.string(),
  modeValues: z.record(DurationModeSchema, z.record(z.string(), z.unknown())),
});
export type AugmentDef = z.infer<typeof AugmentDefSchema>;

export const GameCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BUY_CARD'), shopIndex: z.number().int().min(0).max(SHOP_SLOTS - 1) }),
  z.object({ type: z.literal('SELL_UNIT'), instanceId: z.string().min(1) }),
  z.object({ type: z.literal('REFRESH_SHOP') }),
  z.object({ type: z.literal('TOGGLE_LOCK_SHOP') }),
  z.object({ type: z.literal('BUY_XP') }),
  z.object({
    type: z.literal('MOVE_UNIT'),
    instanceId: z.string().min(1),
    to: UnitLocationSchema,
  }),
  z.object({
    type: z.literal('EQUIP_ITEM'),
    inventoryItemIndex: z.number().int().nonnegative(),
    targetInstanceId: z.string().min(1),
  }),
  z.object({
    type: z.literal('USE_MAGNETIC_REMOVER'),
    targetInstanceId: z.string().min(1),
  }),
  z.object({
    type: z.literal('USE_REFORGER'),
    targetInstanceId: z.string().min(1),
  }),
  z.object({
    type: z.literal('TOGGLE_CRYO_POD'),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('PICK_ANVIL_OPTION'),
    anvilInstanceId: z.string().min(1),
    optionIndex: z.number().int().min(0).max(3),
  }),
  z.object({
    type: z.literal('REROLL_AUGMENT_SLOT'),
    slotIndex: z.number().int().min(0).max(2),
  }),
  z.object({
    type: z.literal('PICK_AUGMENT'),
    slotIndex: z.number().int().min(0).max(2),
  }),
  z.object({
    type: z.literal('SET_LINEUP_PLAN'),
    unitIds: z.array(z.string()).max(LINEUP_PLANNER_MAX_SLOTS),
  }),
]);
export type GameCommand = z.infer<typeof GameCommandSchema>;

export const BattleOutcomeSchema = z.enum(['win', 'draw', 'loss']);
export type BattleOutcome = z.infer<typeof BattleOutcomeSchema>;

export const UnitCombatTelemetrySchema = z.object({
  instanceId: z.string(),
  unitId: z.string(),
  star: UnitStarSchema,
  physicalDealt: z.number().nonnegative(),
  magicDealt: z.number().nonnegative(),
  trueDealt: z.number().nonnegative(),
  damageTaken: z.number().nonnegative(),
  healingAndShielding: z.number().nonnegative(),
});
export type UnitCombatTelemetry = z.infer<typeof UnitCombatTelemetrySchema>;

export const FinalBoardUnitEntrySchema = z.object({
  unitId: z.string(),
  star: UnitStarSchema,
  items: z.array(z.string()).max(MAX_UNIT_ITEMS),
  row: z.number().int().min(0).max(PLAYER_DEPLOY_ROWS - 1),
  col: z.number().int().min(0).max(BOARD_COLS - 1),
});
export const FinalBoardSnapshotSchema = z.object({
  level: z.number().int().min(3).max(10),
  activeTraits: z.array(z.object({ traitName: z.string(), count: z.number().int(), activeTier: z.number().int() })),
  chosenAugments: z.array(z.string()),
  units: z.array(FinalBoardUnitEntrySchema),
});
export type FinalBoardSnapshot = z.infer<typeof FinalBoardSnapshotSchema>;
