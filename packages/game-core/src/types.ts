import type { AugmentTier, DurationMode, UnitLocation, UnitStar } from '@pkg/contracts';
export interface RngState { state: number }
export interface UnitInstance { instanceId: string; unitId: string; star: UnitStar; location: UnitLocation; items: string[]; cryoRounds: number; frozenUntilRound: number | null; bonusHp: number; bonusSkillEfficiency: number }
export interface GoldEntry { reason: string; amount: number }
export interface AnvilOffer { instanceId: string; kind: 'component' | 'completed'; options: string[] }
export interface AugmentOffer { tier: AugmentTier; options: string[]; rerolls: boolean[]; node: number; finalStage: boolean; eligibleTraits: string[] }
export interface ActiveTrait { traitName: string; count: number; activeTier: number; kind: 'faction' | 'role' | 'unique' }
export interface SeatState { id: string; level: number; xp: number; gold: number; initialGold: number; goldLedger: GoldEntry[]; units: UnitInstance[]; shop: (string | null)[]; shopLocked: boolean; inventoryItems: string[]; magneticCharges: number; reforgerCharges: number; cryoPodEnabled: boolean; chosenAugments: string[]; augmentOffer: AugmentOffer | null; anvils: AnvilOffer[]; previousBattleTraits: ActiveTrait[]; lineupPlan: string[]; victoryPoints: number; pvpWinStreak: number; moraleGoldGranted: number; rerollVouchers: number; voucherRound: number | null; vouchersGranted: number; learningChargeCents: number; learningGoldOrbs: number[]; pendingAugmentRerollRounds: number; pendingLevelFreeRefreshes: number; pendingCommands: unknown[]; isBot: boolean; botDifficulty: 'novice' | 'standard' | 'veteran' }
export interface GameState { mode: DurationMode; round: number; phase: 'prep' | 'battle' | 'finished'; rng: RngState; pool: Record<string, number>; seats: SeatState[]; seatOrder: string[]; nextInstanceId: number; completedNonFinalPvp: number; settledRounds: number[]; itemComponentsGranted: number }
export interface CommandResult { ok: boolean; reason?: string }
