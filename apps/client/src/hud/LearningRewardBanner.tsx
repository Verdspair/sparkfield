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
  }, [snapshot]);

  useEffect(() => {
    if (!banner) return;
    const activeKey = banner.key;
    const timer = window.setTimeout(() => {
      setBanner((current) => (current?.key === activeKey ? null : current));
    }, 3900);
    return () => window.clearTimeout(timer);
  }, [banner?.key]);

  if (!banner) return null;

  const pct = banner.totalCount > 0 ? Math.round((banner.correctCount / banner.totalCount) * 100) : 100;
  const perfect = banner.totalCount > 0 && banner.correctCount === banner.totalCount;
  const ringR = 28;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - Math.max(0, Math.min(1, pct / 100)));
  const orbTotal = banner.orbSplits.length;

  return (
    <div
      className="sf-reward-stage"
      role="status"
      aria-live="polite"
      data-testid="learning-reward-banner"
    >
      <style>{`
        @keyframes sfRewardBurstIn {
          0% { opacity: 0; transform: translate3d(-50%, -24px, 0) scale(0.84); }
          10% { opacity: 1; transform: translate3d(-50%, 4px, 0) scale(1.03); }
          16% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
          86% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(-50%, -16px, 0) scale(0.95); }
        }
        @keyframes sfRewardGlowWave {
          0% { opacity: 0; transform: translateX(-50%) scaleX(0.4); }
          18% { opacity: 0.9; transform: translateX(-50%) scaleX(1.1); }
          55% { opacity: 0.35; transform: translateX(-50%) scaleX(1.2); }
          100% { opacity: 0; transform: translateX(-50%) scaleX(1.3); }
        }
        @keyframes sfRewardRingDraw {
          0% { stroke-dashoffset: var(--ring-c); }
          100% { stroke-dashoffset: var(--ring-offset); }
        }
        @keyframes sfRewardSheen {
          0% { transform: translateX(-140%) skewX(-22deg); }
          45% { transform: translateX(260%) skewX(-22deg); }
          100% { transform: translateX(260%) skewX(-22deg); }
        }
        @keyframes sfRewardChipPop {
          0% { opacity: 0; transform: translateY(10px) scale(0.88); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sf-reward-stage {
          position: fixed;
          top: 13%;
          left: 50%;
          z-index: 54;
          pointer-events: none;
          animation: sfRewardBurstIn 3900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .sf-reward-aura {
          position: absolute;
          top: -28px;
          left: 50%;
          width: 680px;
          height: 170px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(246, 201, 106, 0.38) 0%, rgba(56, 189, 248, 0.16) 45%, rgba(10, 17, 34, 0) 74%);
          animation: sfRewardGlowWave 2400ms ease-out forwards;
        }
        .sf-reward-card {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 480px;
          max-width: 600px;
          padding: 16px 24px 16px 18px;
          border-radius: 20px;
          border: 2px solid rgba(246, 204, 118, 0.9);
          background: linear-gradient(160deg, rgba(24, 39, 72, 0.96) 0%, rgba(10, 18, 36, 0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 245, 212, 0.55),
            inset 0 -1px 0 rgba(79, 209, 255, 0.3),
            0 20px 54px rgba(2, 6, 18, 0.78),
            0 0 38px rgba(246, 201, 106, 0.34);
          color: #f8fafc;
        }
        .sf-reward-card::before {
          content: '';
          position: absolute;
          inset: 0;
          width: 44%;
          background: linear-gradient(90deg, rgba(255, 244, 204, 0) 0%, rgba(255, 244, 204, 0.24) 50%, rgba(255, 244, 204, 0) 100%);
          animation: sfRewardSheen 2800ms ease-in-out infinite;
        }
        .sf-reward-ring {
          position: relative;
          width: 68px;
          height: 68px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sf-reward-ring svg {
          width: 68px;
          height: 68px;
          transform: rotate(-90deg);
          filter: drop-shadow(0 0 10px rgba(246, 201, 106, 0.45));
        }
        .sf-reward-ring__prog {
          animation: sfRewardRingDraw 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .sf-reward-ring__text {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.05;
          font-variant-numeric: tabular-nums;
        }
        .sf-reward-ring__ratio {
          font-size: 17px;
          font-weight: 900;
          color: #fff4cc;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
        }
        .sf-reward-ring__sub {
          font-size: 10px;
          font-weight: 700;
          color: #93c5fd;
          margin-top: 2px;
        }
        .sf-reward-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .sf-reward-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #93c5fd;
        }
        .sf-reward-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .sf-reward-title {
          font-size: 21px;
          font-weight: 900;
          letter-spacing: 0.02em;
          background: linear-gradient(180deg, #fff9e6 0%, #f6c96a 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55));
        }
        .sf-reward-perfect {
          padding: 3px 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, #fff5cf 0%, #f59e0b 100%);
          color: #1f1404;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 0 14px rgba(246, 201, 106, 0.55);
        }
        .sf-reward-loot-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          animation: sfRewardChipPop 420ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
        }
        .sf-reward-pill--gold {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 13px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(246, 201, 106, 0.28) 0%, rgba(217, 119, 6, 0.24) 100%);
          border: 1.5px solid rgba(251, 211, 128, 0.85);
          color: #fff6d6;
          font-size: 14px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          box-shadow: 0 0 18px rgba(246, 201, 106, 0.28);
        }
        .sf-reward-pill--orb {
          font-size: 12px;
          font-weight: 700;
          color: #fde68a;
        }
        .sf-reward-pill--charge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.16);
          border: 1.5px solid rgba(103, 232, 249, 0.62);
          color: #cffafe;
          font-size: 13px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .sf-reward-bar {
          width: 48px;
          height: 6px;
          border-radius: 999px;
          background: rgba(148, 179, 224, 0.25);
          overflow: hidden;
        }
        .sf-reward-bar > i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #38bdf8, #a5f3fc);
        }
      `}</style>
      <div className="sf-reward-aura" aria-hidden="true" />
      <div className="sf-reward-card">
        <div className="sf-reward-ring" aria-hidden="true">
          <svg viewBox="0 0 68 68">
            <circle cx="34" cy="34" r={ringR} fill="none" stroke="rgba(148, 179, 224, 0.22)" strokeWidth="5.5" />
            <circle
              className="sf-reward-ring__prog"
              cx="34"
              cy="34"
              r={ringR}
              fill="none"
              stroke={perfect ? '#fbbf24' : '#34d399'}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={ringC}
              style={
                {
                  '--ring-c': `${ringC}`,
                  '--ring-offset': `${ringOffset}`,
                } as React.CSSProperties
              }
            />
          </svg>
          <span className="sf-reward-ring__text">
            <span className="sf-reward-ring__ratio">
              {banner.totalCount > 0 ? `${banner.correctCount}/${banner.totalCount}` : '完成'}
            </span>
            <span className="sf-reward-ring__sub">{pct}%</span>
          </span>
        </div>

        <div className="sf-reward-body">
          <div className="sf-reward-kicker">
            <span>学习节点 {banner.nodeNumber} 战果结算</span>
            <span>·</span>
            <span>战利品已投放棋盘，点击法球即可拾取</span>
          </div>
          <div className="sf-reward-title-row">
            <span className="sf-reward-title">
              {banner.totalCount > 0
                ? `答对 ${banner.correctCount} / ${banner.totalCount} 题`
                : '本节学习已完成'}
            </span>
            {perfect ? <span className="sf-reward-perfect">★ 满分全对</span> : null}
          </div>
          <div className="sf-reward-loot-row">
            <span className="sf-reward-pill--gold">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6.8" fill="#fbbf24" stroke="#fff7d6" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="4.2" fill="none" stroke="#b45309" strokeWidth="1" />
              </svg>
              <span>+{banner.grantedGold} 金币</span>
              {orbTotal > 0 ? <span className="sf-reward-pill--orb">· {orbTotal} 枚宝球坠落</span> : null}
            </span>
            <span className="sf-reward-pill--charge">
              <span>科研充能 {banner.carryOutCents}/100</span>
              <span className="sf-reward-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, Math.min(100, banner.carryOutCents))}%` }} />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
