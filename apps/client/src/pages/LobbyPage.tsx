import React, { useEffect, useMemo, useState } from 'react';
import {
  MODE_BUDGETS,
  type DurationMode,
  type ModeStandingSummary,
  type SubjectId,
} from '@pkg/contracts';
import { StatusValueText } from '../components/StatusValueText.js';
import { TacticianPortrait } from '../components/UnitPortrait.js';
import { useAppStore } from '../store/appStore.js';
import {
  formatPointsBalanceDisplay,
  formatStandingBadgeText,
} from '../utils/antiFakeZero.js';
import './lobbyPrep.css';

interface ModeCardMeta {
  readonly mode: DurationMode;
  readonly title: string;
  readonly minutes: number;
  readonly recommended?: boolean;
}

const MODE_CARDS: readonly ModeCardMeta[] = [
  {
    mode: 'quick',
    title: '超快',
    minutes: 15,
  },
  {
    mode: 'standard',
    title: '标准',
    minutes: 30,
    recommended: true,
  },
  {
    mode: 'deep',
    title: '深度',
    minutes: 60,
  },
];

const SUBJECT_OPTIONS: readonly { readonly id: SubjectId; readonly label: string }[] = [
  { id: 'english', label: '英语' },
  { id: 'math', label: '数学' },
];

function ModeEmblemSvg({ mode, size = 46 }: { readonly mode: DurationMode; readonly size?: number }): React.JSX.Element {
  if (mode === 'quick') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M27 6L12 26H23L20 42L36 21H25L27 6Z"
          fill="rgba(79,209,255,0.22)"
          stroke="#4fd1ff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9 17L16 14M39 31L32 34"
          stroke="#a5f3fc"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (mode === 'standard') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <polygon
          points="24,5 39,14 39,34 24,43 9,34 9,14"
          fill="rgba(242,201,125,0.16)"
          stroke="#f2c97d"
          strokeWidth="2"
        />
        <path
          d="M17 31L31 17M25 17H31V23M31 31L17 17"
          stroke="#fff0c4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="3" fill="#4fd1ff" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M9 32L13 15L20 22L24 10L28 22L35 15L39 32H9Z"
        fill="rgba(192,132,252,0.22)"
        stroke="#c084fc"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="11" y="34" width="26" height="4" rx="2" fill="#f2c97d" />
      <circle cx="24" cy="24" r="2.6" fill="#fff0c4" />
    </svg>
  );
}

function NavIconLearning(): React.JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5C4 5.67 4.67 5 5.5 5H11C11.55 5 12 5.45 12 6V19C12 18.45 11.55 18 11 18H5.5C4.67 18 4 17.33 4 16.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M20 6.5C20 5.67 19.33 5 18.5 5H13C12.45 5 12 5.45 12 6V19C12 18.45 12.45 18 13 18H18.5C19.33 18 20 17.33 20 16.5V6.5Z"
        stroke="#4fd1ff"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function NavIconCollection(): React.JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon
        points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <polygon points="12,7.5 16,12 12,16.5 8,12" stroke="#4fd1ff" strokeWidth="1.5" />
    </svg>
  );
}

function NavIconRanking(): React.JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 5H16V10C16 12.21 14.21 14 12 14C9.79 14 8 12.21 8 10V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8 7H5V9.5C5 10.88 6.12 12 7.5 12H8M16 7H19V9.5C19 10.88 17.88 12 16.5 12H16" stroke="#4fd1ff" strokeWidth="1.5" />
      <path d="M12 14V18M8.5 19H15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function NavIconMall(): React.JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9V20M4 13H20" stroke="#4fd1ff" strokeWidth="1.5" />
      <path d="M12 9C12 6.5 9.5 5 8 6.5C6.5 8 9.5 9 12 9ZM12 9C12 6.5 14.5 5 16 6.5C17.5 8 14.5 9 12 9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function NavIconProfile(): React.JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19.5C6.4 16.2 8.9 14.5 12 14.5C15.1 14.5 17.6 16.2 18.5 19.5" stroke="#4fd1ff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function pickHighestStanding(standings: readonly ModeStandingSummary[]): ModeStandingSummary | null {
  const ranked = standings.filter((s) => s.status === 'ranked' && s.rankScore !== null);
  if (ranked.length === 0) return standings[0] ?? null;
  return ranked.reduce((best, cur) =>
    (cur.rankScore ?? 0) > (best.rankScore ?? 0) ? cur : best,
  );
}

export function LobbyPage(): React.JSX.Element {
  const {
    authMode,
    profile,
    preferredTacticianId,
    rewardPointsBalance,
    standings,
    dataLoading,
    lobbyState,
    enterModePrepRoom,
    joinRoomByCode,
    setActiveTab,
    openRedemption,
    openSettings,
    setViewingPrepRoom,
    pushToast,
  } = useAppStore();

  const [selectedMode, setSelectedMode] = useState<DurationMode>(
    () => lobbyState.prepRoom?.durationMode ?? 'standard',
  );
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>(
    () => lobbyState.selfPrefs?.subject ?? lobbyState.prepRoom?.sharedSubject ?? 'english',
  );
  const [modeOverlayOpen, setModeOverlayOpen] = useState<boolean>(false);
  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [enteringMode, setEnteringMode] = useState<DurationMode | null>(null);
  const [joiningCode, setJoiningCode] = useState<boolean>(false);

  useEffect(() => {
    if (lobbyState.prepRoom?.durationMode) {
      setSelectedMode(lobbyState.prepRoom.durationMode);
    }
  }, [lobbyState.prepRoom?.durationMode]);

  useEffect(() => {
    if (!modeOverlayOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModeOverlayOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modeOverlayOpen]);

  const isOffline = authMode === 'offline_practice';
  const pointsDisplay = formatPointsBalanceDisplay(rewardPointsBalance, {
    loading: dataLoading,
    offline: isOffline,
  });

  const highestStanding = useMemo(() => pickHighestStanding(standings), [standings]);
  const highestStandingDisplay = isOffline
    ? { kind: 'text' as const, text: '离线演练', muted: true }
    : formatStandingBadgeText(highestStanding, dataLoading);

  const selectedModeMeta = useMemo(
    () => MODE_CARDS.find((c) => c.mode === selectedMode) ?? MODE_CARDS[1]!,
    [selectedMode],
  );
  const selectedStanding = standings.find((s) => s.durationMode === selectedMode) ?? null;
  const selectedStandingDisplay = isOffline
    ? { kind: 'text' as const, text: '离线演练', muted: true }
    : formatStandingBadgeText(selectedStanding, dataLoading);

  const handleEnterPrepRoom = async (mode: DurationMode) => {
    if (enteringMode) return;
    setEnteringMode(mode);
    setSelectedMode(mode);
    try {
      await enterModePrepRoom(mode, selectedSubject);
      setModeOverlayOpen(false);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '进入备战房失败', 'error');
    } finally {
      setEnteringMode(null);
    }
  };

  const handleModeCardClick = (mode: DurationMode) => {
    if (selectedMode === mode) {
      void handleEnterPrepRoom(mode);
      return;
    }
    setSelectedMode(mode);
  };

  const handleJoinRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setJoiningCode(true);
    try {
      await joinRoomByCode(trimmed);
      setCodeModalOpen(false);
      setRoomCodeInput('');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '加入房间失败', 'error');
    } finally {
      setJoiningCode(false);
    }
  };

  const hasActivePrepRoom = Boolean(lobbyState.prepRoom);

  return (
    <div className="sf-lobby-viewport" data-testid="lobby-page">
      <div className="sf-lobby-vignette-left" aria-hidden="true" />
      <div className="sf-lobby-vignette-bottom" aria-hidden="true" />

      <header className="sf-lobby-topbar">
        <div className="sf-season-crest" data-testid="lobby-season-crest">
          <span className="sf-season-crest__emblem" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" stroke="#fff0c4" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="2.8" fill="#4fd1ff" />
            </svg>
          </span>
          <div className="sf-season-crest__meta">
            <span className="sf-season-crest__brand">SparkField · 灵光之野</span>
            <span className="sf-season-crest__sub">S1 · 光锥之外</span>
          </div>
        </div>

        <div className="sf-lobby-top-right">
          <button
            type="button"
            className="sf-lobby-points-btn"
            onClick={() => openRedemption('lobby')}
            data-testid="lobby-points-capsule"
            title="前往积分商城"
          >
            <span className="sf-lobby-points-gem" aria-hidden="true" />
            <strong className="sf-lobby-points-val">
              <StatusValueText value={pointsDisplay} />
            </strong>
            {!isOffline ? <span className="sf-lobby-points-unit">积分</span> : null}
          </button>

          <button
            type="button"
            className="sf-gear-btn"
            onClick={() => openSettings('display')}
            aria-label="打开设置"
            title="系统与舞台设置"
            data-testid="open-settings-btn"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 1 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14.08 20.83V21A2 2 0 1 1 10.08 21V20.91A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.18 19.73L7.12 19.79A2 2 0 1 1 4.29 16.96L4.35 16.9A1.65 1.65 0 0 0 4.68 15.08A1.65 1.65 0 0 0 3.17 14.08H3A2 2 0 1 1 3 10.08H3.09A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L4.21 7.12A2 2 0 1 1 7.04 4.29L7.1 4.35A1.65 1.65 0 0 0 8.92 4.68H9A1.65 1.65 0 0 0 10 3.17V3A2 2 0 1 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 1 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.83 10H21A2 2 0 1 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <nav className="sf-lobby-nav-rail" aria-label="主大厅功能导航" data-testid="lobby-nav-rail">
        <button
          type="button"
          className="sf-lobby-nav-item"
          onClick={() => setActiveTab('learning')}
          data-testid="dock-tab-learning"
        >
          <span className="sf-lobby-nav-icon">
            <NavIconLearning />
          </span>
          <span>学习中心</span>
        </button>

        <button
          type="button"
          className="sf-lobby-nav-item"
          onClick={() => setActiveTab('encyclopedia')}
          data-testid="dock-tab-encyclopedia"
        >
          <span className="sf-lobby-nav-icon">
            <NavIconCollection />
          </span>
          <span>藏品图鉴</span>
        </button>

        <button
          type="button"
          className="sf-lobby-nav-item"
          onClick={() => setActiveTab('ranking')}
          data-testid="dock-tab-ranking"
        >
          <span className="sf-lobby-nav-icon">
            <NavIconRanking />
          </span>
          <span>排行榜</span>
        </button>

        <button
          type="button"
          className="sf-lobby-nav-item"
          onClick={() => openRedemption('lobby')}
          data-testid="dock-tab-redemption"
        >
          <span className="sf-lobby-nav-icon">
            <NavIconMall />
          </span>
          <span>积分商城</span>
        </button>

        <button
          type="button"
          className="sf-lobby-nav-item"
          onClick={() => setActiveTab('profile')}
          data-testid="dock-tab-profile"
        >
          <span className="sf-lobby-nav-icon">
            <NavIconProfile />
          </span>
          <span>个人档案</span>
        </button>
      </nav>

      <footer className="sf-lobby-bottombar">
        <div className="sf-lobby-bottom-left">
          <button
            type="button"
            className="sf-player-badge"
            onClick={() => setActiveTab('profile')}
            data-testid="lobby-player-card"
          >
            <TacticianPortrait
              tacticianId={preferredTacticianId}
              size="sm"
              alt={profile?.nickname ?? '指挥官'}
            />
            <div className="sf-player-badge__info">
              <span className="sf-player-badge__name">
                {profile?.nickname ?? '星港领航员'}
              </span>
              <span className="sf-player-badge__rank">
                <StatusValueText value={highestStandingDisplay} />
              </span>
            </div>
          </button>

          <button
            type="button"
            className="sf-join-code-chip"
            onClick={() => setCodeModalOpen(true)}
            data-testid="open-join-code-btn"
          >
            <span aria-hidden="true">#</span>
            <span>房间码加入</span>
          </button>
        </div>

        <div className="sf-lobby-action-hub">
          <button
            type="button"
            className="sf-mode-capsule"
            onClick={() => setModeOverlayOpen(true)}
            data-testid="lobby-mode-capsule"
          >
            <span className="sf-mode-capsule__icon">
              <ModeEmblemSvg mode={selectedModeMeta.mode} size={22} />
            </span>
            <span className="sf-mode-capsule__text">
              <span className="sf-mode-capsule__title">
                <span>
                  {selectedModeMeta.title} {selectedModeMeta.minutes}分
                </span>
                <span aria-hidden="true">▾</span>
              </span>
              <span className="sf-mode-capsule__sub">
                <StatusValueText value={selectedStandingDisplay} /> ·{' '}
                {selectedSubject === 'english' ? '英语' : '数学'}
              </span>
            </span>
          </button>

          {hasActivePrepRoom ? (
            <button
              type="button"
              className="sf-start-orb-btn sf-start-orb-btn--resume"
              onClick={() => setViewingPrepRoom(true)}
              data-testid="lobby-resume-prep-btn"
            >
              <svg className="sf-start-orb__ring-outer" viewBox="0 0 130 130" fill="none" aria-hidden="true">
                <circle cx="65" cy="65" r="61" stroke="rgba(165,243,252,0.52)" strokeWidth="1.5" strokeDasharray="16 10 4 10" />
              </svg>
              <svg className="sf-start-orb__ring-inner" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle cx="60" cy="60" r="56" stroke="rgba(255,240,196,0.44)" strokeWidth="1" strokeDasharray="6 8" />
              </svg>
              <span className="sf-start-orb__sheen" aria-hidden="true" />
              <span className="sf-start-orb__label">回到房间</span>
              <span className="sf-start-orb__sub">{lobbyState.prepRoom?.roomCode}</span>
            </button>
          ) : (
            <button
              type="button"
              className="sf-start-orb-btn"
              disabled={enteringMode !== null}
              onClick={() => void handleEnterPrepRoom(selectedMode)}
              data-testid="lobby-start-game-btn"
            >
              <svg className="sf-start-orb__ring-outer" viewBox="0 0 130 130" fill="none" aria-hidden="true">
                <circle cx="65" cy="65" r="61" stroke="rgba(255,240,196,0.68)" strokeWidth="1.6" strokeDasharray="20 9 5 9" />
              </svg>
              <svg className="sf-start-orb__ring-inner" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle cx="60" cy="60" r="56" stroke="rgba(79,209,255,0.52)" strokeWidth="1.1" strokeDasharray="8 10" />
              </svg>
              <span className="sf-start-orb__sheen" aria-hidden="true" />
              <span className="sf-start-orb__label">
                {enteringMode ? '载入中' : '开始游戏'}
              </span>
              <span className="sf-start-orb__sub">
                {selectedModeMeta.title} · {selectedModeMeta.minutes}分
              </span>
            </button>
          )}
        </div>
      </footer>

      <div
        className={`sf-mode-overlay ${modeOverlayOpen ? '' : 'sf-mode-overlay--closed'}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-hidden={!modeOverlayOpen}
        aria-label="选择对局模式"
        data-testid="lobby-mode-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModeOverlayOpen(false);
        }}
      >
        <div className="sf-mode-drawer ui-corner-ornaments">
          <div className="sf-mode-drawer__head">
            <h2 className="sf-mode-drawer__title">选择模式</h2>
            <button
              type="button"
              className="sf-ghost-pill-btn"
              onClick={() => setModeOverlayOpen(false)}
              data-testid="close-mode-overlay-btn"
            >
              ✕ 关闭
            </button>
          </div>

          <div className="sf-mode-emblems-grid" aria-label="对局模式">
            {MODE_CARDS.map((card) => {
              const spec = MODE_BUDGETS.modes[card.mode];
              const standing = standings.find((s) => s.durationMode === card.mode) ?? null;
              const standingDisplay = isOffline
                ? { kind: 'text' as const, text: '离线演练', muted: true }
                : formatStandingBadgeText(standing, dataLoading);
              const isSelected = selectedMode === card.mode;
              const isCurrentRoomMode = lobbyState.prepRoom?.durationMode === card.mode;

              return (
                <button
                  key={card.mode}
                  type="button"
                  className={`sf-emblem-card sf-emblem-card--${card.mode} ${
                    isSelected ? 'sf-emblem-card--selected' : ''
                  }`.trim()}
                  disabled={enteringMode !== null}
                  onClick={() => handleModeCardClick(card.mode)}
                  onDoubleClick={() => void handleEnterPrepRoom(card.mode)}
                  data-testid={`mode-card-${card.mode}`}
                >
                  {card.recommended ? (
                    <span className="sf-emblem-ribbon">推荐排位</span>
                  ) : null}

                  <div className="sf-emblem-crest">
                    <ModeEmblemSvg mode={card.mode} size={46} />
                  </div>

                  <div className="sf-emblem-title">{card.title}</div>

                  <div className="sf-emblem-duration">
                    <strong>{card.minutes}</strong>
                    <span>分钟</span>
                  </div>

                  <div className="sf-emblem-meta">
                    {spec.learning.length} 节学习 · {spec.rounds} 场战斗
                  </div>

                  <div className="sf-emblem-footer">
                    <strong className="sf-emblem-rank" data-testid={`lobby-rank-${card.mode}`}>
                      <StatusValueText value={standingDisplay} />
                    </strong>
                    <span className="sf-emblem-enter-tag">
                      {enteringMode === card.mode
                        ? '进入中…'
                        : isCurrentRoomMode
                          ? '回到备战房'
                          : isSelected
                            ? '点击进入 ›'
                            : '选择模式'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sf-mode-drawer__footer">
            <div className="sf-prep-control-cluster">
              <span className="sf-prep-cluster-label">本局学科</span>
              <div className="sf-seg-group">
                {SUBJECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`sf-seg-btn ${selectedSubject === opt.id ? 'sf-seg-btn--active' : ''}`.trim()}
                    onClick={() => setSelectedSubject(opt.id)}
                    data-testid={`lobby-subject-${opt.id}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="sf-gold-btn"
              disabled={enteringMode !== null}
              onClick={() => void handleEnterPrepRoom(selectedMode)}
              data-testid="mode-overlay-confirm-btn"
            >
              {enteringMode
                ? '正在进入…'
                : hasActivePrepRoom
                  ? `切换并进入 ${selectedModeMeta.title} 备战房`
                  : `进入 ${selectedModeMeta.title} 备战房`}
            </button>
          </div>
        </div>
      </div>

      {codeModalOpen ? (
        <div
          className="blc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="房间码加入"
          data-testid="join-room-code-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCodeModalOpen(false);
          }}
        >
          <div className="sf-join-dialog ui-corner-ornaments">
            <div className="blc-dialog-sm__head">
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--accent-gold-bright)' }}>
                加入房间
              </h3>
              <button
                type="button"
                className="sf-ghost-pill-btn"
                style={{ minHeight: 30, padding: '0 10px' }}
                onClick={() => setCodeModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => void handleJoinRoomSubmit(e)}
              style={{ display: 'flex', gap: 10, marginTop: 16 }}
            >
              <input
                type="text"
                className="blc-input"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  fontWeight: 700,
                  background: 'rgba(9, 15, 29, 0.84)',
                  borderColor: 'rgba(242, 201, 125, 0.36)',
                }}
                placeholder="输入 8 位房间码"
                maxLength={10}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                autoFocus
                data-testid="room-code-input"
              />
              <button
                type="submit"
                className="sf-gold-btn"
                style={{ minHeight: 42, padding: '0 18px', whiteSpace: 'nowrap' }}
                disabled={joiningCode || roomCodeInput.trim().length < 4}
                data-testid="confirm-join-code-btn"
              >
                {joiningCode ? '加入中…' : '加入'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
