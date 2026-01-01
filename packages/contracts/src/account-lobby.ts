import { z } from 'zod';
import { ArenaThemeIdSchema, DisplaySettingsSchema, DurationModeSchema, QueueTypeSchema } from './modes.js';
import { SubjectIdSchema } from './learning.js';

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
