import React, { useState } from 'react';
import { MODE_BUDGETS, type DurationMode } from '@pkg/contracts';
import { ArenaThemeSwitcher } from '../components/PersistentStageCanvas.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { useAppStore } from '../store/appStore.js';
import {
  formatPointsBalanceDisplay,
  formatStandingBadgeText,
} from '../utils/antiFakeZero.js';

const MODE_CARDS: readonly {
  mode: DurationMode;
  title: string;
  minutes: number;
}[] = [
  {
    mode: 'quick',
    title: '超快',
    minutes: 15,
  },
  {
    mode: 'standard',
    title: '标准',
    minutes: 30,
  },
  {
    mode: 'deep',
    title: '深度',
    minutes: 60,
  },
];

export function LobbyPage(): React.JSX.Element {
  const {
    authMode,
    profile,
    rewardPointsBalance,
    standings,
    dataLoading,
    lobbyState,
    enterModePrepRoom,
    joinRoomByCode,
    openRedemption,
    setViewingPrepRoom,
    pushToast,
  } = useAppStore();

  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [enteringMode, setEnteringMode] = useState<DurationMode | null>(null);
  const [joiningCode, setJoiningCode] = useState<boolean>(false);

  const isOffline = authMode === 'offline_practice';
  const pointsDisplay = formatPointsBalanceDisplay(rewardPointsBalance, {
    loading: dataLoading,
    offline: isOffline,
  });

  const handleSelectModeCard = async (mode: DurationMode) => {
    if (enteringMode) return;
    setEnteringMode(mode);
    try {
      await enterModePrepRoom(mode);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '进入备战房失败', 'error');
    } finally {
      setEnteringMode(null);
    }
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

  return (
    <div className="blc-page-shell blc-lobby-shell" data-testid="lobby-page">
      <header className="blc-lobby-topbar">
        <div
          className="ui-frosted-panel"
          style={{
            padding: '7px 14px',
            borderRadius: 999,
            border: '1px solid rgba(240, 220, 170, 0.22)',
            background: 'rgba(13, 17, 26, 0.72)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <strong style={{ fontSize: 14.5, fontWeight: 600 }}>
            {profile?.nickname ?? '领航员'}
          </strong>
          <span
            className="blc-chip blc-chip--gold"
            style={{ borderRadius: 999, padding: '1px 8px', fontSize: 11.5 }}
          >
            S1
          </span>
        </div>

        <div className="blc-lobby-topbar__right">
          <button
            type="button"
            className="ui-frosted-panel blc-points-capsule"
            style={{
              minHeight: 38,
              padding: '5px 14px',
              borderRadius: 999,
              border: '1px solid rgba(240, 220, 170, 0.28)',
              background: 'rgba(13, 17, 26, 0.76)',
              gap: 7,
            }}
            onClick={() => openRedemption('lobby')}
            data-testid="lobby-points-capsule"
            title="积分兑换"
          >
            <span className="blc-points-capsule__icon" aria-hidden="true">
              ✦
            </span>
            <strong
              className="blc-points-capsule__val"
              style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15 }}
            >
              <StatusValueText value={pointsDisplay} />
            </strong>
          </button>

          <button
            type="button"
            className="blc-btn blc-btn--metal blc-btn--sm"
            style={{ borderRadius: 999, padding: '6px 15px' }}
            onClick={() => setCodeModalOpen(true)}
            data-testid="open-join-code-btn"
          >
            房间码
          </button>
        </div>
      </header>

      <main
        className="blc-mode-cards-grid"
        style={{ maxWidth: 960, gap: 18 }}
        aria-label="对局模式"
      >
        {MODE_CARDS.map((card) => {
          const spec = MODE_BUDGETS.modes[card.mode];
          const standing = standings.find((s) => s.durationMode === card.mode) ?? null;
          const standingDisplay = isOffline
            ? { kind: 'text' as const, text: '离线', muted: true }
            : formatStandingBadgeText(standing, dataLoading);
          const isCurrentRoomMode = lobbyState.prepRoom?.durationMode === card.mode;

          return (
            <button
              key={card.mode}
              type="button"
              className={`ui-frosted-panel blc-mode-card ${
                card.mode === 'standard' ? 'blc-mode-card--recommended' : ''
              } ${isCurrentRoomMode ? 'blc-mode-card--active-room' : ''}`.trim()}
              style={{
                padding: '24px 24px 20px',
                borderRadius: 10,
                border:
                  card.mode === 'standard'
                    ? '1px solid rgba(240, 220, 170, 0.48)'
                    : '1px solid rgba(240, 220, 170, 0.2)',
                background:
                  card.mode === 'standard'
                    ? 'linear-gradient(165deg, rgba(28, 36, 52, 0.86) 0%, rgba(14, 18, 28, 0.84) 100%)'
                    : 'rgba(14, 18, 28, 0.76)',
                minHeight: 220,
                justifyContent: 'space-between',
                gap: 16,
              }}
              disabled={enteringMode !== null}
              onClick={() => void handleSelectModeCard(card.mode)}
              data-testid={`mode-card-${card.mode}`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {card.title}
                </span>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 'clamp(34px, 3.2vw, 44px)',
                      fontWeight: 600,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--gold-light)',
                    }}
                  >
                    {card.minutes}
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>分钟</span>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {spec.learning.length} 节 · {spec.rounds} 战
                </div>
              </div>

              <div
                className="blc-mode-card__footer"
                style={{
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  width: '100%',
                }}
              >
                <strong
                  style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)' }}
                  data-testid={`lobby-rank-${card.mode}`}
                >
                  <StatusValueText value={standingDisplay} />
                </strong>
                <span className="blc-mode-card__enter" style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {enteringMode === card.mode
                    ? '进入中…'
                    : isCurrentRoomMode
                      ? '返回备战房'
                      : '进入备战房'}
                </span>
              </div>
            </button>
          );
        })}
      </main>

      <div className="blc-lobby-bottom-left">
        <ArenaThemeSwitcher compact />
        {lobbyState.prepRoom ? (
          <button
            type="button"
            className="blc-btn blc-btn--primary blc-btn--xs"
            style={{ borderRadius: 999, padding: '5px 14px' }}
            onClick={() => setViewingPrepRoom(true)}
            data-testid="lobby-resume-prep-btn"
          >
            返回房间 · {lobbyState.prepRoom.roomCode}
          </button>
        ) : null}
      </div>

      {codeModalOpen ? (
        <div
          className="blc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="房间码"
          data-testid="join-room-code-modal"
        >
          <div
            className="ui-frosted-panel blc-dialog-sm"
            style={{
              width: 'min(360px, 92vw)',
              borderRadius: 10,
              border: '1px solid rgba(240, 220, 170, 0.28)',
              background: 'rgba(14, 18, 28, 0.9)',
            }}
          >
            <div className="blc-dialog-sm__head">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>输入房间码</h3>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => setCodeModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => void handleJoinRoomSubmit(e)}
              style={{ display: 'flex', gap: 8, marginTop: 12 }}
            >
              <input
                type="text"
                className="blc-input"
                style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}
                placeholder="8 位房间码"
                maxLength={10}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                autoFocus
                data-testid="room-code-input"
              />
              <button
                type="submit"
                className="blc-btn blc-btn--primary"
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
