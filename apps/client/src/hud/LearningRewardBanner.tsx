import React, { useEffect, useRef, useState } from 'react';
import type { MatchRoomSnapshot } from '../api/matchSocket.js';

interface RewardToastState {
  readonly key: string;
  readonly nodeNumber: number;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly grantedGold: number;
  readonly orbSplits: readonly number[];
  readonly carryOutCents: number;
}

export function LearningRewardBanner({
  snapshot,
}: {
  readonly snapshot: MatchRoomSnapshot | null;
}): React.JSX.Element | null {
  const [banner, setBanner] = useState<RewardToastState | null>(null);
  const shownKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      shownKeyRef.current = null;
      setBanner(null);
      return;
    }
    const settlement = snapshot.resourceSettlement;
    if (!settlement) return;

    const settledHere =
      snapshot.phase === 'resource' ||
      (snapshot.phase === 'learning' && Boolean(snapshot.learning?.complete)) ||
      (snapshot.phase === 'strategy' && settlement.nodeIndex === snapshot.nodeIndex);
    if (!settledHere) return;

    const key = `${snapshot.matchId}:node:${settlement.nodeIndex}`;
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;

    const lrn = snapshot.learning;
    const feedbackValues = lrn ? Object.values(lrn.feedback) : [];
    const totalCount =
      lrn?.totalQuestionsCount ??
      (lrn && lrn.submittedQuestionIds.length > 0 ? lrn.submittedQuestionIds.length : feedbackValues.length);
    const correctCount =
      lrn?.correctCount ?? feedbackValues.filter((item) => Boolean(item?.isCorrect)).length;

    setBanner({
      key,
      nodeNumber: settlement.nodeIndex + 1,
      correctCount,
      totalCount,
      grantedGold: settlement.grantedIntegerGold,
      orbSplits: settlement.orbSplits,
      carryOutCents: settlement.carryOutCents,
    });

    const timer = window.setTimeout(() => {
      setBanner((current) => (current?.key === key ? null : current));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  if (!banner) return null;

  const pct = banner.totalCount > 0 ? Math.round((banner.correctCount / banner.totalCount) * 100) : 100;
  const perfect = banner.totalCount > 0 && banner.correctCount === banner.totalCount;
  const ringR = 20;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - Math.max(0, Math.min(1, pct / 100)));

  return (
    <div
      className="sf-reward-toast-wrap"
      role="status"
      aria-live="polite"
      data-testid="learning-reward-banner"
    >
      <style>{`
        @keyframes sfRewardDropIn {
          0% { opacity: 0; transform: translate3d(-50%, -18px, 0) scale(0.94); }
          14% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
          86% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(-50%, -10px, 0) scale(0.97); }
        }
        .sf-reward-toast-wrap {
          position: fixed;
          top: 64px;
          left: 50%;
          z-index: 46;
          pointer-events: none;
          animation: sfRewardDropIn 3000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .sf-reward-toast {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 18px 10px 12px;
          border-radius: 16px;
          border: 1.5px solid rgba(242, 201, 125, 0.72);
          background: linear-gradient(165deg, rgba(20, 32, 58, 0.94) 0%, rgba(10, 17, 34, 0.97) 100%);
          box-shadow: inset 0 1px 0 rgba(255, 240, 196, 0.32), 0 14px 36px rgba(3, 8, 20, 0.62), 0 0 24px rgba(242, 201, 125, 0.24);
          color: #f8fafc;
        }
        .sf-reward-ring {
          position: relative;
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sf-reward-ring svg {
          width: 48px;
          height: 48px;
          transform: rotate(-90deg);
        }
        .sf-reward-ring__text {
          position: absolute;
          font-size: 12px;
          font-weight: 800;
          color: #fff3c4;
          font-variant-numeric: tabular-nums;
        }
        .sf-reward-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sf-reward-head {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .sf-reward-perfect {
          padding: 1px 7px;
          border-radius: 999px;
          background: linear-gradient(135deg, #fff0c4, #f59e0b);
          color: #1c1306;
          font-size: 11px;
          font-weight: 900;
        }
        .sf-reward-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .sf-reward-chip--gold {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(242, 201, 125, 0.18);
          border: 1px solid rgba(242, 201, 125, 0.56);
          color: #fff0c4;
        }
        .sf-reward-chip--charge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(79, 209, 255, 0.14);
          border: 1px solid rgba(79, 209, 255, 0.48);
          color: #a5f3fc;
        }
      `}</style>
      <div className="sf-reward-toast">
        <div className="sf-reward-ring" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={ringR} fill="none" stroke="rgba(148, 179, 224, 0.24)" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r={ringR}
              fill="none"
              stroke={perfect ? '#f6c96a' : '#34d399'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={ringC}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <span className="sf-reward-ring__text">
            {banner.totalCount > 0 ? `${banner.correctCount}/${banner.totalCount}` : '完成'}
          </span>
        </div>

        <div className="sf-reward-info">
          <div className="sf-reward-head">
            <span>
              学习节点 {banner.nodeNumber} ·{' '}
              {banner.totalCount > 0
                ? `答对 ${banner.correctCount} / ${banner.totalCount} 题`
                : '本节学习已完成'}
            </span>
            {perfect ? <span className="sf-reward-perfect">全对</span> : null}
          </div>
          <div className="sf-reward-chips">
            <span className="sf-reward-chip--gold">
              +{banner.grantedGold} 金币
              {banner.orbSplits.length > 0 ? `（${banner.orbSplits.length} 枚法球落入棋盘）` : ''}
            </span>
            <span className="sf-reward-chip--charge">科研充能 {banner.carryOutCents}/100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
