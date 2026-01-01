import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ArenaThemeIdSchema, CommunicationClientSendSchema, CommunicationEnvelopeSchema,
  ConfigurableCommunicationPolicy, DisplaySettingsSchema, DurationModeSchema,
  PrepRoomStateSchema, QueueTypeSchema, SubjectIdSchema, UserProfileSchema,
  type ArenaThemeId, type CommunicationClientSend, type CommunicationEnvelope,
  type CommunicationGovernancePolicy, type DisplaySettings, type DurationMode,
  type GlobalMatchAcceptPrompt, type PrepRoomState, type QueueType, type SubjectId,
  type UserProfile,
} from '@pkg/contracts';
import { ServiceError } from '../db/errors.js';

export interface MemberPrefs {
  subject: SubjectId;
  learningStartSelections: UserProfile['learningStartSelections'];
  preferredArena: ArenaThemeId;
  displaySettings: DisplaySettings;
}
export interface MatchCreationResult {
  roomId: string;
  matchId: string;
  seatIds?: Record<string, string>;
}
export interface CreateMatchInput {
  ticketId: string;
  durationMode: DurationMode;
  queueType: QueueType;
  sharedSubject: SubjectId;
  humans: UserProfile[];
  humanPrefs: Record<string, MemberPrefs>;
  prepRoomCodes: string[];
}
export interface MatchingWindow {
  initialScoreGap: number;
  widenPerSecond: number;
  maxScoreGap: number;
}
export interface LobbyServiceOptions {
  createMatch: (input: CreateMatchInput) => MatchCreationResult | Promise<MatchCreationResult>;
  matchWaitMs?: number;
  acceptWaitMs?: number;
  matchingWindow?: MatchingWindow;
  scoreCandidate?: (profile: UserProfile, mode: DurationMode) => number | Promise<number>;
  communicationPolicy?: CommunicationGovernancePolicy;
}
export interface LobbyState {
  prepRoom: PrepRoomState | null;
  acceptPrompt: GlobalMatchAcceptPrompt | null;
  match: { roomId: string; matchId: string; seatId?: string } | null;
  selfPrefs: MemberPrefs | null;
  lastError?: string;
}
export interface CommunicationDelivery {
  message: CommunicationEnvelope;
  recipientUserIds: string[];
}
const SettingsSchema = z.object({
  durationMode: DurationModeSchema.optional(), queueType: QueueTypeSchema.optional(),
  sharedSubject: SubjectIdSchema.optional(),
}).strict();
const EnterModeSchema = SettingsSchema.extend({ durationMode: DurationModeSchema });
const MemberPrefsPatchSchema = z.object({
  ready: z.boolean().optional(), subject: SubjectIdSchema.optional(),
  learningStartSelections: z.partialRecord(SubjectIdSchema, z.string().min(1).max(128)).optional(),
  preferredArena: ArenaThemeIdSchema.optional(), displaySettings: DisplaySettingsSchema.optional(),
}).strict();
const AcceptSchema = z.object({ ticketId: z.string().min(1), accept: z.boolean() }).strict();
const BlockSchema = z.object({ senderUserId: z.string().min(1), blocked: z.boolean() }).strict();
const PLANNED_SECONDS: Record<DurationMode, number> = { quick: 900, standard: 1800, deep: 3600 };
type Decision = 'pending' | 'accepted' | 'declined';
interface Member { profile: UserProfile; prefs: MemberPrefs; ready: boolean }
interface PrepRoom {
  code: string; durationMode: DurationMode; queueType: QueueType; sharedSubject: SubjectId;
  hostUserId: string; members: Map<string, Member>;
  queuedAt: number | null; queueOrder: number; ticketId: string | null;
  starting: string | null; partyScore: number;
  messages: Array<{ clientMsgId: string; envelope: CommunicationEnvelope }>;
}
interface Candidate { userId: string; roomCode: string; profile: UserProfile; prefs: MemberPrefs; decision: Decision }
interface Ticket {
  id: string; durationMode: DurationMode; queueType: QueueType; sharedSubject: SubjectId;
  candidates: Candidate[]; deadline: number; timer: ReturnType<typeof setTimeout> | null;
  finalizing: Promise<void> | null; locked: boolean;
}
interface LastEntry { profile: UserProfile; durationMode: DurationMode; queueType: QueueType; sharedSubject: SubjectId; prefs: MemberPrefs }
const clone = <T>(value: T): T => structuredClone(value);
function duration(value: number | undefined, fallback: number, name: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 0 || result > 2_147_483_647) throw new Error(`Invalid ${name}`);
  return result;
}

export class LobbyService {
  private readonly rooms = new Map<string, PrepRoom>();
  private readonly userRooms = new Map<string, string>();
  private readonly userTickets = new Map<string, string>();
  private readonly tickets = new Map<string, Ticket>();
  private readonly matches = new Map<string, NonNullable<LobbyState['match']>>();
  private readonly lastEntries = new Map<string, LastEntry>();
  private readonly errors = new Map<string, string>();
  private readonly blocked = new Map<string, Set<string>>();
  private readonly sendTimes = new Map<string, number[]>();
  private readonly policy: CommunicationGovernancePolicy;
  private readonly matchWaitMs: number;
  private readonly acceptWaitMs: number;
  private readonly matchingWindow: MatchingWindow | null;
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private closed = false;

  constructor(private readonly options: LobbyServiceOptions) {
    this.matchWaitMs = duration(options.matchWaitMs, 5000, 'matchWaitMs');
    this.acceptWaitMs = duration(options.acceptWaitMs, 15000, 'acceptWaitMs');
    this.matchingWindow = options.matchingWindow ? clone(options.matchingWindow) : null;
    if (this.matchingWindow && ([this.matchingWindow.initialScoreGap, this.matchingWindow.widenPerSecond, this.matchingWindow.maxScoreGap]
      .some((value) => !Number.isFinite(value) || value < 0) ||
      this.matchingWindow.initialScoreGap > this.matchingWindow.maxScoreGap)) throw new Error('Invalid matchingWindow');
    this.policy = options.communicationPolicy ?? new ConfigurableCommunicationPolicy();
    if (!Number.isSafeInteger(this.policy.rateLimitWindowMs) || this.policy.rateLimitWindowMs <= 0 ||
      !Number.isSafeInteger(this.policy.maxMessagesPerWindow) || this.policy.maxMessagesPerWindow <= 0) {
      throw new Error('Invalid communication rate limit');
    }
  }
  private ensureOpen(): void { if (this.closed) throw new ServiceError('LOBBY_CLOSED'); }
  private findRoom(userId: string): PrepRoom | undefined {
    const code = this.userRooms.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }
  private requireRoom(userId: string): PrepRoom {
    this.ensureOpen();
    const room = this.findRoom(userId);
    if (!room || !room.members.has(userId)) throw new ServiceError('PREP_ROOM_NOT_FOUND');
    return room;
  }
  private requireHost(room: PrepRoom, userId: string): void {
    if (room.hostUserId !== userId) throw new ServiceError('HOST_ONLY');
  }
  private hasMatch(room: PrepRoom): boolean { return [...room.members.keys()].some((id) => this.matches.has(id)); }
  private requireIdle(room: PrepRoom): void {
    if (room.starting || room.queuedAt !== null || room.ticketId || this.hasMatch(room)) throw new ServiceError('PREP_ROOM_BUSY');
  }
  private prefs(profile: UserProfile, subject: SubjectId): MemberPrefs {
    return { subject, learningStartSelections: clone(profile.learningStartSelections),
      preferredArena: profile.preferredArena, displaySettings: clone(profile.displaySettings) };
  }
  private remember(room: PrepRoom): void {
    for (const [userId, member] of room.members) this.lastEntries.set(userId, {
      profile: clone(member.profile), durationMode: room.durationMode, queueType: room.queueType,
      sharedSubject: room.sharedSubject, prefs: clone(member.prefs),
    });
  }
  private makeRoom(profile: UserProfile, settings: { durationMode: DurationMode; queueType: QueueType; sharedSubject: SubjectId }, prefs?: MemberPrefs): PrepRoom {
    let code: string;
    do { code = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const memberPrefs = clone(prefs ?? this.prefs(profile, settings.sharedSubject));
    if (settings.queueType === 'ranked') memberPrefs.subject = settings.sharedSubject;
    const room: PrepRoom = { code, ...settings, hostUserId: profile.userId,
      members: new Map([[profile.userId, { profile: clone(profile), prefs: memberPrefs, ready: false }]]),
      queuedAt: null, queueOrder: 0, ticketId: null, starting: null, partyScore: 0, messages: [] };
    this.rooms.set(code, room); this.userRooms.set(profile.userId, code); this.remember(room);
    return room;
  }
  private snapshot(userId: string): LobbyState {
    const room = this.findRoom(userId);
    const match = this.matches.get(userId);
    const ticket = this.tickets.get(this.userTickets.get(userId) ?? '');
    const candidate = ticket?.candidates.find((c) => c.userId === userId);
    const prepRoom = room ? PrepRoomStateSchema.parse({
      roomCode: room.code, durationMode: room.durationMode, queueType: room.queueType,
      sharedSubject: room.sharedSubject, hostUserId: room.hostUserId,
      status: match ? 'in_match' : room.ticketId ? 'accept_check' : room.starting || room.queuedAt !== null ? 'queuing' : 'idle',
      plannedTotalSeconds: PLANNED_SECONDS[room.durationMode],
      members: [...room.members].map(([id, member]) => ({ userId: id, nickname: member.profile.nickname,
        isHost: room.hostUserId === id, ready: member.ready,
        avatarFrameId: member.profile.avatarFrameId, boardPlaqueId: member.profile.boardPlaqueId })),
    }) : null;
    const acceptPrompt: GlobalMatchAcceptPrompt | null = ticket && candidate && ticket.queueType !== 'solo' ? {
      ticketId: ticket.id, roomCode: candidate.roomCode, durationMode: ticket.durationMode,
      queueType: ticket.queueType, deadlineEpochMs: ticket.deadline,
      acceptedCount: ticket.candidates.filter((c) => c.decision === 'accepted').length,
      totalCandidateHumans: ticket.candidates.length, selfDecision: candidate.decision,
    } : null;
    return { prepRoom, acceptPrompt, match: match ? clone(match) : null,
      selfPrefs: room?.members.get(userId) ? clone(room.members.get(userId)!.prefs) : null,
      ...(this.errors.has(userId) ? { lastError: this.errors.get(userId)! } : {}) };
  }

  async getState(userId: string): Promise<LobbyState> { this.ensureOpen(); return this.snapshot(userId); }
  async enterMode(profile: UserProfile, input: unknown): Promise<LobbyState> {
    this.ensureOpen(); const data = EnterModeSchema.parse(input); const user = UserProfileSchema.parse(profile);
    const current = this.findRoom(user.userId);
    if (current) { current.members.get(user.userId)!.profile = clone(user); return this.snapshot(user.userId); }
    if (this.matches.has(user.userId)) throw new ServiceError('MATCH_IN_PROGRESS');
    const last = this.lastEntries.get(user.userId);
    this.makeRoom(user, { durationMode: data.durationMode, queueType: data.queueType ?? last?.queueType ?? 'ranked',
      sharedSubject: data.sharedSubject ?? last?.sharedSubject ?? 'english' }, last?.prefs);
    this.errors.delete(user.userId);
    return this.snapshot(user.userId);
  }
  async joinCode(profile: UserProfile, code: string): Promise<LobbyState> {
    this.ensureOpen(); const user = UserProfileSchema.parse(profile);
    const normalized = z.string().trim().min(4).max(10).parse(code).toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) throw new ServiceError('PREP_ROOM_NOT_FOUND');
    if (this.userRooms.get(user.userId) === normalized) {
      room.members.get(user.userId)!.profile = clone(user); return this.snapshot(user.userId);
    }
    if (this.userRooms.has(user.userId)) throw new ServiceError('LEAVE_ROOM_FIRST');
    if (this.matches.has(user.userId)) throw new ServiceError('MATCH_IN_PROGRESS');
    this.requireIdle(room);
    if (room.queueType === 'solo') throw new ServiceError('SOLO_INVITES_DISABLED');
    if (room.members.size >= 8) throw new ServiceError('PREP_ROOM_FULL');
    const prefs = clone(this.lastEntries.get(user.userId)?.prefs ?? this.prefs(user, room.sharedSubject));
    if (room.queueType === 'ranked') prefs.subject = room.sharedSubject;
    room.members.set(user.userId, { profile: clone(user), prefs, ready: false });
    this.userRooms.set(user.userId, room.code); this.resetReady(room); this.remember(room);
    return this.snapshot(user.userId);
  }
  private resetReady(room: PrepRoom): void { for (const member of room.members.values()) member.ready = false; }
  async updateSettings(userId: string, patch: unknown): Promise<LobbyState> {
    const room = this.requireRoom(userId); this.requireHost(room, userId); this.requireIdle(room);
    const data = SettingsSchema.parse(patch);
    if (data.queueType === 'solo' && room.members.size !== 1) throw new ServiceError('SOLO_REQUIRES_ONE_HUMAN');
    if (data.durationMode !== undefined) room.durationMode = data.durationMode;
    if (data.queueType !== undefined) room.queueType = data.queueType;
    if (data.sharedSubject !== undefined) room.sharedSubject = data.sharedSubject;
    if (room.queueType === 'ranked') for (const member of room.members.values()) member.prefs.subject = room.sharedSubject;
    this.resetReady(room); this.remember(room);
    return this.snapshot(userId);
  }
  prepareMemberPrefs(profile: UserProfile, input: unknown): (confirmedProfile: UserProfile) => LobbyState {
    const user = UserProfileSchema.parse(profile); const room = this.requireRoom(user.userId); this.requireIdle(room);
    const data = MemberPrefsPatchSchema.parse(input);
    if (data.subject && room.queueType === 'ranked' && data.subject !== room.sharedSubject) throw new ServiceError('RANKED_SUBJECT_LOCKED');
    return (confirmedProfile) => {
      const member = room.members.get(user.userId);
      if (this.rooms.get(room.code) !== room || !member) return this.snapshot(user.userId);
      member.profile = clone(confirmedProfile);
      if (data.subject !== undefined) member.prefs.subject = data.subject;
      if (data.learningStartSelections !== undefined) member.prefs.learningStartSelections = clone(confirmedProfile.learningStartSelections);
      if (data.preferredArena !== undefined) member.prefs.preferredArena = confirmedProfile.preferredArena;
      if (data.displaySettings !== undefined) member.prefs.displaySettings = clone(confirmedProfile.displaySettings);
      const changedPrefs = Object.keys(data).some((key) => key !== 'ready');
      if (changedPrefs) member.ready = false;
      if (data.ready !== undefined) member.ready = data.ready;
      this.remember(room); return this.snapshot(user.userId);
    };
  }
  async updateMemberPrefs(profile: UserProfile, input: unknown): Promise<LobbyState> {
    const data = MemberPrefsPatchSchema.parse(input);
    const updated = UserProfileSchema.parse({ ...profile,
      ...(data.learningStartSelections !== undefined ? { learningStartSelections: data.learningStartSelections } : {}),
      ...(data.preferredArena !== undefined ? { preferredArena: data.preferredArena } : {}),
      ...(data.displaySettings !== undefined ? { displaySettings: data.displaySettings } : {}),
    });
    return this.prepareMemberPrefs(profile, data)(updated);
  }
  async start(userId: string): Promise<LobbyState> {
    const room = this.requireRoom(userId); this.requireHost(room, userId); this.requireIdle(room);
    if ([...room.members].some(([id, member]) => id !== userId && !member.ready)) throw new ServiceError('MEMBERS_NOT_READY');
    for (const id of room.members.keys()) this.errors.delete(id);
    if (room.queueType === 'solo') {
      if (room.members.size !== 1) throw new ServiceError('SOLO_REQUIRES_ONE_HUMAN');
      const ticket = this.makeTicket([room], true); await this.finalizeTicket(ticket);
    } else {
      const starting = randomUUID(); room.starting = starting;
      const profiles = [...room.members.values()].map((member) => clone(member.profile));
      try {
        const scores = await Promise.all(profiles.map((profile) => this.options.scoreCandidate?.(profile, room.durationMode) ?? 0));
        this.ensureOpen();
        if (room.starting !== starting || this.rooms.get(room.code) !== room) return this.snapshot(userId);
        if (scores.some((score) => !Number.isFinite(score))) throw new ServiceError('MATCH_SCORE_INVALID');
        room.partyScore = scores.reduce((mean, score, index) => {
          const delta = score - mean;
          return Number.isFinite(delta) ? mean + delta / (index + 1)
            : mean * (index / (index + 1)) + score / (index + 1);
        }, 0);
        if (!Number.isFinite(room.partyScore)) throw new ServiceError('MATCH_SCORE_INVALID');
        room.starting = null; room.queuedAt = Date.now(); room.queueOrder = ++this.sequence; this.pumpQueue();
      } catch (error) {
        if (room.starting !== starting) return this.snapshot(userId); 
        room.starting = null;
        for (const id of room.members.keys()) this.errors.set(id, error instanceof ServiceError ? error.code : 'MATCH_SCORE_UNAVAILABLE');
        throw error;
      }
    }
    return this.snapshot(userId);
  }
  async cancelQueue(userId: string): Promise<LobbyState> {
    const room = this.requireRoom(userId); this.requireHost(room, userId);
    if (room.ticketId) throw new ServiceError('USE_ACCEPT_DECISION');
    if (room.starting || room.queuedAt !== null) {
      room.starting = null; room.queuedAt = null; this.resetReady(room); this.pumpQueue();
    }
    return this.snapshot(userId);
  }
  private compatibleKey(room: PrepRoom): string {
    return `${room.durationMode}:${room.queueType}:${room.queueType === 'ranked' ? room.sharedSubject : '*'}`;
  }
  private pumpQueue(): void {
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
    if (this.closed) return;
    const groups = new Map<string, PrepRoom[]>();
    for (const room of [...this.rooms.values()].filter((r) => r.queuedAt !== null).sort((a, b) => a.queueOrder - b.queueOrder)) {
      const key = this.compatibleKey(room); const group = groups.get(key) ?? []; group.push(room); groups.set(key, group);
    }
    let nextDeadline = Infinity;
    const now = Date.now();
    for (const group of groups.values()) {
      let launched = true;
      while (launched && group.length) {
        launched = false;
        for (const anchor of group) {
          const window = this.matchingWindow;
          const gap = window ? Math.min(window.maxScoreGap,
            window.initialScoreGap + window.widenPerSecond * Math.max(0, now - anchor.queuedAt!) / 1000) : Infinity;
          const chosen: PrepRoom[] = [anchor]; let size = anchor.members.size;
          for (const candidate of group) {
            if (candidate === anchor) continue;
            const difference = Math.abs(candidate.partyScore - anchor.partyScore);
            if ((!window || difference <= gap) && size + candidate.members.size <= 8) {
              chosen.push(candidate); size += candidate.members.size;
            } else if (window && difference > gap && difference <= window.maxScoreGap && window.widenPerSecond > 0) {
              const opensAt = anchor.queuedAt! + Math.ceil((difference - window.initialScoreGap) / window.widenPerSecond * 1000);
              nextDeadline = Math.min(nextDeadline, Math.max(now + 1, opensAt));
            }
          }
          const deadline = anchor.queuedAt! + this.matchWaitMs;
          if (size < 8 && now < deadline) { nextDeadline = Math.min(nextDeadline, deadline); continue; }
          this.makeTicket(chosen, false);
          for (const room of chosen) group.splice(group.indexOf(room), 1);
          launched = true; break;
        }
      }
    }
    if (nextDeadline !== Infinity) {
      this.queueTimer = setTimeout(() => { this.queueTimer = null; this.pumpQueue(); }, Math.max(0, nextDeadline - Date.now()));
      this.queueTimer.unref?.();
    }
  }
  private makeTicket(rooms: PrepRoom[], solo: boolean): Ticket {
    const first = rooms[0]!;
    const ticket: Ticket = { id: randomUUID(), durationMode: first.durationMode, queueType: first.queueType,
      sharedSubject: first.sharedSubject, deadline: Date.now() + this.acceptWaitMs,
      candidates: rooms.flatMap((room) => [...room.members].map(([userId, member]) => ({
        userId, roomCode: room.code, profile: clone(member.profile), prefs: clone(member.prefs),
        decision: solo ? 'accepted' as const : 'pending' as const,
      }))), timer: null, finalizing: null, locked: false };
    this.tickets.set(ticket.id, ticket);
    for (const room of rooms) { room.queuedAt = null; room.ticketId = ticket.id; }
    for (const candidate of ticket.candidates) this.userTickets.set(candidate.userId, ticket.id);
    if (!solo) {
      ticket.timer = setTimeout(() => { void this.finalizeTicket(ticket).catch(() => {  }); }, this.acceptWaitMs);
      ticket.timer.unref?.();
    }
    return ticket;
  }
  async acceptMatch(userId: string, input: unknown): Promise<LobbyState> {
    this.ensureOpen(); const data = AcceptSchema.parse(input);
    const ticket = this.tickets.get(data.ticketId);
    if (!ticket || this.userTickets.get(userId) !== data.ticketId) throw new ServiceError('MATCH_TICKET_NOT_FOUND');
    if (ticket.locked) { await ticket.finalizing; return this.snapshot(userId); }
    if (Date.now() >= ticket.deadline) { await this.finalizeTicket(ticket); throw new ServiceError('MATCH_ACCEPT_EXPIRED'); }
    const candidate = ticket.candidates.find((c) => c.userId === userId)!;
    const decision = data.accept ? 'accepted' : 'declined';
    if (candidate.decision !== 'pending' && candidate.decision !== decision) throw new ServiceError('MATCH_DECISION_FINAL');
    candidate.decision = decision;
    if (ticket.candidates.every((c) => c.decision !== 'pending')) await this.finalizeTicket(ticket);
    return this.snapshot(userId);
  }
  private finalizeTicket(ticket: Ticket): Promise<void> {
    if (ticket.finalizing) return ticket.finalizing;
    if (!this.tickets.has(ticket.id)) return Promise.resolve();
    ticket.locked = true;
    if (ticket.timer) clearTimeout(ticket.timer);
    ticket.timer = null;
    const accepted = ticket.candidates.filter((c) => c.decision === 'accepted');
    ticket.finalizing = Promise.resolve().then(async () => {
      try {
        if (accepted.length) {
          const input: CreateMatchInput = { ticketId: ticket.id, durationMode: ticket.durationMode,
            queueType: ticket.queueType, sharedSubject: ticket.sharedSubject,
            humans: accepted.map((c) => ({ ...clone(c.profile), learningStartSelections: clone(c.prefs.learningStartSelections),
              preferredArena: c.prefs.preferredArena, displaySettings: clone(c.prefs.displaySettings) })),
            humanPrefs: Object.fromEntries(accepted.map((c) => [c.userId, clone(c.prefs)])),
            prepRoomCodes: [...new Set(accepted.map((c) => c.roomCode))] };
          const result = await this.options.createMatch(input);
          if (!result || !result.roomId || !result.matchId) throw new ServiceError('INVALID_MATCH_RESULT');
          for (const candidate of accepted) this.matches.set(candidate.userId, { roomId: result.roomId, matchId: result.matchId,
            ...(result.seatIds?.[candidate.userId] ? { seatId: result.seatIds[candidate.userId] } : {}) });
        }
      } catch (error) {
        for (const candidate of ticket.candidates) this.errors.set(candidate.userId, error instanceof ServiceError ? error.code : 'MATCH_CREATION_FAILED');
        throw error;
      } finally {
        this.tickets.delete(ticket.id);
        for (const candidate of ticket.candidates) if (this.userTickets.get(candidate.userId) === ticket.id) this.userTickets.delete(candidate.userId);
        for (const code of new Set(ticket.candidates.map((c) => c.roomCode))) {
          const room = this.rooms.get(code);
          if (room?.ticketId === ticket.id) { room.ticketId = null; this.resetReady(room); }
        }
      }
    });
    return ticket.finalizing;
  }
  async leaveRoom(userId: string): Promise<LobbyState> {
    this.ensureOpen(); const room = this.findRoom(userId);
    if (!room) return this.snapshot(userId);
    let ticket = this.tickets.get(this.userTickets.get(userId) ?? '');
    if (ticket && !ticket.locked && Date.now() >= ticket.deadline) {
      await this.finalizeTicket(ticket);
      ticket = undefined;
    }
    if (ticket?.locked) throw new ServiceError('MATCH_STARTING');
    this.remember(room);
    if (room.starting || room.queuedAt !== null) { room.starting = null; room.queuedAt = null; this.resetReady(room); }
    if (ticket) ticket.candidates.find((c) => c.userId === userId)!.decision = 'declined';
    room.members.delete(userId); this.userRooms.delete(userId); this.userTickets.delete(userId);
    if (!room.members.size) this.rooms.delete(room.code);
    else {
      if (room.hostUserId === userId) room.hostUserId = room.members.keys().next().value!;
      if (!ticket) this.resetReady(room);
    }
    this.pumpQueue();
    if (ticket && ticket.candidates.every((c) => c.decision !== 'pending')) await this.finalizeTicket(ticket);
    return this.snapshot(userId);
  }
  async returnToPrep(userId: string): Promise<LobbyState> {
    this.ensureOpen();
    const ticket = this.tickets.get(this.userTickets.get(userId) ?? '');
    if (ticket) throw new ServiceError('PREP_ROOM_BUSY');
    const last = this.lastEntries.get(userId);
    if (!last) throw new ServiceError('PREP_ROOM_NOT_FOUND');
    this.matches.delete(userId);
    let room = this.findRoom(userId);
    if (!room) room = this.makeRoom(last.profile, { durationMode: last.durationMode, queueType: last.queueType,
      sharedSubject: last.sharedSubject }, last.prefs);
    room.members.get(userId)!.ready = false;
    this.errors.delete(userId); return this.snapshot(userId);
  }

  private isBlocked(receiverId: string, senderId: string): boolean {
    return Boolean(this.blocked.get(receiverId)?.has(senderId)) || this.policy.isSenderBlocked(receiverId, senderId);
  }
  private recipients(room: PrepRoom, senderId: string): string[] {
    return [...room.members.keys()].filter((id) => !this.isBlocked(id, senderId));
  }
  async setBlocked(userId: string, input: unknown): Promise<void> {
    this.ensureOpen(); const data = BlockSchema.parse(input);
    const mutablePolicy = this.policy as CommunicationGovernancePolicy & {
      setBlock?: (receiverUserId: string, senderUserId: string, blocked: boolean) => void;
    };
    if (typeof mutablePolicy.setBlock === 'function') mutablePolicy.setBlock(userId, data.senderUserId, data.blocked);
    const users = this.blocked.get(userId) ?? new Set<string>();
    if (data.blocked) users.add(data.senderUserId); else users.delete(data.senderUserId);
    this.blocked.set(userId, users);
  }
  async sendCommunication(profile: UserProfile, input: unknown): Promise<CommunicationDelivery> {
    const user = UserProfileSchema.parse(profile); const room = this.requireRoom(user.userId);
    const data: CommunicationClientSend = CommunicationClientSendSchema.parse(input);
    if (data.channel !== 'room' || data.targetId !== room.code) throw new ServiceError('COMMUNICATION_TARGET_FORBIDDEN');
    if (data.kind === 'text' ? !this.policy.allowTextChat : !this.policy.allowSignalsAndEmotes) throw new ServiceError('COMMUNICATION_DISABLED');
    const duplicate = room.messages.find((entry) => entry.clientMsgId === data.clientMsgId && entry.envelope.senderUserId === user.userId);
    if (duplicate) return { message: clone(duplicate.envelope), recipientUserIds: this.recipients(room, user.userId) };
    const now = Date.now();
    const times = (this.sendTimes.get(user.userId) ?? []).filter((time) => time > now - this.policy.rateLimitWindowMs);
    if (times.length >= this.policy.maxMessagesPerWindow) throw new ServiceError('COMMUNICATION_RATE_LIMITED');
    times.push(now); this.sendTimes.set(user.userId, times);
    const filtered = data.kind === 'text' ? this.policy.filterTextPayload(data.payload) : { allowed: true, sanitized: data.payload.trim() };
    if (!filtered.allowed || !filtered.sanitized) throw new ServiceError('COMMUNICATION_CONTENT_REJECTED');
    const message = CommunicationEnvelopeSchema.parse({ msgId: randomUUID(), channel: 'room', targetId: room.code,
      kind: data.kind, senderUserId: user.userId, senderNickname: user.nickname,
      payload: filtered.sanitized, createdAtEpochMs: now });
    room.messages.push({ clientMsgId: data.clientMsgId, envelope: message });
    if (room.messages.length > 200) room.messages.shift();
    return { message: clone(message), recipientUserIds: this.recipients(room, user.userId) };
  }
  async communicate(profile: UserProfile, input: unknown): Promise<CommunicationDelivery> { return this.sendCommunication(profile, input); }
  async getCommunication(userId: string): Promise<CommunicationEnvelope[]> {
    const room = this.requireRoom(userId);
    return clone(room.messages.filter((entry) => !this.isBlocked(userId, entry.envelope.senderUserId)).map((entry) => entry.envelope));
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
    for (const ticket of this.tickets.values()) if (ticket.timer) clearTimeout(ticket.timer);
  }
}
