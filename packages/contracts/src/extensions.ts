import { z } from 'zod';

export const CommunicationChannelSchema = z.enum(['room', 'match', 'direct']);
export type CommunicationChannel = z.infer<typeof CommunicationChannelSchema>;

export const CommunicationKindSchema = z.enum(['text', 'signal', 'emote']);
export type CommunicationKind = z.infer<typeof CommunicationKindSchema>;

export const CommunicationClientSendSchema = z.object({
  clientMsgId: z.string().min(1).max(64),
  channel: CommunicationChannelSchema,
  targetId: z.string().min(1).max(64),
  kind: CommunicationKindSchema,
  payload: z.string().min(1).max(500),
});
export type CommunicationClientSend = z.infer<typeof CommunicationClientSendSchema>;

export const CommunicationEnvelopeSchema = z.object({
  msgId: z.string().min(1),
  channel: CommunicationChannelSchema,
  targetId: z.string().min(1),
  kind: CommunicationKindSchema,
  senderUserId: z.string().min(1),
  senderNickname: z.string().min(1),
  payload: z.string().min(1).max(500),
  createdAtEpochMs: z.number().int().positive(),
});
export type CommunicationEnvelope = z.infer<typeof CommunicationEnvelopeSchema>;

export interface CommunicationGovernancePolicy {
  readonly allowTextChat: boolean;
  readonly allowSignalsAndEmotes: boolean;
  readonly rateLimitWindowMs: number;
  readonly maxMessagesPerWindow: number;
  isSenderBlocked(receiverUserId: string, senderUserId: string): boolean;
  filterTextPayload(raw: string): { allowed: boolean; sanitized: string; reason?: string };
}

export class ConfigurableCommunicationPolicy implements CommunicationGovernancePolicy {
  public readonly allowTextChat: boolean;
  public readonly allowSignalsAndEmotes: boolean;
  public readonly rateLimitWindowMs: number;
  public readonly maxMessagesPerWindow: number;
  private readonly blockedByReceiver = new Map<string, Set<string>>();

  constructor(opts?: {
    allowTextChat?: boolean;
    allowSignalsAndEmotes?: boolean;
    rateLimitWindowMs?: number;
    maxMessagesPerWindow?: number;
  }) {
    this.allowTextChat = opts?.allowTextChat ?? false;
    this.allowSignalsAndEmotes = opts?.allowSignalsAndEmotes ?? false;
    this.rateLimitWindowMs = opts?.rateLimitWindowMs ?? 5000;
    this.maxMessagesPerWindow = opts?.maxMessagesPerWindow ?? 5;
  }

  public setBlock(receiverUserId: string, senderUserId: string, blocked: boolean): void {
    let set = this.blockedByReceiver.get(receiverUserId);
    if (!set) {
      set = new Set();
      this.blockedByReceiver.set(receiverUserId, set);
    }
    if (blocked) set.add(senderUserId);
    else set.delete(senderUserId);
  }

  public isSenderBlocked(receiverUserId: string, senderUserId: string): boolean {
    return this.blockedByReceiver.get(receiverUserId)?.has(senderUserId) ?? false;
  }

  public filterTextPayload(raw: string): { allowed: boolean; sanitized: string; reason?: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { allowed: false, sanitized: '', reason: 'empty_message' };
    return { allowed: true, sanitized: trimmed.slice(0, 500) };
  }
}

export interface AudioCoreEventPayloads {
  onPhaseChange: { phase: string; roundIndex: number };
  onUnitPurchase: { unitId: string; cost: number };
  onUnitStarUp: { unitId: string; newStar: 2 | 3 };
  onBattleStart: { roundIndex: number; isPve: boolean };
  onSkillCast: { unitId: string; casterInstanceId: string };
  onUnitDeath: { instanceId: string };
  onRoundResult: { outcome: 'win' | 'draw' | 'loss'; quarterPointsEarned: number };
  onLessonAudioPlay: { audioRef: string };
}

export interface AudioExtendedEventPayloads {
  onShopAction: { action: 'reroll' | 'sell' | 'lock' | 'buy_xp' | 'level_up' };
  onUnitMove: { kind: 'pick' | 'drop' };
  onItemAction: { action: 'equip' | 'combine' | 'remover' | 'reforge' };
  onLootOrb: { action: 'drop' | 'collect'; gold?: number };
  onUiFeedback: {
    kind: 'click' | 'hover' | 'open' | 'close' | 'toggle' | 'error' | 'augment_pick' | 'match_accept';
  };
  onLearningFeedback: { correct: boolean };
  onCombatHit: { damageType: 'physical' | 'magic' | 'true' };
  onBgmContext: {
    scene: 'lobby' | 'match' | 'subpage';
    roundIndex?: number;
    totalRounds?: number;
    phase?: string;
    isOvertime?: boolean;
    focusDuck?: boolean;
  };
}

export interface AudioEventPayloads extends AudioCoreEventPayloads, AudioExtendedEventPayloads {}

export type AudioAdapter = {
  [K in keyof AudioCoreEventPayloads]: (payload: AudioCoreEventPayloads[K]) => void;
} & {
  [K in keyof AudioExtendedEventPayloads]?: (payload: AudioExtendedEventPayloads[K]) => void;
};

export const NullAudioAdapter: Required<AudioAdapter> = {
  onPhaseChange: () => {},
  onUnitPurchase: () => {},
  onUnitStarUp: () => {},
  onBattleStart: () => {},
  onSkillCast: () => {},
  onUnitDeath: () => {},
  onRoundResult: () => {},
  onLessonAudioPlay: () => {},
  onShopAction: () => {},
  onUnitMove: () => {},
  onItemAction: () => {},
  onLootOrb: () => {},
  onUiFeedback: () => {},
  onLearningFeedback: () => {},
  onCombatHit: () => {},
  onBgmContext: () => {},
};

export class AudioEventBus {
  private adapter: AudioAdapter = NullAudioAdapter;

  public setAdapter(adapter: AudioAdapter): void {
    this.adapter = adapter;
  }

  public emit<K extends keyof AudioEventPayloads>(event: K, payload: AudioEventPayloads[K]): void {
    const handler = this.adapter[event] as ((payload: AudioEventPayloads[K]) => void) | undefined;
    handler?.call(this.adapter, payload);
  }
}

export const QuestionIssueReportSchema = z.object({
  questionId: z.string().min(1),
  packVersion: z.string().min(1),
  attemptRef: z.string().min(1),
  reasonCode: z.enum(['typo_or_formula', 'ambiguous_stem', 'wrong_answer_key', 'media_broken', 'other']),
  detailOptional: z.string().max(300).optional(),
});
export type QuestionIssueReport = z.infer<typeof QuestionIssueReportSchema>;
