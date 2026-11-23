import type {
  ArenaThemeId,
  ClientQuestionView,
  CommunicationClientSend,
  CommunicationEnvelope,
  CoursePack,
  CoursePackManifest,
  DisplaySettings,
  DurationMode,
  FinalBoardSnapshot,
  FsrsCardRecord,
  GiftCatalogItem,
  GlobalMatchAcceptPrompt,
  LessonStepKind,
  LoginRequest,
  ModeStandingSummary,
  PrepRoomState,
  QuestionFeedbackReveal,
  QuestionIssueReport,
  QueueType,
  RedeemOrder,
  RegisterRequest,
  SubjectId,
  TacticianId,
  UserProfile,
} from '@pkg/contracts';
import type { AuthoringCoursePack, CompileCoursePackInput, Diagnostic } from '@pkg/pack-compiler';
import { isTauriHost, readStoredSessionToken, writeStoredSessionToken } from '../platform/hostBridge.js';

export interface SeasonTermInfo {
  seasonTermId: string;
  label: string;
  startsAtIso: string;
  endsAtIso: string;
  rewardsSettled: boolean;
}

export interface MemberPrefsView {
  subject: SubjectId;
  learningStartSelections: Partial<Record<SubjectId, string>>;
  preferredArena: ArenaThemeId;
  preferredTacticianId?: TacticianId;
  displaySettings: DisplaySettings;
}

export interface LobbyStateResponse {
  profile?: UserProfile;
  prepRoom: PrepRoomState | null;
  acceptPrompt: GlobalMatchAcceptPrompt | null;
  match: { roomId: string; matchId: string; seatId?: string } | null;
  selfPrefs: MemberPrefsView | null;
  lastError?: string;
}

export interface MeResponse {
  profile: UserProfile;
  rewardPointsBalance: number;
  standings: ModeStandingSummary[];
  activeSeat: unknown | null;
}

export interface LoginResponse {
  token: string;
  userId: string;
  sessionEpoch: number;
  profile: UserProfile;
  expiresAtIso: string;
  activeSeat: unknown | null;
}

export interface LeaderboardEntry {
  leaderboardRank: number;
  userId: string;
  nickname: string;
  tierLabel: string;
  rankScore: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  self: ModeStandingSummary;
  isEmpty: boolean;
  selfInTopN: boolean;
  currentSeasonTerm: SeasonTermInfo;
}

export interface MatchHistoryItem {
  matchId: string;
  durationMode: DurationMode;
  queueType: QueueType;
  seasonTermId: string;
  gameSetVersion: string;
  coursePackVersion: string;
  completedAt: string | null;
  finalRank: number;
  quarterPoints: number;
  finalBoardSnapshot: FinalBoardSnapshot;
  wrongQuestionIds: string[];
}

export interface RewardPointsLedgerRow {
  id: string;
  user_id: string;
  points_delta: number;
  reason: string;
  idempotency_key: string;
  related_order_id: string | null;
  related_attempt_id: string | null;
  compensates_ledger_id: string | null;
  created_at: string;
}

export interface RewardsSummaryResponse {
  balance: number;
  gifts: GiftCatalogItem[];
  orders: RedeemOrder[];
  ledger: RewardPointsLedgerRow[];
}

export type RedeemAttemptOutcome =
  | { readonly outcome: 'confirmed'; readonly order: RedeemOrder }
  | { readonly outcome: 'pending_verify'; readonly order: RedeemOrder; readonly message: string };

export interface LearningAttemptRow {
  id: string;
  question_id: string;
  family_id: string;
  subject: SubjectId;
  knowledge_node: string;
  is_correct: boolean;
  is_offline_unverified: boolean;
  created_at: string;
}

export interface LearningDashboardResponse {
  dueReviews: FsrsCardRecord[];
  nextRecommendation:
    | { kind: 'due_review' | 'course_progress'; subject: SubjectId; knowledgeNode: string }
    | null;
  coursePacks: Array<{ manifest: CoursePackManifest; isActive: boolean }>;
  recentAttempts: LearningAttemptRow[];
  wrongQuestions: LearningAttemptRow[];
}

export interface DirectLearningSessionView {
  sessionId: string;
  mode: DurationMode;
  nodeIndex: number;
  plannedSeconds: number;
  pausedClockAllowed: boolean;
  expiresAtIso: string;
  stepIndex: number;
  steps: Array<{
    kind: LessonStepKind;
    plannedSeconds: number;
    active: boolean;
    questionCount: number;
  }>;
  currentStep: {
    kind: LessonStepKind;
    materials: Array<{ familyId: string; materialMd: string }>;
    corrections: Array<{ questionId: string; explanationMd: string }>;
    questions: ClientQuestionView[];
    lockedQuestionIds: string[];
  };
  completed: boolean;
  result: {
    attemptIds: string[];
    wrongQuestionIds: string[];
    rewardPointsGranted: number;
    alreadyPersisted: boolean;
    feedback: QuestionFeedbackReveal[];
  } | null;
}

export interface DirectLearningSubmitResponse {
  feedback: {
    questionId: string;
    quality: { numerator: string; denominator: string };
    isCorrect: boolean;
    isSkipped: boolean;
    stepResults: readonly {
      stepId: string;
      isCorrect: boolean;
      earnedShare: { numerator: string; denominator: string };
    }[];
    explanationMd: string;
    correctAnswerDisplay?: string;
  };
  session: DirectLearningSessionView;
}

export type AdminPackCompileResponse =
  | {
      ok: true;
      draftId: string;
      pack: CoursePack;
      manifest: CoursePackManifest;
      diagnostics: [];
      previewQuestions: ClientQuestionView[];
    }
  | {
      ok: false;
      diagnostics: Diagnostic[];
    };

export interface AdminPackListItem {
  manifest: CoursePackManifest;
  isActive: boolean;
  createdAtIso: string;
}

export interface AnonymousErrorRateRow {
  cohortGroup: string;
  subject: SubjectId;
  suppressed: boolean;
  sampleSize: number | null;
  attemptCount: number | null;
  wrongRate: number | null;
}

export interface AdminUserRow {
  id: string;
  username: string;
  nickname: string;
  role: 'player' | 'editor' | 'admin';
  cohort_group: string | null;
  created_at: string;
}

const ERROR_CODE_LABELS: Readonly<Record<string, string>> = {
  NETWORK_ERROR: '无法完成网络请求，请检查网络或服务器连接后重试。',
  REQUEST_TIMEOUT: '请求超时，尚未确认操作结果，请稍后重试。',
  SESSION_SUPERSEDED: '当前账号已在另一设备登录接管，本端会话已安全退出。',
  SESSION_EXPIRED: '登录会话已过期，请重新登录。',
  SESSION_INVALID: '登录凭证无效，请重新登录。',
  SESSION_REQUIRED: '请先登录账号。',
  INVALID_CREDENTIALS: '用户名或密码错误。',
  ALREADY_EXISTS: '该登录用户名已被注册，请更换用户名。',
  VALIDATION_ERROR: '输入格式不符合要求，请核对字段说明。',
  RATE_LIMIT_AUTH: '登录/注册尝试过于频繁，请 1 分钟后再试。',
  FORBIDDEN: '当前账号无此操作权限。',
  HOST_ONLY: '仅备战房房主可修改共享设置或发起匹配。',
  MEMBERS_NOT_READY: '房间内尚有成员未点击准备就绪。',
  PREP_ROOM_NOT_FOUND: '未找到该房间码对应的备战房。',
  PREP_ROOM_BUSY: '当前房间正在匹配或对局确认中，无法修改。',
  PREP_ROOM_FULL: '该备战房已满 8 人。',
  LEAVE_ROOM_FIRST: '你当前已在另一个备战房中，请先退出原房间再加入。',
  SOLO_INVITES_DISABLED: '单人模式备战房不支持房间码邀请加入。',
  SOLO_REQUIRES_ONE_HUMAN: '单人模式仅限 1 名真人独立进入，请先请其他成员离开或切换排位/匹配。',
  RANKED_SUBJECT_LOCKED: '排位赛锁定全房统一学科，个人不可切换其他学科。',
  MATCH_IN_PROGRESS: '当前已有进行中的对局，正在为你恢复原席位。',
  MATCH_ACCEPT_EXPIRED: '匹配确认倒计时已截止。',
  OUT_OF_STOCK: '该礼品当前库存不足。',
  INSUFFICIENT_POINTS: '可用研学积分不足。',
  GIFT_NOT_FOUND: '未找到对应礼品条目。',
  IDENTITY_VERIFICATION_REQUIRED: '必须勾选“已线下核实学生本人身份”后方可执行重置。',
  EMAIL_ACCOUNT_RESET_NOT_SUPPORTED: '该账号已绑定邮箱，不适用未绑邮箱人工重置通道。',
  IMMUTABLE_PACK_VERSION_CONFLICT: '该版本号已存在且内容哈希不同；已发布题库版本不可覆盖，请升级版本号。',
};

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly issues?: Array<{ path: (string | number)[]; message: string }>;

  constructor(
    status: number,
    code: string,
    message?: string,
    issues?: Array<{ path: (string | number)[]; message: string }>,
  ) {
    super(message ?? ERROR_CODE_LABELS[code] ?? `请求失败 (${code})`);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

type SessionAuthInvalidHandler = (reason: 'SESSION_SUPERSEDED' | 'UNAUTHORIZED', message: string) => void;
let authInvalidHandler: SessionAuthInvalidHandler | null = null;

export function registerSessionInvalidHandler(handler: SessionAuthInvalidHandler | null): void {
  authInvalidHandler = handler;
}

export function resolveApiOrigin(): string {
  const envOrigin = (import.meta.env.VITE_API_ORIGIN ?? import.meta.env.VITE_SERVER_ORIGIN ?? '').trim();
  if (envOrigin) return envOrigin.replace(/\/+$/, '');
  if (isTauriHost()) return 'http://127.0.0.1:3001';
  return '';
}

export function resolveRealtimeServerOrigin(): string {
  const envOrigin = (import.meta.env.VITE_WS_ORIGIN ?? import.meta.env.VITE_SERVER_ORIGIN ?? '').trim();
  if (envOrigin) return envOrigin.replace(/\/+$/, '');
  if (isTauriHost()) return 'http://127.0.0.1:3001';
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '5173' || port === '4173') {
      return `${protocol}//${hostname || '127.0.0.1'}:3001`;
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:3001';
}

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  suppressAuthRedirect?: boolean;
  acceptText?: boolean;
  acceptCompilerDiagnostics?: boolean;
}

async function fetchApiResponse(
  path: string,
  config: RequestConfig,
): Promise<{ response: Response; rawText: string; requestToken: string | null }> {
  const token = readStoredSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (config.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const body = config.body !== undefined ? JSON.stringify(config.body) : undefined;
  const controller = new AbortController();
  const timeoutMs = config.timeoutMs ?? 12_000;
  const timer = setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), timeoutMs);

  try {
    const response = await fetch(`${resolveApiOrigin()}${path}`, {
      method: config.method ?? (config.body === undefined ? 'GET' : 'POST'),
      headers,
      credentials: 'include',
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
    });
    const rawText = await response.text();
    return { response, rawText, requestToken: token };
  } catch (err) {
    const timedOut = controller.signal.aborted || (err instanceof Error && err.name === 'TimeoutError');
    throw new ApiClientError(0, timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

async function apiRequest<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const { response, rawText, requestToken } = await fetchApiResponse(path, config);
  if (config.acceptText && response.ok) {
    return rawText as unknown as T;
  }

  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errObj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    if (config.acceptCompilerDiagnostics && response.status === 422 && Array.isArray(errObj.diagnostics)) {
      return parsed as T;
    }
    const code = typeof errObj.error === 'string' ? errObj.error : `HTTP_${response.status}`;
    const issues = Array.isArray(errObj.issues)
      ? (errObj.issues as Array<{ path: (string | number)[]; message: string }>)
      : undefined;
    const issueHint = issues?.length
      ? `（${issues.map((i) => `${i.path.join('.') || '字段'}: ${i.message}`).join('；')}）`
      : '';

    if (response.status === 401 && !config.suppressAuthRedirect && requestToken === readStoredSessionToken()) {
      if (code === 'SESSION_SUPERSEDED') {
        writeStoredSessionToken(null);
        authInvalidHandler?.('SESSION_SUPERSEDED', ERROR_CODE_LABELS.SESSION_SUPERSEDED!);
      } else if (code === 'SESSION_EXPIRED' || code === 'SESSION_INVALID') {
        writeStoredSessionToken(null);
        authInvalidHandler?.('UNAUTHORIZED', ERROR_CODE_LABELS[code] ?? '会话已失效，请重新登录。');
      }
    }

    throw new ApiClientError(
      response.status,
      code,
      `${ERROR_CODE_LABELS[code] ?? `请求未通过 (${code})`}${issueHint}`,
      issues,
    );
  }

  return parsed as T;
}

export const httpClient = {
  getHealth: () => apiRequest<{ ok: boolean }>('/api/health', { suppressAuthRedirect: true }),
  getConfig: () =>
    apiRequest<{ modeBudgets: unknown; communicationUiDeferred: boolean; audioDeferred: boolean }>(
      '/api/config',
      { suppressAuthRedirect: true },
    ),

  register: (input: RegisterRequest) =>
    apiRequest<{ profile: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: input,
      suppressAuthRedirect: true,
    }),

  login: (input: LoginRequest): Promise<LoginResponse> =>
    apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
      suppressAuthRedirect: true,
    }),

  logout: async (): Promise<void> => {
    await apiRequest<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      suppressAuthRedirect: true,
    });
  },

  getMe: () => apiRequest<MeResponse>('/api/me'),

  updateProfile: (patch: {
    nickname?: string;
    onboardingChoice?: 'unset' | 'cards' | 'micro_match' | 'skipped';
    learningStartSelections?: Partial<Record<SubjectId, string>>;
    preferredArena?: ArenaThemeId;
    preferredTacticianId?: TacticianId;
    displaySettings?: { fullscreen: boolean; orientation: 'landscape' };
  }) => apiRequest<UserProfile>('/api/auth/profile', { method: 'PATCH', body: patch }),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: boolean; loginRequired: boolean }>('/api/me/password', {
      method: 'POST',
      body: input,
    }),

  getLobbyState: () => apiRequest<LobbyStateResponse>('/api/lobby/state'),

  enterMode: (input: {
    durationMode: DurationMode;
    queueType?: QueueType;
    sharedSubject?: SubjectId;
  }) => apiRequest<LobbyStateResponse>('/api/lobby/enter', { method: 'POST', body: input }),

  joinByCode: (roomCode: string) =>
    apiRequest<LobbyStateResponse>('/api/lobby/join-code', {
      method: 'POST',
      body: { roomCode: roomCode.trim().toUpperCase() },
    }),

  updateLobbySettings: (patch: {
    durationMode?: DurationMode;
    queueType?: QueueType;
    sharedSubject?: SubjectId;
  }) => apiRequest<LobbyStateResponse>('/api/lobby/settings', { method: 'PATCH', body: patch }),

  updateMemberPrefs: (patch: {
    ready?: boolean;
    subject?: SubjectId;
    learningStartSelections?: Partial<Record<SubjectId, string>>;
    preferredArena?: ArenaThemeId;
    preferredTacticianId?: TacticianId;
    displaySettings?: { fullscreen: boolean; orientation: 'landscape' };
  }) => apiRequest<LobbyStateResponse>('/api/lobby/member-prefs', { method: 'PATCH', body: patch }),

  setReady: (ready: boolean) =>
    apiRequest<LobbyStateResponse>('/api/lobby/ready', { method: 'POST', body: { ready } }),

  startLobby: () => apiRequest<LobbyStateResponse>('/api/lobby/start', { method: 'POST', body: {} }),

  cancelQueue: () =>
    apiRequest<LobbyStateResponse>('/api/lobby/cancel-queue', { method: 'POST', body: {} }),

  leaveLobby: () => apiRequest<LobbyStateResponse>('/api/lobby/leave', { method: 'POST', body: {} }),

  acceptMatch: (ticketId: string, accept: boolean) =>
    apiRequest<LobbyStateResponse>('/api/lobby/accept-match', {
      method: 'POST',
      body: { ticketId, accept },
    }),

  returnToPrep: () =>
    apiRequest<LobbyStateResponse>('/api/matches/return-to-prep', { method: 'POST', body: {} }),

  sendLobbyCommunication: (msg: CommunicationClientSend) =>
    apiRequest<{ message: CommunicationEnvelope; recipientUserIds: string[] }>(
      '/api/lobby/communicate',
      { method: 'POST', body: msg },
    ),

  getLobbyCommunication: () => apiRequest<CommunicationEnvelope[]>('/api/lobby/communication'),

  setBlockedSender: (senderUserId: string, blocked: boolean) =>
    apiRequest<{ ok: boolean }>('/api/lobby/blocked', {
      method: 'POST',
      body: { senderUserId, blocked },
    }),

  getCurrentSeasonTerm: () => apiRequest<SeasonTermInfo>('/api/seasons/current'),

  getLeaderboard: (mode: DurationMode, params?: { seasonTermId?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.seasonTermId) search.set('seasonTermId', params.seasonTermId);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest<LeaderboardResponse>(`/api/ranking/${mode}${qs ? `?${qs}` : ''}`);
  },

  getActiveMatch: () => apiRequest<{ activeSeat: unknown | null }>('/api/matches/active'),

  getMatchHistory: () => apiRequest<MatchHistoryItem[]>('/api/matches/history'),

  getLearningDashboard: () => apiRequest<LearningDashboardResponse>('/api/learning/dashboard'),

  getDueReviews: () => apiRequest<FsrsCardRecord[]>('/api/learning/due'),

  getCoursePacks: () =>
    apiRequest<Array<{ manifest: CoursePackManifest; isActive: boolean }>>('/api/learning/courses'),

  getCoursePackDetail: (packId: string) =>
    apiRequest<{ manifest: CoursePackManifest; questions: ClientQuestionView[] }>(
      `/api/learning/packs/${encodeURIComponent(packId)}`,
    ),

  startStandaloneLearning: (input: {
    mode?: DurationMode;
    nodeIndex?: number;
    selectedSubjects?: SubjectId[];
    packIds?: string[];
  }) =>
    apiRequest<DirectLearningSessionView>('/api/learning/standalone/start', {
      method: 'POST',
      body: input,
    }),

  getDirectLearningSession: (sessionId: string) =>
    apiRequest<DirectLearningSessionView>(
      `/api/learning/direct/sessions/${encodeURIComponent(sessionId)}`,
    ),

  submitStandaloneAnswer: (input: {
    sessionId: string;
    questionId: string;
    submission: {
      answer?: string | number | readonly string[] | Readonly<Record<string, string | number>> | null;
      status?: 'submitted' | 'skipped' | 'timed_out';
      questionId?: string;
      hintUsed?: boolean;
    };
  }) =>
    apiRequest<DirectLearningSubmitResponse>('/api/learning/standalone/submit', {
      method: 'POST',
      body: {
        sessionId: input.sessionId,
        action: 'submit',
        questionId: input.questionId,
        submission: input.submission,
      },
    }),

  advanceStandaloneStep: (sessionId: string) =>
    apiRequest<DirectLearningSessionView>('/api/learning/standalone/submit', {
      method: 'POST',
      body: {
        sessionId,
        action: 'advance',
        advance: true,
      },
    }),

  syncOfflineAttempts: (input: {
    packId: string;
    coursePackVersion: string;
    idempotencyKey: string;
    submissions: Record<
      string,
      {
        answer?: string | number | readonly string[] | Readonly<Record<string, string | number>> | null;
        status?: 'submitted' | 'skipped' | 'timed_out';
        hintUsed?: boolean;
      }
    >;
  }) =>
    apiRequest<{
      attemptIds: string[];
      wrongQuestionIds: string[];
      rewardPointsGranted: 0;
      isOfflineUnverified: true;
    }>('/api/learning/offline/sync', {
      method: 'POST',
      body: input,
    }),

  reportQuestionIssue: (report: QuestionIssueReport) =>
    apiRequest<{ reportId: string }>('/api/learning/question-issues', {
      method: 'POST',
      body: report,
    }),

  getRewardsSummary: () => apiRequest<RewardsSummaryResponse>('/api/rewards/summary'),

  getGiftCatalog: () => apiRequest<GiftCatalogItem[]>('/api/rewards/gifts'),

  getPointsLedger: (limit = 100) =>
    apiRequest<RewardPointsLedgerRow[]>(`/api/rewards/ledger?limit=${limit}`),

  getRedemptionOrders: () => apiRequest<RedeemOrder[]>('/api/rewards/orders'),

  redeemGift: async (input: {
    gift: GiftCatalogItem;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<RedeemAttemptOutcome> => {
    try {
      const order = await apiRequest<RedeemOrder>('/api/rewards/redeem', {
        method: 'POST',
        body: {
          giftId: input.gift.giftId,
          idempotencyKey: input.idempotencyKey,
        },
        timeoutMs: input.timeoutMs ?? 8_000,
      });
      return { outcome: 'confirmed', order };
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        !(err.status === 0 && (err.code === 'NETWORK_ERROR' || err.code === 'REQUEST_TIMEOUT'))
      ) {
        throw err;
      }
      const pendingOrder: RedeemOrder = {
        orderId: `pending:${input.idempotencyKey}`,
        giftId: input.gift.giftId,
        giftTitle: input.gift.title,
        pointsDelta: input.gift.pointsCost,
        status: 'pending_verify',
        idempotencyKey: input.idempotencyKey,
        createdAtIso: new Date().toISOString(),
      };
      return {
        outcome: 'pending_verify',
        order: pendingOrder,
        message: '结果待核验，请在兑换订单查看',
      };
    }
  },

  cancelRedemptionOrder: (orderId: string) =>
    apiRequest<RedeemOrder>(`/api/rewards/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: {},
    }),

  compileCoursePackPreview: (input: CompileCoursePackInput): Promise<AdminPackCompileResponse> =>
    apiRequest<AdminPackCompileResponse>('/api/admin/packs/compile-preview', {
      method: 'POST',
      body: input,
      acceptCompilerDiagnostics: true,
    }),

  publishCoursePackDraft: (draftId: string, activate = true) =>
    apiRequest<{ ok: boolean; manifest: CoursePackManifest; activated: boolean }>(
      '/api/admin/packs/publish',
      {
        method: 'POST',
        body: { draftId, activate },
      },
    ),

  listAdminPacks: () => apiRequest<AdminPackListItem[]>('/api/admin/packs'),

  exportAdminPackAuthoring: (packId: string, version: string) =>
    apiRequest<AuthoringCoursePack>(
      `/api/admin/packs/${encodeURIComponent(packId)}/${encodeURIComponent(version)}/export`,
    ),

  rollbackOrActivatePackVersion: (packId: string, version: string) =>
    apiRequest<{ ok: boolean; packId: string; coursePackVersion: string }>(
      `/api/admin/packs/${encodeURIComponent(packId)}/rollback`,
      {
        method: 'POST',
        body: { version },
      },
    ),

  getAnonymousErrorRates: (query?: { cohortGroup?: string; subject?: SubjectId }) => {
    const sp = new URLSearchParams({ format: 'json' });
    if (query?.cohortGroup) sp.set('cohortGroup', query.cohortGroup);
    if (query?.subject) sp.set('subject', query.subject);
    return apiRequest<AnonymousErrorRateRow[]>(
      `/api/admin/analytics/anonymous-error-rates?${sp.toString()}`,
    );
  },

  exportAnonymousErrorRatesCsv: (query?: { cohortGroup?: string; subject?: SubjectId }) => {
    const sp = new URLSearchParams({ format: 'csv' });
    if (query?.cohortGroup) sp.set('cohortGroup', query.cohortGroup);
    if (query?.subject) sp.set('subject', query.subject);
    return apiRequest<string>(`/api/admin/analytics/anonymous-error-rates?${sp.toString()}`, {
      acceptText: true,
    });
  },

  listAdminUsers: () => apiRequest<AdminUserRow[]>('/api/admin/users'),

  updateUserCohortGroup: (userId: string, cohortGroup: string | null) =>
    apiRequest<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/cohort-group`, {
      method: 'PATCH',
      body: { cohortGroup },
    }),

  adminResetPassword: (input: { userId: string; newPassword: string; identityVerified: true }) =>
    apiRequest<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(input.userId)}/reset-password`,
      {
        method: 'POST',
        body: {
          newPassword: input.newPassword,
          identityVerified: input.identityVerified,
        },
      },
    ),
};
