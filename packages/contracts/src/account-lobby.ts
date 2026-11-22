import { z } from 'zod';
import { ArenaThemeIdSchema, DisplaySettingsSchema, DurationModeSchema, QueueTypeSchema } from './modes.js';
import { SubjectIdSchema } from './learning.js';

export const TacticianIdSchema = z.enum(['tactician_lumina_bell', 'tactician_europa_fin', 'tactician_singularity_mew']);
export type TacticianId = z.infer<typeof TacticianIdSchema>;
export const DEFAULT_TACTICIAN_ID = 'tactician_lumina_bell';

export const TACTICIAN_CATALOG = [
  {
    id: 'tactician_lumina_bell', name: '星汐 · 小铃', subtitle: '星潮巡航员', factionLabel: '环地星港',
    tagline: '沿着星潮的回声，为归航点亮一盏灯。', accentColor: '#76e4cf',
  },
  {
    id: 'tactician_europa_fin', name: '冰核 · 小鲸', subtitle: '冰海探测员', factionLabel: '木卫二冰海',
    tagline: '在万米冰层下，用一声鲸歌指明方向。', accentColor: '#83cfff',
  },
  {
    id: 'tactician_singularity_mew', name: '奇点 · 小猫', subtitle: '视界测绘员', factionLabel: '奇点观测站',
    tagline: '用爪尖触碰视界，追踪每一次引力涟漪。', accentColor: '#d9a6fb',
  },
] as const satisfies readonly {
  id: TacticianId; name: string; subtitle: string; factionLabel: string; tagline: string; accentColor: string;
}[];

export const RegisterRequestSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128),
  nickname: z.string().trim().min(1).max(24),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().email().nullable().optional().default(null),
  ),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(3),
  nickname: z.string().min(1),
  emailMasked: z.string().nullable(),
  role: z.enum(['player', 'editor', 'admin']),
  sessionEpoch: z.number().int().positive(),
  onboardingChoice: z.enum(['unset', 'cards', 'micro_match', 'skipped']),
  learningStartSelections: z.partialRecord(SubjectIdSchema, z.string()).default({}),
  preferredArena: ArenaThemeIdSchema.default('orbital_elevator_port'),
  preferredTacticianId: TacticianIdSchema.default(DEFAULT_TACTICIAN_ID),
  displaySettings: DisplaySettingsSchema,
  avatarFrameId: z.string().nullable().default(null),
  boardPlaqueId: z.string().nullable().default(null),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ModeStandingSummarySchema = z.object({
  seasonTermId: z.string().min(1),
  durationMode: DurationModeSchema,
  status: z.enum(['unranked', 'ranked']),
  tierLabel: z.string(),
  rankScore: z.number().int().nullable(),
  leaderboardRank: z.number().int().positive().nullable(),
  matchesPlayed: z.number().int().nonnegative(),
});
export type ModeStandingSummary = z.infer<typeof ModeStandingSummarySchema>;

export const PrepRoomMemberSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  isHost: z.boolean(),
  ready: z.boolean(),
  tacticianId: TacticianIdSchema.default(DEFAULT_TACTICIAN_ID),
  avatarFrameId: z.string().nullable().default(null),
  boardPlaqueId: z.string().nullable().default(null),
});
export type PrepRoomMember = z.infer<typeof PrepRoomMemberSchema>;

export const PrepRoomStateSchema = z.object({
  roomCode: z.string().min(4).max(10),
  durationMode: DurationModeSchema,
  queueType: QueueTypeSchema,
  sharedSubject: SubjectIdSchema,
  hostUserId: z.string(),
  status: z.enum(['idle', 'queuing', 'accept_check', 'in_match']),
  plannedTotalSeconds: z.number().int().positive(),
  members: z.array(PrepRoomMemberSchema).min(1).max(8),
});
export type PrepRoomState = z.infer<typeof PrepRoomStateSchema>;

export const GlobalMatchAcceptPromptSchema = z.object({
  ticketId: z.string(),
  roomCode: z.string(),
  durationMode: DurationModeSchema,
  queueType: z.enum(['ranked', 'casual']),
  deadlineEpochMs: z.number().int().positive(),
  acceptedCount: z.number().int().nonnegative(),
  totalCandidateHumans: z.number().int().positive(),
  selfDecision: z.enum(['pending', 'accepted', 'declined']),
});
export type GlobalMatchAcceptPrompt = z.infer<typeof GlobalMatchAcceptPromptSchema>;

export const GiftCatalogItemSchema = z.object({
  giftId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  pointsCost: z.number().int().positive(),
  stockRemaining: z.number().int().nonnegative(),
  isSampleReward: z.boolean().default(true),
});
export type GiftCatalogItem = z.infer<typeof GiftCatalogItemSchema>;

export const RedeemRequestSchema = z.object({
  giftId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128),
});
export type RedeemRequest = z.infer<typeof RedeemRequestSchema>;

export const RedeemOrderSchema = z.object({
  orderId: z.string(),
  giftId: z.string(),
  giftTitle: z.string(),
  pointsDelta: z.number().int().positive(),
  status: z.enum(['confirmed', 'pending_verify', 'cancelled_compensated']),
  idempotencyKey: z.string(),
  createdAtIso: z.string(),
});
export type RedeemOrder = z.infer<typeof RedeemOrderSchema>;
