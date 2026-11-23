import { Client, type Room } from '@colyseus/sdk';
import type {
  ClientQuestionView,
  CommunicationClientSend,
  CommunicationEnvelope,
  DurationMode,
  FinalBoardSnapshot,
  GameCommand,
  LearningArcMeta,
  LessonStepKind,
  MatchPhaseKind,
  MatchStudyBlueprint,
  ModeStandingSummary,
  QueueType,
  TacticianId,
  VersionLockTriplet,
} from '@pkg/contracts';
import type { RoundBattle, SeatState, UnitInstance } from '@pkg/game-core';
import type { LearningGoldSettlement } from '@pkg/learning-core';
import { isTauriHost } from '../platform/hostBridge.js';
import { resolveRealtimeServerOrigin } from './httpClient.js';

export interface MatchSeatPublicView {
  seatId: string;
  nickname: string;
  tacticianId?: TacticianId;
  level: number;
  units: UnitInstance[];
  victoryPoints: number;
  isBot?: boolean;
  chosenAugments: string[];
}

export interface MatchLearningStepView {
  kind: LessonStepKind;
  active: boolean;
  plannedSeconds: number;
  questionIds: readonly string[];
  materials: readonly { familyId: string; materialMd: string }[];
  corrections: readonly { questionId: string; explanationMd: string }[];
}

export interface MatchLearningFeedbackItem {
  questionId?: string;
  isCorrect: boolean;
  isSkipped?: boolean;
  quality?: { numerator: string; denominator: string };
  explanationMd?: string;
  stepResults?: readonly { stepId: string; isCorrect: boolean }[];
}

export interface MatchLearningView {
  nodeIndex: number;
  arcMeta?: LearningArcMeta;
  blueprint?: MatchStudyBlueprint;
  currentStep: LessonStepKind | null;
  complete: boolean;
  readyToProceed?: boolean;
  readyHumansCount?: number;
  totalHumansCount?: number;
  correctCount?: number;
  totalQuestionsCount?: number;
  clientQuestions: ClientQuestionView[];
  steps: MatchLearningStepView[];
  submittedQuestionIds: string[];
  feedback: Record<string, MatchLearningFeedbackItem>;
}

export interface MatchSummaryCompetitive {
  matchId: string;
  queueType: QueueType;
  placements: Array<{ seatId: string; place: number; victoryPoints: number }>;
  seatId: string;
  place: number;
  quarterPoints: number;
  standing: ModeStandingSummary | null;
  standingBefore: ModeStandingSummary | null;
  rankScoreDelta: number | null;
  standingStatus: 'not_applicable' | 'confirmed' | 'pending_verification';
  finalBoardSnapshot: FinalBoardSnapshot;
}

export interface MatchSummaryLearning {
  wrongQuestionIds: string[];
  nodes: LearningGoldSettlement[];
  rewardPointsGranted: number;
  attemptIds: string[];
  discardedCarryCents: number;
  carryOutCents: 0;
  grantedIntegerGold: 0;
}

export interface MatchSummaryPayload {
  competitive: MatchSummaryCompetitive;
  learning: MatchSummaryLearning;
}

export interface MatchRoomSnapshot {
  roomId: string;
  matchId: string;
  mode: DurationMode;
  queueType: QueueType;
  phase: MatchPhaseKind;
  phaseIndex: number;
  deadlineEpochMs: number;
  remainingSeconds: number;
  round: number;
  nodeIndex: number;
  versionLock: VersionLockTriplet;
  seatId: string;
  self: SeatState;
  seats: MatchSeatPublicView[];
  learning: MatchLearningView | null;
  battle?: BattleBroadcastPayload | null;
  resourceSettlement: LearningGoldSettlement | null;
  summary: MatchSummaryPayload | null;
  completed: boolean;
  failure: string | null;
}

export interface BattleBroadcastPayload {
  round: number;
  battles: RoundBattle[];
  overtimeAtMs?: number;
  longestBattleMs?: number;
  startedAtEpochMs?: number;
  timeScale?: number;
}

export interface LearningPersistedPayload {
  nodeIndex: number;
  rewardPointsGranted: number;
  attemptIds: string[];
}

export interface MatchErrorPayload {
  reason: string;
  competitiveResultVoided: boolean;
}

export interface CommandResultAck {
  requestId?: string;
  ok: boolean;
  reason?: string;
  complete?: boolean;
  feedback?: MatchLearningFeedbackItem;
}

export interface MatchSocketHandlers {
  onSnapshot: (snapshot: MatchRoomSnapshot) => void;
  onBattle?: (payload: BattleBroadcastPayload) => void;
  onLearningPersisted?: (payload: LearningPersistedPayload) => void;
  onSummary?: (summary: MatchSummaryPayload) => void;
  onMatchComplete?: (payload: { matchId: string }) => void;
  onMatchError?: (payload: MatchErrorPayload) => void;
  onSessionSuperseded?: (reason: string) => void;
  onCommandAck?: (ack: CommandResultAck) => void;
  onLearningAck?: (ack: CommandResultAck) => void;
  onCommunication?: (msg: CommunicationEnvelope) => void;
  onConnectionStateChange?: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  onActionPendingChange?: (pending: boolean) => void;
}

export interface ConnectedMatchSocket {
  readonly roomId: string;
  readonly sessionId: string;
  sendCommand(command: GameCommand): Promise<CommandResultAck>;
  sendLearningSubmit(
    questionId: string,
    submission: {
      answer?: string | number | readonly string[] | Readonly<Record<string, string | number>> | null;
      status?: 'submitted' | 'skipped' | 'timed_out';
      questionId?: string;
      hintUsed?: boolean;
    },
  ): Promise<CommandResultAck>;
  sendLearningAdvance(): Promise<CommandResultAck>;
  requestSnapshot(): void;
  sendCommunication(msg: CommunicationClientSend): string;
  leave(consented?: boolean): Promise<void>;
}

function buildColyseusClient(): Client {
  const wsServerOrigin = resolveRealtimeServerOrigin();
  const wsUrlObj = new URL(wsServerOrigin);

  const initialEndpoint =
    typeof window !== 'undefined' &&
    !isTauriHost() &&
    (window.location.port === '5173' || window.location.port === '4173')
      ? window.location.origin
      : wsServerOrigin;

  return new Client(initialEndpoint, {
    urlBuilder: (url: URL) => {
      if (url.protocol === 'ws:' || url.protocol === 'wss:') {
        const rewritten = new URL(url.toString());
        rewritten.protocol = wsUrlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        rewritten.hostname = wsUrlObj.hostname;
        rewritten.port = wsUrlObj.port;
        return rewritten.toString();
      }
      return url.toString();
    },
  });
}

let reqSeq = 0;
function nextRequestId(prefix: string): string {
  reqSeq += 1;
  return `${prefix}-${Date.now()}-${reqSeq}`;
}

export async function connectAuthoritativeMatch(
  roomId: string,
  token: string,
  handlers: MatchSocketHandlers,
): Promise<ConnectedMatchSocket> {
  const client = buildColyseusClient();
  const room: Room = await client.joinById(roomId, { token });
  room.reconnection.minUptime = 0;
  let ready = false;
  let pending: {
    requestId: string;
    ack?: CommandResultAck;
    timer: ReturnType<typeof setTimeout>;
    resolve: (ack: CommandResultAck) => void;
    reject: (error: Error) => void;
  } | null = null;

  function finishAction(error?: Error): void {
    if (!pending) return;
    const action = pending;
    pending = null;
    clearTimeout(action.timer);
    handlers.onActionPendingChange?.(false);
    if (error) action.reject(error);
    else action.resolve(action.ack!);
  }

  function acceptAck(ack: CommandResultAck): void {
    if (!pending || pending.requestId !== ack.requestId) return;
    if (!ack.ok) finishAction(new Error(ack.reason ?? 'MATCH_ACTION_REJECTED'));
    else pending.ack = ack;
  }

  function sendAction(type: 'command' | 'learning', payload: object): Promise<CommandResultAck> {
    if (!ready) return Promise.reject(new Error('MATCH_CONNECTION_NOT_READY'));
    if (pending) return Promise.reject(new Error('MATCH_ACTION_PENDING'));
    const requestId = nextRequestId(type);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ready = false;
        finishAction(new Error('MATCH_ACTION_TIMEOUT'));
        handlers.onConnectionStateChange?.('reconnecting');
        room.send('snapshot', {});
      }, 10_000);
      pending = { requestId, timer, resolve, reject };
      handlers.onActionPendingChange?.(true);
      try { room.send(type, { requestId, ...payload }); }
      catch (error) { finishAction(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  room.onMessage('snapshot', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onSnapshot(data as MatchRoomSnapshot);
      if (!ready) {
        ready = true;
        handlers.onConnectionStateChange?.('connected');
      }
      if (pending?.ack) finishAction();
    }
  });

  room.onMessage('snapshot_result', (ack: CommandResultAck) => {
    if (!ack.ok && ack.reason === 'SESSION_SUPERSEDED') {
      handlers.onSessionSuperseded?.(ack.reason);
    }
  });

  room.onMessage('battle', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onBattle?.(data as BattleBroadcastPayload);
    }
  });

  room.onMessage('learning_persisted', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onLearningPersisted?.(data as LearningPersistedPayload);
    }
  });

  room.onMessage('summary', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onSummary?.(data as MatchSummaryPayload);
    }
  });

  room.onMessage('match_complete', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onMatchComplete?.(data as { matchId: string });
    }
  });

  room.onMessage('match_error', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onMatchError?.(data as MatchErrorPayload);
    }
  });

  room.onMessage('session_superseded', (data: unknown) => {
    const reason =
      data && typeof data === 'object' && 'reason' in data
        ? String((data as { reason: unknown }).reason)
        : 'SESSION_SUPERSEDED';
    handlers.onSessionSuperseded?.(reason);
  });

  room.onMessage('command_result', (data: unknown) => {
    if (data && typeof data === 'object') {
      const ack = data as CommandResultAck;
      if (!ack.ok && ack.reason === 'SESSION_SUPERSEDED') {
        handlers.onSessionSuperseded?.('SESSION_SUPERSEDED');
      }
      acceptAck(ack);
      handlers.onCommandAck?.(ack);
    }
  });

  room.onMessage('learning_result', (data: unknown) => {
    if (data && typeof data === 'object') {
      const ack = data as CommandResultAck;
      if (!ack.ok && ack.reason === 'SESSION_SUPERSEDED') {
        handlers.onSessionSuperseded?.('SESSION_SUPERSEDED');
      }
      acceptAck(ack);
      handlers.onLearningAck?.(ack);
    }
  });

  room.onMessage('communication', (data: unknown) => {
    if (data && typeof data === 'object') {
      handlers.onCommunication?.(data as CommunicationEnvelope);
    }
  });

  room.onDrop(() => {
    ready = false;
    finishAction(new Error('MATCH_CONNECTION_CLOSED'));
    handlers.onConnectionStateChange?.('reconnecting');
  });

  room.onReconnect(() => {
    room.send('snapshot', {});
  });

  room.onError((_code, message) => {
    if (message === 'SESSION_SUPERSEDED') handlers.onSessionSuperseded?.(message);
  });

  room.onLeave((code: number) => {
    ready = false;
    finishAction(new Error('MATCH_CONNECTION_CLOSED'));
    if (code === 4001) {
      handlers.onSessionSuperseded?.('SESSION_SUPERSEDED');
    }
    handlers.onConnectionStateChange?.('disconnected');
  });

  return {
    roomId: room.roomId,
    sessionId: room.sessionId,
    sendCommand(command: GameCommand): Promise<CommandResultAck> {
      return sendAction('command', { command });
    },
    sendLearningSubmit(questionId, submission): Promise<CommandResultAck> {
      return sendAction('learning', { action: 'submit', questionId, submission });
    },
    sendLearningAdvance(): Promise<CommandResultAck> {
      return sendAction('learning', { action: 'advance' });
    },
    requestSnapshot(): void {
      if (room.connection.isOpen) room.send('snapshot', {});
    },
    sendCommunication(msg: CommunicationClientSend): string {
      room.send('communicate', msg);
      return msg.clientMsgId;
    },
    async leave(consented = true): Promise<void> {
      ready = false;
      finishAction(new Error('MATCH_CONNECTION_CLOSED'));
      try {
        await room.leave(consented);
      } catch {
      }
    },
  };
}
