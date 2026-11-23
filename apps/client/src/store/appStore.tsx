import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioEventBus,
  DEFAULT_TACTICIAN_ID,
  NullAudioAdapter,
  TacticianIdSchema,
  type ArenaThemeId,
  type DisplaySettings,
  type DurationMode,
  type GameCommand,
  type ModeStandingSummary,
  type PrepRoomState,
  type QueueType,
  type RedeemOrder,
  type SubjectId,
  type TacticianId,
  type UnitCombatTelemetry,
  type UserProfile,
} from '@pkg/contracts';
import type { BoardStageEngine } from '../stage/index.js';
import {
  LiveBattleChoreographer,
  SnapshotStageSynchronizer,
  toStageSeatIndex,
} from '../hud/stageSync.js';
import {
  applyHostDisplaySettings,
  clearAllPrivateSessionCache,
  readStoredSessionToken,
  writeStoredSessionToken,
} from '../platform/hostBridge.js';
import {
  ApiClientError,
  httpClient,
  registerSessionInvalidHandler,
  type LobbyStateResponse,
  type MemberPrefsView,
  type SeasonTermInfo,
} from '../api/httpClient.js';
import {
  connectAuthoritativeMatch,
  type BattleBroadcastPayload,
  type ConnectedMatchSocket,
  type CommandResultAck,
  type MatchErrorPayload,
  type MatchRoomSnapshot,
  type MatchSummaryPayload,
} from '../api/matchSocket.js';
import { OfflinePracticeMatchController } from '../offline/offlinePracticeController.js';

export type AuthMode = 'booting' | 'unauthenticated' | 'authenticated' | 'offline_practice';
export type BottomNavTab = 'lobby' | 'learning' | 'encyclopedia' | 'ranking' | 'profile';
export type ShopDockPosition = 'bottom' | 'top';
export type SettingsTab = 'match' | 'display' | 'learning' | 'account';
type OnboardingMode = 'choice' | 'cards' | 'micro_match';

export interface ToastNotice {
  id: string;
  tone: 'info' | 'warning' | 'error' | 'success';
  text: string;
}

const PLANNED_SECONDS_BY_MODE: Readonly<Record<DurationMode, number>> = {
  quick: 900,
  standard: 1800,
  deep: 3600,
};

const SHOP_DOCK_POSITION_KEY = 'blc_shop_dock_position_v1';
const OFFLINE_TACTICIAN_KEY = 'blc_offline_tactician_id_v1';

function readDevicePreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function makeOfflineProfile(arena: ArenaThemeId = 'orbital_elevator_port'): UserProfile {
  const storedTactician = TacticianIdSchema.safeParse(readDevicePreference(OFFLINE_TACTICIAN_KEY));
  return {
    userId: 'offline-local-user',
    username: 'offline_commander',
    nickname: '离线星港领航员',
    emailMasked: null,
    role: 'player',
    sessionEpoch: 1,
    onboardingChoice: 'skipped',
    learningStartSelections: {},
    preferredArena: arena,
    preferredTacticianId: storedTactician.data ?? DEFAULT_TACTICIAN_ID,
    displaySettings: { fullscreen: false, orientation: 'landscape' },
    avatarFrameId: null,
    boardPlaqueId: null,
  };
}

export interface AppStoreValue {
  authMode: AuthMode;
  entryGatePassed: boolean;
  enterGameFromStartScreen: () => void;
  profile: UserProfile | null;
  rewardPointsBalance: number | null;
  standings: readonly ModeStandingSummary[];
  currentSeasonTerm: SeasonTermInfo | null;
  dataLoading: boolean;
  supersededBanner: string | null;
  dismissSupersededBanner: () => void;

  toasts: readonly ToastNotice[];
  pushToast: (text: string, tone?: ToastNotice['tone']) => void;
  dismissToast: (id: string) => void;

  activeTab: BottomNavTab;
  setActiveTab: (tab: BottomNavTab) => void;
  viewingPrepRoom: boolean;
  setViewingPrepRoom: (open: boolean) => void;
  redemptionOpen: boolean;
  redemptionOriginTab: 'lobby' | 'profile';
  openRedemption: (origin: 'lobby' | 'profile') => void;
  closeRedemption: () => void;
  pendingVerifyOrders: readonly RedeemOrder[];
  recordPendingVerifyOrder: (order: RedeemOrder) => void;
  reconcileConfirmedOrders: (serverOrders: readonly RedeemOrder[]) => void;

  onboardingOpen: boolean;
  onboardingInitialMode: OnboardingMode;
  openOnboarding: (mode?: OnboardingMode | 'learning_start') => void;
  closeOnboarding: () => void;

  settingsModalOpen: boolean;
  settingsInitialTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  openLearningStartEditor: () => void;
  shopDockPosition: ShopDockPosition;
  shopCollapsed: boolean;
  setShopDockPosition: (position: ShopDockPosition) => void;
  setShopCollapsed: (collapsed: boolean) => void;
  preferredTacticianId: TacticianId;
  setPreferredTacticianId: (id: TacticianId) => Promise<void>;

  login: (username: string, password: string) => Promise<void>;
  registerAndLogin: (input: {
    username: string;
    password: string;
    nickname: string;
    email?: string | null;
  }) => Promise<{ loginRequired: true; message: string } | void>;
  enterOfflinePractice: () => void;
  logout: () => Promise<void>;
  refreshMeAndLobby: () => Promise<void>;
  patchUserProfile: (patch: {
    nickname?: string;
    onboardingChoice?: 'unset' | 'cards' | 'micro_match' | 'skipped';
    learningStartSelections?: Partial<Record<SubjectId, string>>;
    preferredArena?: ArenaThemeId;
    preferredTacticianId?: TacticianId;
    displaySettings?: { fullscreen: boolean; orientation: 'landscape' };
  }) => Promise<UserProfile | null>;

  lobbyState: LobbyStateResponse;
  enterModePrepRoom: (mode: DurationMode, preferredSubject?: SubjectId) => Promise<void>;
  joinRoomByCode: (roomCode: string) => Promise<void>;
  updateRoomSettings: (patch: {
    durationMode?: DurationMode;
    queueType?: QueueType;
    sharedSubject?: SubjectId;
  }) => Promise<void>;
  updateSelfRoomPrefs: (patch: {
    ready?: boolean;
    subject?: SubjectId;
    learningStartSelections?: Partial<Record<SubjectId, string>>;
    preferredArena?: ArenaThemeId;
    preferredTacticianId?: TacticianId;
    displaySettings?: DisplaySettings;
  }) => Promise<void>;
  startMatchOrQueue: () => Promise<void>;
  cancelMatchQueue: () => Promise<void>;
  leavePrepRoom: () => Promise<void>;
  respondMatchAccept: (ticketId: string, accept: boolean) => Promise<void>;

  inActiveMatch: boolean;
  isOfflineSandboxMatch: boolean;
  matchSnapshot: MatchRoomSnapshot | null;
  matchSummary: MatchSummaryPayload | null;
  matchError: MatchErrorPayload | null;
  matchConnectionState: 'connected' | 'reconnecting' | 'disconnected';
  matchActionPending: boolean;
  combatTelemetry: readonly UnitCombatTelemetry[];
  scoutedSeatId: string | null;
  inspectedUnitId: string | null;
  inspectedScreenPos: { x: number; y: number } | null;
  draggingUnitId: string | null;
  overSellDropzone: boolean;
  sendMatchCommand: (command: GameCommand) => void;
  sendMatchLearningSubmit: (
    questionId: string,
    submission: {
      answer?: string | number | readonly string[] | Readonly<Record<string, string | number>> | null;
      status?: 'submitted' | 'skipped' | 'timed_out';
      questionId?: string;
      hintUsed?: boolean;
    },
  ) => Promise<CommandResultAck>;
  sendMatchLearningAdvance: () => Promise<CommandResultAck>;
  skipOfflinePhaseWait: () => void;
  scoutMatchSeat: (seatId: string | null) => void;
  clearInspectedUnit: () => void;
  setInspectedUnitManual: (unitId: string | null) => void;
  returnFromSummaryToPrep: () => Promise<void>;
  exitMatchToLobby: () => Promise<void>;

  audioBus: AudioEventBus;
  arenaTheme: ArenaThemeId;
  setArenaThemeLive: (theme: ArenaThemeId, persist?: boolean) => Promise<void>;
  registerStageEngine: (engine: BoardStageEngine | null) => void;
  getStageEngine: () => BoardStageEngine | null;
  setExternalLearningOverlay: (key: string, active: boolean) => void;
  setCustomStageOverride: (active: boolean) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

type SessionAction = { version: number; token: string | null };

const EMPTY_LOBBY_STATE: LobbyStateResponse = {
  prepRoom: null,
  acceptPrompt: null,
  match: null,
  selfPrefs: null,
};

export function AppStoreProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [authMode, setAuthMode] = useState<AuthMode>('booting');
  const [entryGatePassed, setEntryGatePassed] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rewardPointsBalance, setRewardPointsBalance] = useState<number | null>(null);
  const [standings, setStandings] = useState<readonly ModeStandingSummary[]>([]);
  const [currentSeasonTerm, setCurrentSeasonTerm] = useState<SeasonTermInfo | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [supersededBanner, setSupersededBanner] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [activeTab, setActiveTabState] = useState<BottomNavTab>('lobby');
  const [viewingPrepRoom, setViewingPrepRoom] = useState<boolean>(false);
  const [redemptionOpen, setRedemptionOpen] = useState<boolean>(false);
  const [redemptionOriginTab, setRedemptionOriginTab] = useState<'lobby' | 'profile'>('lobby');
  const [pendingVerifyOrders, setPendingVerifyOrders] = useState<RedeemOrder[]>([]);

  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const [onboardingInitialMode, setOnboardingInitialMode] = useState<OnboardingMode>('choice');
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [shopDockPosition, setShopDockPositionState] = useState<ShopDockPosition>(() =>
    readDevicePreference(SHOP_DOCK_POSITION_KEY) === 'top' ? 'top' : 'bottom');
  const [shopCollapsed, setShopCollapsed] = useState(false);
  const preferredTacticianId = profile?.preferredTacticianId ?? DEFAULT_TACTICIAN_ID;

  const [lobbyState, setLobbyState] = useState<LobbyStateResponse>(EMPTY_LOBBY_STATE);
  const [arenaTheme, setArenaTheme] = useState<ArenaThemeId>('orbital_elevator_port');

  const [matchSnapshot, setMatchSnapshot] = useState<MatchRoomSnapshot | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummaryPayload | null>(null);
  const [matchError, setMatchError] = useState<MatchErrorPayload | null>(null);
  const [matchConnectionState, setMatchConnectionState] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('connected');
  const [isOfflineSandboxMatch, setIsOfflineSandboxMatch] = useState<boolean>(false);
  const [matchActionPending, setMatchActionPending] = useState(false);
  const [combatTelemetry, setCombatTelemetry] = useState<UnitCombatTelemetry[]>([]);
  const [scoutedSeatId, setScoutedSeatId] = useState<string | null>(null);
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null);
  const [inspectedScreenPos, setInspectedScreenPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const [overSellDropzone, setOverSellDropzone] = useState<boolean>(false);
  const [customStageOverride, setCustomStageOverride] = useState<boolean>(false);

  const audioBus = useMemo(() => {
    const bus = new AudioEventBus();
    bus.setAdapter(NullAudioAdapter);
    return bus;
  }, []);

  const sessionVersionRef = useRef(0);
  const lobbyRequestVersionRef = useRef(0);
  const profileRequestVersionRef = useRef(0);

  const captureSessionAction = useCallback((): SessionAction => ({
    version: sessionVersionRef.current,
    token: readStoredSessionToken(),
  }), []);
  const isCurrentSessionAction = useCallback((action: SessionAction) =>
    action.version === sessionVersionRef.current && action.token === readStoredSessionToken(), []);
  const assertCurrentSessionAction = useCallback((action: SessionAction) => {
    if (!isCurrentSessionAction(action)) throw new Error('操作所属会话已结束，请在当前会话重试。');
  }, [isCurrentSessionAction]);
  const requestLobbyChange = useCallback(async (request: () => Promise<LobbyStateResponse>, updatesProfile = false) => {
    const action = captureSessionAction();
    const version = ++lobbyRequestVersionRef.current;
    const profileVersion = updatesProfile ? ++profileRequestVersionRef.current : profileRequestVersionRef.current;
    const next = await request();
    assertCurrentSessionAction(action);
    if (version !== lobbyRequestVersionRef.current) throw new Error('房间操作已被后续操作替代。');
    setLobbyState(next);
    if (updatesProfile && next.profile && profileVersion === profileRequestVersionRef.current) setProfile(next.profile);
    return next;
  }, [assertCurrentSessionAction, captureSessionAction]);

  const stageRef = useRef<BoardStageEngine | null>(null);
  const stageSyncRef = useRef<SnapshotStageSynchronizer>(new SnapshotStageSynchronizer());
  const battleChoreoRef = useRef<LiveBattleChoreographer>(new LiveBattleChoreographer());
  const latestBattlePayloadRef = useRef<BattleBroadcastPayload | null>(null);

  const socketRef = useRef<ConnectedMatchSocket | null>(null);
  const matchConnectionVersionRef = useRef(0);
  const connectingRoomIdRef = useRef<string | null>(null);
  const offlineMatchRef = useRef<OfflinePracticeMatchController | null>(null);
  const overlayKeysRef = useRef<Set<string>>(new Set());
  const [overlayCount, setOverlayCount] = useState<number>(0);

  const pushToast = useCallback((text: string, tone: ToastNotice['tone'] = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setShopDockPosition = useCallback((position: ShopDockPosition) => {
    setShopDockPositionState(position);
    try {
      window.localStorage.setItem(SHOP_DOCK_POSITION_KEY, position);
    } catch {
    }
  }, []);
  const openSettings = useCallback((tab: SettingsTab = 'match') => setSettingsTab(tab), []);
  const closeSettings = useCallback(() => setSettingsTab(null), []);
  const openLearningStartEditor = useCallback(() => openSettings('learning'), [openSettings]);

  const cleanupActiveMatchRuntime = useCallback(async () => {
    matchConnectionVersionRef.current += 1;
    connectingRoomIdRef.current = null;
    battleChoreoRef.current.stop();
    latestBattlePayloadRef.current = null;
    if (offlineMatchRef.current) {
      offlineMatchRef.current.dispose();
      offlineMatchRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    setIsOfflineSandboxMatch(false);
    setMatchActionPending(false);
    setMatchSnapshot(null);
    setMatchSummary(null);
    setMatchError(null);
    setCombatTelemetry([]);
    setScoutedSeatId(null);
    setInspectedUnitId(null);
    setDraggingUnitId(null);
    setOverSellDropzone(false);
    stageRef.current?.returnHome();
    if (socket) await socket.leave(true);
  }, []);

  const handleSessionSuperseded = useCallback(
    (message = '当前账号已在另一设备登录接管，本端已安全退回登录界面。') => {
      sessionVersionRef.current += 1;
      void cleanupActiveMatchRuntime();
      writeStoredSessionToken(null);
      setDataLoading(false);
      setProfile(null);
      setRewardPointsBalance(null);
      setStandings([]);
      setLobbyState(EMPTY_LOBBY_STATE);
      setViewingPrepRoom(false);
      setRedemptionOpen(false);
      setOnboardingOpen(false);
      setSettingsTab(null);
      setShopCollapsed(false);
      setSupersededBanner(message);
      setAuthMode('unauthenticated');
    },
    [cleanupActiveMatchRuntime],
  );

  useEffect(() => {
    registerSessionInvalidHandler((reason, message) => {
      if (reason === 'SESSION_SUPERSEDED') {
        handleSessionSuperseded('当前账号已在另一设备登录接管，原设备控制权已立即回收。');
      } else {
        handleSessionSuperseded(message);
      }
    });
    return () => registerSessionInvalidHandler(null);
  }, [handleSessionSuperseded]);

  const joinOnlineMatchRoom = useCallback(
    async (roomId: string) => {
      const token = readStoredSessionToken();
      if (!token) return;
      if (socketRef.current?.roomId === roomId || connectingRoomIdRef.current === roomId) return;

      const action = captureSessionAction();
      const version = ++matchConnectionVersionRef.current;
      const isCurrentConnection = () => isCurrentSessionAction(action) && version === matchConnectionVersionRef.current;
      connectingRoomIdRef.current = roomId;
      try {
        if (socketRef.current) {
          await socketRef.current.leave(true);
          socketRef.current = null;
        }
        if (!isCurrentConnection()) return;
        setMatchError(null);
        setIsOfflineSandboxMatch(false);
        const connected = await connectAuthoritativeMatch(roomId, token, {
          onSnapshot: (snap) => {
            if (!isCurrentConnection()) return;
            latestBattlePayloadRef.current = snap.battle ?? null;
            setMatchSnapshot(snap);
            if (snap.summary) {
              setMatchSummary(snap.summary);
            }
          },
          onBattle: (payload) => {
            if (!isCurrentConnection()) return;
            latestBattlePayloadRef.current = payload;
            const stage = stageRef.current;
            if (stage && matchSnapshotRef.current) {
              const snap = matchSnapshotRef.current;
              const viewed = scoutedSeatIdRef.current ?? snap.seatId;
              const sIdx = toStageSeatIndex(
                viewed,
                snap.seatId,
                snap.seats.map((s) => s.seatId),
              );
              battleChoreoRef.current.start({
                stage,
                snapshot: snap,
                battlePayload: payload,
                viewedSeatId: viewed,
                stageSeatIndex: sIdx,
                onTelemetry: (tel) => setCombatTelemetry(tel),
              });
            }
          },
          onLearningPersisted: (persisted) => {
            if (!isCurrentConnection()) return;
            if (persisted.rewardPointsGranted > 0) {
              pushToast(
                `本节点掌握验证已核验入账 +${persisted.rewardPointsGranted} 研学积分`,
                'success',
              );
              setRewardPointsBalance((prev) =>
                typeof prev === 'number' ? prev + persisted.rewardPointsGranted : prev,
              );
            }
          },
          onSummary: (summary) => {
            if (!isCurrentConnection()) return;
            setMatchSummary(summary);
          },
          onMatchError: (err) => {
            if (!isCurrentConnection()) return;
            setMatchError(err);
            pushToast(`对局异常终止：${err.reason}（已核验学习记录保留）`, 'error');
          },
          onSessionSuperseded: () => {
            if (!isCurrentConnection()) return;
            handleSessionSuperseded('当前账号已在另一设备登录接管，席位已无缝移交新设备。');
          },
          onActionPendingChange: (pending) => {
            if (!isCurrentConnection()) return;
            setMatchActionPending(pending);
          },
          onConnectionStateChange: (st) => {
            if (!isCurrentConnection()) return;
            setMatchConnectionState(st);
            if (st === 'disconnected') {
              setMatchActionPending(false);
              matchConnectionVersionRef.current += 1;
              socketRef.current = null;
              connectingRoomIdRef.current = null;
            }
          },
        });
        if (!isCurrentConnection()) {
          await connected.leave(true);
          return;
        }
        socketRef.current = connected;
      } catch (err) {
        if (!isCurrentConnection()) return;
        const msg = err instanceof Error ? err.message : '连接权威对局房间失败';
        pushToast(msg, 'error');
      } finally {
        if (version === matchConnectionVersionRef.current) connectingRoomIdRef.current = null;
      }
    },
    [captureSessionAction, handleSessionSuperseded, isCurrentSessionAction, pushToast],
  );

  useEffect(() => {
    const roomId = matchSnapshot?.roomId;
    if (authMode !== 'authenticated' || matchConnectionState !== 'disconnected' || !roomId) return;
    const reconnect = () => {
      if (!socketRef.current && !connectingRoomIdRef.current) void joinOnlineMatchRoom(roomId);
    };
    reconnect();
    const timer = setInterval(reconnect, 1400);
    return () => clearInterval(timer);
  }, [authMode, joinOnlineMatchRoom, matchConnectionState, matchSnapshot?.roomId]);

  const matchSnapshotRef = useRef<MatchRoomSnapshot | null>(null);
  matchSnapshotRef.current = matchSnapshot;
  const scoutedSeatIdRef = useRef<string | null>(null);
  scoutedSeatIdRef.current = scoutedSeatId;

  const sendMatchCommand = useCallback((command: GameCommand) => {
    if (offlineMatchRef.current) {
      const res = offlineMatchRef.current.sendCommand(command);
      if (!res.ok && res.reason) {
        pushToast(`无法执行：${res.reason}`, 'warning');
      }
      return;
    }
    if (!socketRef.current) {
      pushToast('对局连接尚未恢复，请稍后重试。', 'warning');
      return;
    }
    const action = captureSessionAction();
    void socketRef.current.sendCommand(command).catch((err: unknown) => {
      if (isCurrentSessionAction(action)) pushToast(err instanceof Error ? err.message : '对局指令未发送', 'warning');
    });
  }, [captureSessionAction, isCurrentSessionAction, pushToast]);

  const sendMatchLearningSubmit = useCallback(
    (
      questionId: string,
      submission: {
        answer?: string | number | readonly string[] | Readonly<Record<string, string | number>> | null;
        status?: 'submitted' | 'skipped' | 'timed_out';
        questionId?: string;
        hintUsed?: boolean;
      },
    ) => {
      if (offlineMatchRef.current) {
        const result = offlineMatchRef.current.sendLearningSubmit(questionId, submission);
        return result.ok ? Promise.resolve(result) : Promise.reject(new Error('LEARNING_SUBMISSION_REJECTED'));
      }
      if (!socketRef.current) return Promise.reject(new Error('MATCH_CONNECTION_NOT_READY'));
      return socketRef.current.sendLearningSubmit(questionId, submission);
    },
    [],
  );

  const sendMatchLearningAdvance = useCallback(() => {
    if (offlineMatchRef.current) {
      const result = offlineMatchRef.current.sendLearningAdvance();
      return result.ok ? Promise.resolve(result) : Promise.reject(new Error('LEARNING_ADVANCE_REJECTED'));
    }
    if (!socketRef.current) return Promise.reject(new Error('MATCH_CONNECTION_NOT_READY'));
    return socketRef.current.sendLearningAdvance();
  }, []);

  const skipOfflinePhaseWait = useCallback(() => {
    void offlineMatchRef.current?.skipCurrentPhaseWait();
  }, []);

  const refreshMeAndLobby = useCallback(async () => {
    if (!readStoredSessionToken()) {
      setDataLoading(false);
      setAuthMode('unauthenticated');
      return;
    }
    const action = captureSessionAction();
    const lobbyVersion = lobbyRequestVersionRef.current;
    const profileVersion = profileRequestVersionRef.current;
    setDataLoading(true);
    try {
      const [me, lobby, seasonTerm] = await Promise.all([
        httpClient.getMe(),
        httpClient.getLobbyState().catch(() => EMPTY_LOBBY_STATE),
        httpClient.getCurrentSeasonTerm().catch(() => null),
      ]);
      if (!isCurrentSessionAction(action)) return;
      if (profileVersion === profileRequestVersionRef.current) setProfile(me.profile);
      setRewardPointsBalance(me.rewardPointsBalance);
      setStandings(me.standings);
      if (seasonTerm) setCurrentSeasonTerm(seasonTerm);
      if (lobbyVersion === lobbyRequestVersionRef.current) setLobbyState(lobby);
      if (profileVersion === profileRequestVersionRef.current && lobbyVersion === lobbyRequestVersionRef.current) {
        setArenaTheme(lobby.selfPrefs?.preferredArena ?? me.profile.preferredArena);
      }
      setAuthMode('authenticated');
      if (lobbyVersion !== lobbyRequestVersionRef.current) return;

      const activeObj =
        me.activeSeat && typeof me.activeSeat === 'object'
          ? (me.activeSeat as { roomId?: string; completed?: boolean })
          : null;
      const activeRoomId =
        activeObj && activeObj.roomId && !activeObj.completed
          ? activeObj.roomId
          : lobby.match?.roomId ?? null;

      if (activeRoomId) {
        setEntryGatePassed(true);
        await joinOnlineMatchRoom(activeRoomId);
        return;
      }

      if (me.profile.onboardingChoice === 'unset') {
        setOnboardingInitialMode('choice');
        setOnboardingOpen(true);
      } else if (lobby.prepRoom) {
        setViewingPrepRoom(true);
      }
    } catch (err) {
      if (!isCurrentSessionAction(action)) return;
      if (err instanceof ApiClientError && err.status === 401) {
        if (err.code !== 'SESSION_SUPERSEDED') {
          writeStoredSessionToken(null);
          setAuthMode('unauthenticated');
        }
      } else {
        pushToast(err instanceof Error ? err.message : '无法连接在线服务器，可使用纯离线单机练习', 'warning');
        if (!profile) setAuthMode('unauthenticated');
      }
    } finally {
      if (isCurrentSessionAction(action)) setDataLoading(false);
    }
  }, [captureSessionAction, isCurrentSessionAction, joinOnlineMatchRoom, profile, pushToast]);

  useEffect(() => {
    if (readStoredSessionToken()) {
      void refreshMeAndLobby();
    } else {
      setDataLoading(false);
      setAuthMode('unauthenticated');
    }
  }, []);

  useEffect(() => {
    if (authMode !== 'authenticated' || Boolean(matchSnapshot)) return;
    const hasActiveParty =
      Boolean(lobbyState.prepRoom) || Boolean(lobbyState.acceptPrompt) || Boolean(lobbyState.match);
    const intervalMs = hasActiveParty ? 1400 : 8000;

    const timer = setInterval(() => {
      const action = captureSessionAction();
      const lobbyVersion = lobbyRequestVersionRef.current;
      void httpClient
        .getLobbyState()
        .then((next) => {
          if (!isCurrentSessionAction(action) || lobbyVersion !== lobbyRequestVersionRef.current) return;
          setLobbyState(next);
          if (next.lastError) {
            pushToast(`匹配状态提示：${next.lastError}`, 'warning');
          }
          if (next.match?.roomId && !socketRef.current) {
            void joinOnlineMatchRoom(next.match.roomId);
          }
        })
        .catch(() => {
        });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    authMode,
    captureSessionAction,
    isCurrentSessionAction,
    joinOnlineMatchRoom,
    lobbyState.acceptPrompt,
    lobbyState.match,
    lobbyState.prepRoom,
    matchSnapshot,
    pushToast,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setArenaTheme(arenaTheme);
  }, [arenaTheme]);

  const isEarlyStrategyUnlocked =
    matchSnapshot?.phase === 'learning' && Boolean(matchSnapshot.learning?.complete);
  const shouldSuspendGpuForLearning =
    overlayCount > 0 || (matchSnapshot?.phase === 'learning' && !isEarlyStrategyUnlocked);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setLearningOverlayActive(shouldSuspendGpuForLearning);
  }, [shouldSuspendGpuForLearning]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || customStageOverride) return;

    if (!matchSnapshot) {
      battleChoreoRef.current.stop();
      if (authMode === 'booting' || authMode === 'unauthenticated') {
        stage.syncUnits([]);
        stage.syncLootOrbs([]);
      } else {
        stageSyncRef.current.syncAmbientDiorama(stage);
      }
      return;
    }

    if (matchSnapshot.phase === 'battle') {
      const viewed = scoutedSeatId ?? matchSnapshot.seatId;
      const sIdx = toStageSeatIndex(
        viewed,
        matchSnapshot.seatId,
        matchSnapshot.seats.map((s) => s.seatId),
      );
      battleChoreoRef.current.start({
        stage,
        snapshot: matchSnapshot,
        battlePayload: matchSnapshot.battle ?? latestBattlePayloadRef.current,
        viewedSeatId: viewed,
        stageSeatIndex: sIdx,
        onTelemetry: (tel) => setCombatTelemetry(tel),
      });
    } else {
      battleChoreoRef.current.stop();
      stageSyncRef.current.syncSnapshot(stage, matchSnapshot);
    }
  }, [authMode, customStageOverride, matchSnapshot, scoutedSeatId]);

  const arenaThemeRef = useRef<ArenaThemeId>(arenaTheme);
  arenaThemeRef.current = arenaTheme;
  const authModeRef = useRef<AuthMode>(authMode);
  authModeRef.current = authMode;
  const customStageOverrideRef = useRef<boolean>(customStageOverride);
  customStageOverrideRef.current = customStageOverride;
  const sendMatchCommandRef = useRef(sendMatchCommand);
  sendMatchCommandRef.current = sendMatchCommand;

  useEffect(() => {
    stageRef.current?.setArenaTheme(arenaTheme);
  }, [arenaTheme]);

  const registerStageEngine = useCallback((engine: BoardStageEngine | null) => {
    stageRef.current = engine;
    if (!engine) return;
    engine.setArenaTheme(arenaThemeRef.current);
    engine.setCallbacks({
      onMoveUnit: (instanceId, to) => {
        if (!matchSnapshotRef.current) return;
        sendMatchCommandRef.current({ type: 'MOVE_UNIT', instanceId, to });
      },
      onSellUnitRequest: (instanceId) => {
        if (!matchSnapshotRef.current) return;
        sendMatchCommandRef.current({ type: 'SELL_UNIT', instanceId });
      },
      onCollectLootOrb: (orbId) => {
        stageSyncRef.current.markOrbCollected(orbId);
      },
      onInspectUnit: (instanceId, screenPos) => {
        if (!matchSnapshotRef.current || instanceId?.startsWith('ambient:')) {
          setInspectedUnitId(null);
          return;
        }
        setInspectedUnitId(instanceId);
        setInspectedScreenPos(screenPos ? { x: screenPos.x, y: screenPos.y } : null);
      },
      onDragStateChange: (draggingId, overSell) => {
        setDraggingUnitId(draggingId);
        setOverSellDropzone(overSell);
      },
    });

    if (!customStageOverrideRef.current && !matchSnapshotRef.current) {
      if (authModeRef.current === 'booting' || authModeRef.current === 'unauthenticated') {
        engine.syncUnits([]);
        engine.syncLootOrbs([]);
      } else {
        stageSyncRef.current.syncAmbientDiorama(engine);
      }
    }
  }, []);

  const getStageEngine = useCallback(() => stageRef.current, []);

  const setExternalLearningOverlay = useCallback((key: string, active: boolean) => {
    const next = new Set(overlayKeysRef.current);
    if (active) next.add(key);
    else next.delete(key);
    overlayKeysRef.current = next;
    setOverlayCount(next.size);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const version = ++sessionVersionRef.current;
      setSupersededBanner(null);
      const result = await httpClient.login({ username, password });
      if (version !== sessionVersionRef.current) return;
      writeStoredSessionToken(result.token);
      setEntryGatePassed(true);
      await refreshMeAndLobby();
    },
    [refreshMeAndLobby],
  );

  const registerAndLogin = useCallback(
    async (input: {
      username: string;
      password: string;
      nickname: string;
      email?: string | null;
    }) => {
      const version = ++sessionVersionRef.current;
      setSupersededBanner(null);
      await httpClient.register({
        username: input.username,
        password: input.password,
        nickname: input.nickname,
        email: input.email?.trim() ? input.email.trim() : null,
      });
      if (version !== sessionVersionRef.current) return;
      try {
        const result = await httpClient.login({ username: input.username, password: input.password });
        if (version !== sessionVersionRef.current) return;
        writeStoredSessionToken(result.token);
        setEntryGatePassed(true);
        await refreshMeAndLobby();
      } catch (err) {
        if (version !== sessionVersionRef.current) return;
        return { loginRequired: true as const, message: err instanceof Error ? err.message : '自动登录未完成' };
      }
    },
    [refreshMeAndLobby],
  );

  const enterOfflinePractice = useCallback(() => {
    sessionVersionRef.current += 1;
    setSupersededBanner(null);
    const localProf = makeOfflineProfile(arenaTheme);
    setProfile(localProf);
    setRewardPointsBalance(null);
    setStandings([]);
    setCurrentSeasonTerm({
      seasonTermId: 'offline-local',
      label: '纯离线单机演练环境（不计段位与研学积分）',
      startsAtIso: new Date().toISOString(),
      endsAtIso: new Date().toISOString(),
      rewardsSettled: false,
    });
    setLobbyState(EMPTY_LOBBY_STATE);
    setViewingPrepRoom(false);
    setActiveTabState('lobby');
    setDataLoading(false);
    setEntryGatePassed(true);
    setAuthMode('offline_practice');
  }, [arenaTheme, pushToast]);

  const logout = useCallback(async () => {
    const version = ++sessionVersionRef.current;
    setAuthMode('booting');
    await cleanupActiveMatchRuntime();
    if (version !== sessionVersionRef.current) return;
    if (authMode === 'authenticated') {
      await httpClient.logout().catch(() => undefined);
    }
    if (version !== sessionVersionRef.current) return;
    await clearAllPrivateSessionCache();
    if (version !== sessionVersionRef.current) return;
    setProfile(null);
    setRewardPointsBalance(null);
    setStandings([]);
    setLobbyState(EMPTY_LOBBY_STATE);
    setViewingPrepRoom(false);
    setRedemptionOpen(false);
    setOnboardingOpen(false);
    setSettingsTab(null);
    setShopCollapsed(false);
    setActiveTabState('lobby');
    setEntryGatePassed(false);
    setAuthMode('unauthenticated');
  }, [authMode, cleanupActiveMatchRuntime]);

  const projectSelfProfilePrefs = useCallback((confirmed: UserProfile, patch: Parameters<AppStoreValue['patchUserProfile']>[0]) => {
    const tacticianId = patch.preferredTacticianId === undefined ? undefined : confirmed.preferredTacticianId ?? DEFAULT_TACTICIAN_ID;
    const learningStartSelections = patch.learningStartSelections === undefined ? undefined : confirmed.learningStartSelections;
    if (tacticianId === undefined && learningStartSelections === undefined) return;
    setLobbyState((prev) => {
      const room = prev.prepRoom;
      if (!room || !prev.selfPrefs) return prev;
      return {
        ...prev,
        prepRoom: tacticianId === undefined ? room : {
          ...room,
          members: room.members.map((member) => member.userId === confirmed.userId ? { ...member, tacticianId } : member),
        },
        selfPrefs: {
          ...prev.selfPrefs,
          ...(tacticianId !== undefined ? { preferredTacticianId: tacticianId } : {}),
          ...(learningStartSelections !== undefined ? { learningStartSelections } : {}),
        },
      };
    });
  }, []);

  const patchUserProfile = useCallback(
    async (patch: Parameters<AppStoreValue['patchUserProfile']>[0]): Promise<UserProfile | null> => {
      const action = captureSessionAction();
      if (patch.displaySettings) {
        const applied = await applyHostDisplaySettings(patch.displaySettings);
        assertCurrentSessionAction(action);
        if (applied.appliedFullscreen !== patch.displaySettings.fullscreen) {
          throw new Error('显示模式未切换，请允许全屏后重试。');
        }
      }
      const version = ++profileRequestVersionRef.current;
      if (authMode === 'offline_practice') {
        if (patch.preferredTacticianId !== undefined) {
          const id = TacticianIdSchema.parse(patch.preferredTacticianId);
          try {
            window.localStorage.setItem(OFFLINE_TACTICIAN_KEY, id);
          } catch {
            throw new Error('无法保存离线领航员偏好。');
          }
        }
        if (patch.preferredArena) setArenaTheme(patch.preferredArena);
        const baseProfile = profile ?? makeOfflineProfile(arenaTheme);
        const nextProfile: UserProfile = {
          ...baseProfile,
          ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
          ...(patch.onboardingChoice !== undefined ? { onboardingChoice: patch.onboardingChoice } : {}),
          ...(patch.learningStartSelections !== undefined
            ? { learningStartSelections: { ...baseProfile.learningStartSelections, ...patch.learningStartSelections } }
            : {}),
          ...(patch.preferredArena !== undefined ? { preferredArena: patch.preferredArena } : {}),
          ...(patch.preferredTacticianId !== undefined ? { preferredTacticianId: patch.preferredTacticianId } : {}),
          ...(patch.displaySettings !== undefined ? { displaySettings: patch.displaySettings } : {}),
        };
        setProfile(nextProfile);
        projectSelfProfilePrefs(nextProfile, patch);
        return nextProfile;
      }
      const updated = await httpClient.updateProfile(patch);
      assertCurrentSessionAction(action);
      if (version !== profileRequestVersionRef.current) throw new Error('资料操作已被后续操作替代。');
      setProfile(updated);
      projectSelfProfilePrefs(updated, patch);
      if (patch.preferredArena) setArenaTheme(patch.preferredArena);
      return updated;
    },
    [arenaTheme, assertCurrentSessionAction, authMode, captureSessionAction, profile, projectSelfProfilePrefs],
  );

  const setPreferredTacticianId = useCallback(async (id: TacticianId) => {
    if (authMode === 'authenticated' && lobbyState.prepRoom?.status === 'idle') {
      await requestLobbyChange(() => httpClient.updateMemberPrefs({ preferredTacticianId: id }), true);
    } else {
      await patchUserProfile({ preferredTacticianId: id });
    }
  }, [authMode, lobbyState.prepRoom?.status, patchUserProfile, requestLobbyChange]);

  const setArenaThemeLive = useCallback(
    async (theme: ArenaThemeId, persist = true) => {
      const action = captureSessionAction();
      const confirmedTheme = profile?.preferredArena ?? arenaTheme;
      setArenaTheme(theme);
      stageRef.current?.setArenaTheme(theme);
      if (!persist || authMode === 'unauthenticated') return;
      const saving = authMode === 'authenticated' && lobbyState.prepRoom?.status === 'idle'
        ? requestLobbyChange(() => httpClient.updateMemberPrefs({ preferredArena: theme }), true)
        : patchUserProfile({ preferredArena: theme });
      const version = profileRequestVersionRef.current;
      try {
        await saving;
        assertCurrentSessionAction(action);
      } catch (err) {
        if (isCurrentSessionAction(action) && version === profileRequestVersionRef.current) {
          setArenaTheme(confirmedTheme);
          pushToast(err instanceof Error ? err.message : '舞台偏好未保存', 'error');
        }
      }
    },
    [arenaTheme, assertCurrentSessionAction, authMode, captureSessionAction, isCurrentSessionAction,
      lobbyState.prepRoom, patchUserProfile, profile?.preferredArena, pushToast, requestLobbyChange],
  );

  const setActiveTab = useCallback((tab: BottomNavTab) => {
    setRedemptionOpen(false);
    setActiveTabState(tab);
  }, []);

  const openRedemption = useCallback((origin: 'lobby' | 'profile') => {
    setRedemptionOriginTab(origin);
    setRedemptionOpen(true);
  }, []);

  const closeRedemption = useCallback(() => {
    setRedemptionOpen(false);
    setActiveTabState(redemptionOriginTab);
  }, [redemptionOriginTab]);

  const recordPendingVerifyOrder = useCallback((order: RedeemOrder) => {
    setPendingVerifyOrders((prev) => [
      order,
      ...prev.filter((o) => o.idempotencyKey !== order.idempotencyKey),
    ]);
  }, []);

  const reconcileConfirmedOrders = useCallback((serverOrders: readonly RedeemOrder[]) => {
    const serverKeys = new Set(serverOrders.map((o) => o.idempotencyKey));
    setPendingVerifyOrders((prev) =>
      prev.filter(
        (p) =>
          !serverKeys.has(p.idempotencyKey) &&
          ![...serverKeys].some((k) => k.endsWith(`:${p.idempotencyKey}`)),
      ),
    );
  }, []);

  const enterModePrepRoom = useCallback(
    async (mode: DurationMode, preferredSubject?: SubjectId) => {
      setRedemptionOpen(false);
      setActiveTabState('lobby');

      if (authMode === 'offline_practice') {
        const subject: SubjectId =
          preferredSubject ?? lobbyState.selfPrefs?.subject ?? 'english';
        const selfUser = profile ?? makeOfflineProfile(arenaTheme);
        const offlineRoom: PrepRoomState = {
          roomCode: 'OFFLINE1',
          durationMode: mode,
          queueType: 'solo',
          sharedSubject: subject,
          hostUserId: selfUser.userId,
          status: 'idle',
          plannedTotalSeconds: PLANNED_SECONDS_BY_MODE[mode],
          members: [
            {
              userId: selfUser.userId,
              nickname: selfUser.nickname,
              isHost: true,
              ready: true,
              tacticianId: selfUser.preferredTacticianId,
              avatarFrameId: null,
              boardPlaqueId: null,
            },
          ],
        };
        const selfPrefs: MemberPrefsView = {
          subject,
          learningStartSelections: selfUser.learningStartSelections,
          preferredArena: arenaTheme,
          preferredTacticianId: selfUser.preferredTacticianId,
          displaySettings: selfUser.displaySettings,
        };
        setLobbyState({
          prepRoom: offlineRoom,
          acceptPrompt: null,
          match: null,
          selfPrefs,
        });
        setViewingPrepRoom(true);
        return;
      }

      if (lobbyState.prepRoom) {
        const isHost = lobbyState.prepRoom.hostUserId === profile?.userId;
        if (
          isHost &&
          lobbyState.prepRoom.status === 'idle' &&
          (lobbyState.prepRoom.durationMode !== mode || preferredSubject !== undefined)
        ) {
          const next = await requestLobbyChange(() => httpClient.updateLobbySettings({
            durationMode: mode,
            ...(preferredSubject && lobbyState.prepRoom?.queueType === 'ranked'
              ? { sharedSubject: preferredSubject }
              : {}),
          }));
          if (preferredSubject && next.prepRoom?.queueType !== 'ranked') {
            await requestLobbyChange(() => httpClient.updateMemberPrefs({ subject: preferredSubject }));
          }
        }
        setViewingPrepRoom(true);
        return;
      }

      await requestLobbyChange(() => httpClient.enterMode({
        durationMode: mode,
        ...(preferredSubject ? { sharedSubject: preferredSubject } : {}),
      }));
      setViewingPrepRoom(true);
    },
    [arenaTheme, authMode, lobbyState.prepRoom, lobbyState.selfPrefs?.subject, profile, requestLobbyChange],
  );

  const joinRoomByCode = useCallback(
    async (roomCode: string) => {
      if (authMode === 'offline_practice') {
        pushToast('登录后可用房间码', 'warning');
        return;
      }
      const next = await requestLobbyChange(() => httpClient.joinByCode(roomCode));
      setRedemptionOpen(false);
      setActiveTabState('lobby');
      setViewingPrepRoom(true);
      pushToast(`已加入备战房 ${next.prepRoom?.roomCode ?? roomCode.toUpperCase()}`, 'success');
    },
    [authMode, pushToast, requestLobbyChange],
  );

  const updateRoomSettings = useCallback(
    async (patch: {
      durationMode?: DurationMode;
      queueType?: QueueType;
      sharedSubject?: SubjectId;
    }) => {
      if (authMode === 'offline_practice') {
        if (patch.queueType && patch.queueType !== 'solo') {
          pushToast('登录后可联机', 'info');
          return;
        }
        setLobbyState((prev) => {
          if (!prev.prepRoom) return prev;
          const nextMode = patch.durationMode ?? prev.prepRoom.durationMode;
          const nextSubj = patch.sharedSubject ?? prev.prepRoom.sharedSubject;
          return {
            ...prev,
            prepRoom: {
              ...prev.prepRoom,
              durationMode: nextMode,
              sharedSubject: nextSubj,
              plannedTotalSeconds: PLANNED_SECONDS_BY_MODE[nextMode],
            },
            selfPrefs: prev.selfPrefs ? { ...prev.selfPrefs, subject: nextSubj } : prev.selfPrefs,
          };
        });
        return;
      }
      await requestLobbyChange(() => httpClient.updateLobbySettings(patch));
    },
    [authMode, pushToast, requestLobbyChange],
  );

  const updateSelfRoomPrefs = useCallback(
    async (patch: Parameters<AppStoreValue['updateSelfRoomPrefs']>[0]) => {
      if (authMode === 'offline_practice') {
        const { ready: _ready, subject: _subject, displaySettings, ...sharedPrefs } = patch;
        if (Object.keys(sharedPrefs).length > 0 || displaySettings) {
          await patchUserProfile({
            ...sharedPrefs,
            ...(displaySettings ? { displaySettings: { fullscreen: displaySettings.fullscreen, orientation: 'landscape' } } : {}),
          });
        }
        setLobbyState((prev) => ({
          ...prev,
          selfPrefs: prev.selfPrefs
            ? {
                ...prev.selfPrefs,
                ...(patch.subject ? { subject: patch.subject } : {}),
                ...(patch.preferredArena ? { preferredArena: patch.preferredArena } : {}),
                ...(patch.displaySettings ? { displaySettings: patch.displaySettings } : {}),
              }
            : prev.selfPrefs,
        }));
        return;
      }
      const { displaySettings, ...restPatch } = patch;
      await requestLobbyChange(() => httpClient.updateMemberPrefs({
        ...restPatch,
        ...(displaySettings
          ? {
              displaySettings: {
                fullscreen: displaySettings.fullscreen,
                orientation: 'landscape',
              },
            }
          : {}),
      }), patch.learningStartSelections !== undefined || patch.preferredArena !== undefined ||
        patch.preferredTacticianId !== undefined || displaySettings !== undefined);
    },
    [authMode, patchUserProfile, requestLobbyChange],
  );

  const startMatchOrQueue = useCallback(async () => {
    if (authMode === 'offline_practice') {
      const mode = lobbyState.prepRoom?.durationMode ?? 'standard';
      const subject = lobbyState.selfPrefs?.subject ?? 'english';
      await cleanupActiveMatchRuntime();
      setIsOfflineSandboxMatch(true);
      const controller = new OfflinePracticeMatchController({
        mode,
        subject,
        nickname: profile?.nickname ?? '离线星港领航员',
        learningStartSelections:
          lobbyState.selfPrefs?.learningStartSelections ?? profile?.learningStartSelections,
        listeners: {
          onSnapshot: (snap) => {
            setMatchSnapshot({
              ...snap,
              seats: snap.seats.map((seat) => ({ ...seat, tacticianId: seat.seatId === snap.seatId ? preferredTacticianId : DEFAULT_TACTICIAN_ID })),
            });
            if (snap.summary) setMatchSummary(snap.summary);
          },
          onBattle: (payload) => {
            latestBattlePayloadRef.current = payload;
          },
          onSummary: (sum) => {
            setMatchSummary(sum);
          },
        },
      });
      offlineMatchRef.current = controller;
      await controller.start();
      return;
    }

    try {
      const next = await requestLobbyChange(() => httpClient.startLobby());
      if (next.match?.roomId) {
        await joinOnlineMatchRoom(next.match.roomId);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SESSION_SUPERSEDED') return;
      pushToast(err instanceof Error ? err.message : '发起对局失败', 'error');
    }
  }, [
    authMode,
    cleanupActiveMatchRuntime,
    joinOnlineMatchRoom,
    lobbyState.prepRoom?.durationMode,
    lobbyState.selfPrefs?.learningStartSelections,
    lobbyState.selfPrefs?.subject,
    preferredTacticianId,
    profile?.learningStartSelections,
    profile?.nickname,
    pushToast,
    requestLobbyChange,
  ]);

  const cancelMatchQueue = useCallback(async () => {
    if (authMode === 'offline_practice') return;
    try {
      await requestLobbyChange(() => httpClient.cancelQueue());
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SESSION_SUPERSEDED') return;
      pushToast(err instanceof Error ? err.message : '取消匹配失败', 'error');
    }
  }, [authMode, pushToast, requestLobbyChange]);

  const leavePrepRoom = useCallback(async () => {
    if (authMode === 'offline_practice') {
      setLobbyState(EMPTY_LOBBY_STATE);
      setViewingPrepRoom(false);
      return;
    }
    try {
      await requestLobbyChange(() => httpClient.leaveLobby());
      setViewingPrepRoom(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SESSION_SUPERSEDED') return;
      pushToast(err instanceof Error ? err.message : '退出备战房失败', 'error');
    }
  }, [authMode, pushToast, requestLobbyChange]);

  const respondMatchAccept = useCallback(
    async (ticketId: string, accept: boolean) => {
      try {
        const next = await requestLobbyChange(() => httpClient.acceptMatch(ticketId, accept));
        if (next.match?.roomId) {
          await joinOnlineMatchRoom(next.match.roomId);
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.code === 'SESSION_SUPERSEDED') return;
        pushToast(err instanceof Error ? err.message : '提交匹配确认失败', 'error');
      }
    },
    [joinOnlineMatchRoom, pushToast, requestLobbyChange],
  );

  const scoutMatchSeat = useCallback((seatId: string | null) => {
    const snap = matchSnapshotRef.current;
    const stage = stageRef.current;
    if (!snap || !stage) return;
    if (!seatId || seatId === snap.seatId) {
      setScoutedSeatId(null);
      stage.returnHome();
      return;
    }
    setScoutedSeatId(seatId);
    const sIdx = toStageSeatIndex(
      seatId,
      snap.seatId,
      snap.seats.map((s) => s.seatId),
    );
    stage.scoutSeat(sIdx);
  }, []);

  const returnFromSummaryToPrep = useCallback(async () => {
    const action = captureSessionAction();
    const finishedMode = matchSnapshotRef.current?.mode ?? 'standard';
    await cleanupActiveMatchRuntime();
    assertCurrentSessionAction(action);
    setRedemptionOpen(false);
    setActiveTabState('lobby');

    if (authMode === 'offline_practice') {
      await enterModePrepRoom(finishedMode);
      return;
    }

    try {
      await requestLobbyChange(() => httpClient.returnToPrep());
      setViewingPrepRoom(true);
    } catch {
      assertCurrentSessionAction(action);
      await requestLobbyChange(() => httpClient.enterMode({ durationMode: finishedMode }));
      setViewingPrepRoom(true);
    }
    void refreshMeStandingsAndBalanceOnly();
  }, [assertCurrentSessionAction, authMode, captureSessionAction, cleanupActiveMatchRuntime, enterModePrepRoom, requestLobbyChange]);

  const refreshMeStandingsAndBalanceOnly = async () => {
    if (authMode !== 'authenticated') return;
    const action = captureSessionAction();
    const profileVersion = profileRequestVersionRef.current;
    try {
      const me = await httpClient.getMe();
      if (!isCurrentSessionAction(action)) return;
      if (profileVersion === profileRequestVersionRef.current) setProfile(me.profile);
      setRewardPointsBalance(me.rewardPointsBalance);
      setStandings(me.standings);
    } catch {
    }
  };

  const exitMatchToLobby = useCallback(async () => {
    const action = captureSessionAction();
    await cleanupActiveMatchRuntime();
    assertCurrentSessionAction(action);
    setRedemptionOpen(false);
    setActiveTabState('lobby');
    setViewingPrepRoom(false);
    if (authMode === 'authenticated') {
      await httpClient.returnToPrep().catch(() => undefined);
      assertCurrentSessionAction(action);
      await requestLobbyChange(() => httpClient.leaveLobby()).catch(() => undefined);
      assertCurrentSessionAction(action);
      setLobbyState(EMPTY_LOBBY_STATE);
      await refreshMeStandingsAndBalanceOnly();
    } else if (authMode === 'offline_practice') {
      setLobbyState(EMPTY_LOBBY_STATE);
    }
  }, [assertCurrentSessionAction, authMode, captureSessionAction, cleanupActiveMatchRuntime, requestLobbyChange]);

  const openOnboarding = useCallback(
    (mode: OnboardingMode | 'learning_start' = 'choice') => {
      if (mode === 'learning_start') {
        openLearningStartEditor();
        return;
      }
      setOnboardingInitialMode(mode);
      setOnboardingOpen(true);
    },
    [openLearningStartEditor],
  );

  const enterGameFromStartScreen = useCallback(() => {
    setEntryGatePassed(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    setCustomStageOverride(false);
  }, []);

  const value: AppStoreValue = {
    authMode,
    entryGatePassed,
    enterGameFromStartScreen,
    profile,
    rewardPointsBalance,
    standings,
    currentSeasonTerm,
    dataLoading,
    supersededBanner,
    dismissSupersededBanner: () => setSupersededBanner(null),

    toasts,
    pushToast,
    dismissToast,

    activeTab,
    setActiveTab,
    viewingPrepRoom,
    setViewingPrepRoom,
    redemptionOpen,
    redemptionOriginTab,
    openRedemption,
    closeRedemption,
    pendingVerifyOrders,
    recordPendingVerifyOrder,
    reconcileConfirmedOrders,

    onboardingOpen,
    onboardingInitialMode,
    openOnboarding,
    closeOnboarding,

    settingsModalOpen: settingsTab !== null,
    settingsInitialTab: settingsTab ?? 'match',
    openSettings,
    closeSettings,
    openLearningStartEditor,
    shopDockPosition,
    shopCollapsed,
    setShopDockPosition,
    setShopCollapsed,
    preferredTacticianId,
    setPreferredTacticianId,

    login,
    registerAndLogin,
    enterOfflinePractice,
    logout,
    refreshMeAndLobby,
    patchUserProfile,

    lobbyState,
    enterModePrepRoom,
    joinRoomByCode,
    updateRoomSettings,
    updateSelfRoomPrefs,
    startMatchOrQueue,
    cancelMatchQueue,
    leavePrepRoom,
    respondMatchAccept,

    inActiveMatch: Boolean(matchSnapshot),
    isOfflineSandboxMatch,
    matchSnapshot,
    matchSummary,
    matchError,
    matchConnectionState,
    matchActionPending,
    combatTelemetry,
    scoutedSeatId,
    inspectedUnitId,
    inspectedScreenPos,
    draggingUnitId,
    overSellDropzone,
    sendMatchCommand,
    sendMatchLearningSubmit,
    sendMatchLearningAdvance,
    skipOfflinePhaseWait,
    scoutMatchSeat,
    clearInspectedUnit: () => setInspectedUnitId(null),
    setInspectedUnitManual: (id) => setInspectedUnitId(id),
    returnFromSummaryToPrep,
    exitMatchToLobby,

    audioBus,
    arenaTheme,
    setArenaThemeLive,
    registerStageEngine,
    getStageEngine,
    setExternalLearningOverlay,
    setCustomStageOverride,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used inside <AppStoreProvider>');
  }
  return ctx;
}
