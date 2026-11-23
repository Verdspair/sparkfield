import React, { useEffect, useMemo, useState } from 'react';
import type { SubjectId } from '@pkg/contracts';
import {
  MatchStudyBlueprintCard,
  buildClientStudyBlueprint,
  readPrepBlueprintSeed,
} from './MatchStudyBlueprintCard.js';
import { useAppStore } from '../store/appStore.js';
import { DURATION_MODE_SHORT_LABELS, QUEUE_TYPE_LABELS } from '../utils/antiFakeZero.js';
import '../pages/lobbyPrep.css';

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAX_ACCEPT_SECONDS = 15;

export function GlobalMatchAcceptModal(): React.JSX.Element | null {
  const { authMode, inActiveMatch, profile, lobbyState, respondMatchAccept, pushToast } =
    useAppStore();
  const prompt = lobbyState.acceptPrompt;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!prompt) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, [prompt]);

  const activeSubject: SubjectId = useMemo(() => {
    if (!prompt) return 'english';
    if (prompt.queueType === 'ranked') {
      return lobbyState.prepRoom?.sharedSubject ?? 'english';
    }
    return lobbyState.selfPrefs?.subject ?? lobbyState.prepRoom?.sharedSubject ?? 'english';
  }, [lobbyState.prepRoom?.sharedSubject, lobbyState.selfPrefs?.subject, prompt]);

  const blueprint = useMemo(() => {
    if (!prompt) return null;
    const startNodeId =
      lobbyState.selfPrefs?.learningStartSelections?.[activeSubject] ??
      profile?.learningStartSelections?.[activeSubject];
    return buildClientStudyBlueprint({
      mode: prompt.durationMode,
      subject: activeSubject,
      startNodeId,
      seed: readPrepBlueprintSeed(prompt.roomCode),
    });
  }, [
    activeSubject,
    lobbyState.selfPrefs?.learningStartSelections,
    profile?.learningStartSelections,
    prompt,
  ]);

  if (authMode !== 'authenticated' || inActiveMatch || !prompt || !blueprint) {
    return null;
  }

  const remainingMs = Math.max(0, prompt.deadlineEpochMs - nowMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progressRatio = Math.min(1, remainingMs / (MAX_ACCEPT_SECONDS * 1000));
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressRatio);
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
      <div className="ui-metal-frame blc-accept-card sf-accept-card-wide">
        <span className="blc-accept-card__eyebrow">MATCH FOUND · S1 光锥之外</span>
        <h2 className="blc-accept-card__title">对局就绪</h2>
        <p className="blc-accept-card__meta">
          {DURATION_MODE_SHORT_LABELS[prompt.durationMode]} · {QUEUE_TYPE_LABELS[prompt.queueType]} ·{' '}
          {activeSubject === 'english' ? '英语' : '数学'}
        </p>

        <div className="blc-accept-card__ring">
          <svg
            className="blc-accept-card__svg"
            viewBox="0 0 112 112"
            aria-hidden="true"
          >
            <circle
              cx="56"
              cy="56"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(137,163,184, 0.2)"
              strokeWidth="4"
            />
            <circle
              cx="56"
              cy="56"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--accent-gold)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 56 56)"
            />
          </svg>
          <div className="blc-accept-card__countdown" data-testid="accept-countdown">
            {String(remainingSec).padStart(2, '0')}s
          </div>
          <div className="blc-accept-card__sub">确认倒计时</div>
        </div>

        <MatchStudyBlueprintCard blueprint={blueprint} locked emphasizing compact />

        <div className="blc-accept-card__progress" data-testid="accept-count-summary">
          已确认 <strong>{prompt.acceptedCount}</strong> /{' '}
          <strong>{prompt.totalCandidateHumans}</strong> 位指挥官
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
                接受对局
              </button>
            </>
          ) : (
            <div className="blc-chip blc-chip--gold blc-accept-card__decided">
              {prompt.selfDecision === 'accepted' ? '已确认，等待其他指挥官就位' : '已拒绝本场对局'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
