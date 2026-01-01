import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore.js';
import { DURATION_MODE_SHORT_LABELS, QUEUE_TYPE_LABELS } from '../utils/antiFakeZero.js';

export function GlobalMatchAcceptModal(): React.JSX.Element | null {
  const { authMode, inActiveMatch, lobbyState, respondMatchAccept, pushToast } = useAppStore();
  const prompt = lobbyState.acceptPrompt;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!prompt) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [prompt]);

  if (authMode !== 'authenticated' || inActiveMatch || !prompt) {
    return null;
  }

  const remainingSec = Math.max(0, Math.ceil((prompt.deadlineEpochMs - nowMs) / 1000));
  const decided = prompt.selfDecision !== 'pending';

  const handleDecision = async (accept: boolean) => {
    if (decided || submitting) return;
    setSubmitting(true);
    try {
      await respondMatchAccept(prompt.ticketId, accept);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '提交确认失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="对局确认"
      data-testid="global-match-accept-modal"
    >
      <div
        className="ui-frosted-panel blc-accept-card"
        style={{
          width: 'min(360px, 92vw)',
          padding: '28px 24px',
          border: '1px solid rgba(240, 220, 170, 0.34)',
          borderRadius: 10,
        }}
      >
        <h2 className="blc-accept-card__title" style={{ fontSize: 20, fontWeight: 600 }}>
          对局就绪
        </h2>
        <p className="blc-accept-card__meta">
          {DURATION_MODE_SHORT_LABELS[prompt.durationMode]} · {QUEUE_TYPE_LABELS[prompt.queueType]}
        </p>

        <div className="blc-accept-card__ring">
          <div className="blc-accept-card__countdown" data-testid="accept-countdown">
            {String(remainingSec).padStart(2, '0')}s
          </div>
          <div className="blc-accept-card__sub">倒计时</div>
        </div>

        <div
          className="blc-accept-card__progress"
          style={{ fontSize: 13, color: 'var(--text-secondary)' }}
          data-testid="accept-count-summary"
        >
          已确认 <strong>{prompt.acceptedCount}</strong> / <strong>{prompt.totalCandidateHumans}</strong>
        </div>

        <div className="blc-accept-card__actions">
          {prompt.selfDecision === 'pending' ? (
            <>
              <button
                type="button"
                className="blc-btn blc-btn--ghost"
                disabled={submitting}
                onClick={() => void handleDecision(false)}
                data-testid="decline-match-btn"
              >
                拒绝
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--primary"
                disabled={submitting}
                onClick={() => void handleDecision(true)}
                data-testid="accept-match-btn"
              >
                接受
              </button>
            </>
          ) : (
            <div className="blc-chip blc-chip--gold" style={{ padding: '8px 16px', fontSize: 13 }}>
              {prompt.selfDecision === 'accepted' ? '已确认，等待开局' : '已拒绝'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
