import React, { useEffect, useRef, useState } from 'react';
import { lookupItemById, SEASON1_AUGMENTS } from '@pkg/contracts';
import { GameItemIcon, RichGameText } from '@pkg/learning-ui';
import type { MatchRoomSnapshot } from '../api/matchSocket.js';
import { GameUiIcon } from '../components/GameUiIcons.js';

interface LearningCardData {
  readonly kind: 'learning';
  readonly key: string;
  readonly nodeNumber: number;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly grantedGold: number;
  readonly orbSplits: readonly number[];
  readonly carryOutCents: number;
}

interface PhaseLootCardData {
  readonly kind: 'phase_loot';
  readonly key: string;
  readonly kicker: string;
  readonly title: string;
  readonly baseGold: number;
  readonly interestGold: number;
  readonly bonusGold: number;
  readonly newLevel: number | null;
  readonly xpGained: number;
  readonly vouchersGained: number;
  readonly gainedItemIds: readonly string[];
  readonly gainedAugment: { readonly name: string; readonly desc: string } | null;
}

type RewardShowcaseCard = LearningCardData | PhaseLootCardData;

interface BaselineSnapshotTrack {
  readonly matchId: string;
  readonly ledgerLen: number;
  readonly level: number;
  readonly xp: number;
  readonly vouchers: number;
  readonly itemCounts: Readonly<Record<string, number>>;
  readonly augmentIds: readonly string[];
}

function countById(ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function diffAddedItems(
  prevCounts: Readonly<Record<string, number>>,
  nextItems: readonly string[],
): string[] {
  const nextCounts = countById(nextItems);
  const added: string[] = [];
  for (const [id, nextN] of Object.entries(nextCounts)) {
    const prevN = prevCounts[id] ?? 0;
    for (let i = prevN; i < nextN; i += 1) {
      added.push(id);
    }
  }
  return added;
}

export function LearningRewardBanner({
  snapshot,
}: {
  readonly snapshot: MatchRoomSnapshot | null;
}): React.JSX.Element | null {
  const [queue, setQueue] = useState<readonly RewardShowcaseCard[]>([]);
  const shownLearningKeysRef = useRef<Set<string>>(new Set());
  const prevTrackRef = useRef<BaselineSnapshotTrack | null>(null);
  const seqRef = useRef<number>(0);

  useEffect(() => {
    if (!snapshot) {
      shownLearningKeysRef.current.clear();
      prevTrackRef.current = null;
      setQueue([]);
      return;
    }

    const toEnqueue: RewardShowcaseCard[] = [];

    const settlement = snapshot.resourceSettlement;
    if (settlement) {
      const settledHere =
        snapshot.phase === 'resource' ||
        (snapshot.phase === 'learning' && Boolean(snapshot.learning?.complete)) ||
        (snapshot.phase === 'strategy' && settlement.nodeIndex === snapshot.nodeIndex);
      if (settledHere) {
        const key = `${snapshot.matchId}:node:${settlement.nodeIndex}`;
        if (!shownLearningKeysRef.current.has(key)) {
          shownLearningKeysRef.current.add(key);
          const lrn = snapshot.learning;
          const feedbackValues = lrn ? Object.values(lrn.feedback) : [];
          const totalCount =
            lrn?.totalQuestionsCount ??
            (lrn && lrn.submittedQuestionIds.length > 0 ? lrn.submittedQuestionIds.length : feedbackValues.length);
          const correctCount =
            lrn?.correctCount ?? feedbackValues.filter((item) => Boolean(item?.isCorrect)).length;

          toEnqueue.push({
            kind: 'learning',
            key,
            nodeNumber: settlement.nodeIndex + 1,
            correctCount,
            totalCount,
            grantedGold: settlement.grantedIntegerGold,
            orbSplits: settlement.orbSplits,
            carryOutCents: settlement.carryOutCents,
          });
        }
      }
    }

    const prev = prevTrackRef.current;
    const self = snapshot.self;
    const nextTrack: BaselineSnapshotTrack = {
      matchId: snapshot.matchId,
      ledgerLen: self.goldLedger.length,
      level: self.level,
      xp: self.xp,
      vouchers: self.rerollVouchers,
      itemCounts: countById(self.inventoryItems),
      augmentIds: [...self.chosenAugments],
    };

    if (prev && prev.matchId === snapshot.matchId) {
      const newLedger = self.goldLedger.slice(prev.ledgerLen);
      let baseGold = 0;
      let interestGold = 0;
      let bonusGold = 0;
      for (const entry of newLedger) {
        if (entry.amount <= 0) continue;
        if (entry.reason === 'base_income') baseGold += entry.amount;
        else if (entry.reason === 'interest') interestGold += entry.amount;
        else if (
          entry.reason !== 'learning' &&
          entry.reason !== 'sell_unit' &&
          entry.reason !== 'buy_card' &&
          entry.reason !== 'refresh_shop' &&
          entry.reason !== 'buy_xp'
        ) {
          bonusGold += entry.amount;
        }
      }

      const leveledUp = self.level > prev.level ? self.level : null;
      const boughtXp = newLedger.some((e) => e.reason === 'buy_xp');
      const xpGained =
        !boughtXp && (self.xp > prev.xp || leveledUp !== null)
          ? Math.max(0, leveledUp !== null ? self.xp : self.xp - prev.xp)
          : 0;
      const vouchersGained = Math.max(0, self.rerollVouchers - prev.vouchers);
      const gainedItemIds = diffAddedItems(prev.itemCounts, self.inventoryItems);

      const prevAugSet = new Set(prev.augmentIds);
      const newAugId = self.chosenAugments.find((id) => !prevAugSet.has(id)) ?? null;
      const augDef = newAugId ? SEASON1_AUGMENTS.find((a) => a.id === newAugId) ?? null : null;

      const hasPhaseGain =
        baseGold > 0 ||
        interestGold > 0 ||
        bonusGold > 0 ||
        leveledUp !== null ||
        vouchersGained > 0 ||
        gainedItemIds.length > 0 ||
        augDef !== null;

      if (hasPhaseGain) {
        seqRef.current += 1;
        const isAugOnly =
          augDef !== null &&
          baseGold === 0 &&
          interestGold === 0 &&
          bonusGold === 0 &&
          gainedItemIds.length === 0;
        const isItemOnly =
          gainedItemIds.length > 0 &&
          baseGold === 0 &&
          interestGold === 0 &&
          bonusGold === 0 &&
          augDef === null &&
          leveledUp === null;
        toEnqueue.push({
          kind: 'phase_loot',
          key: `${snapshot.matchId}:gain:${seqRef.current}`,
          kicker: isAugOnly
            ? `第 ${snapshot.round} 轮 · 强化符文激活`
            : isItemOnly
              ? `第 ${snapshot.round} 轮 · 装备与物资入库`
              : `第 ${snapshot.round} 轮 · 阶段补给到账`,
          title: isAugOnly
            ? augDef.name
            : isItemOnly
              ? `获得 ${gainedItemIds.length} 件装备`
              : leveledUp !== null
                ? `回合结算 · 升至 Lv.${leveledUp}`
                : '本阶段收获',
          baseGold,
          interestGold,
          bonusGold,
          newLevel: leveledUp,
          xpGained,
          vouchersGained,
          gainedItemIds,
          gainedAugment: augDef ? { name: augDef.name, desc: augDef.desc } : null,
        });
      }
    }

    prevTrackRef.current = nextTrack;

    if (toEnqueue.length > 0) {
      setQueue((cur) => [...cur, ...toEnqueue].slice(-4));
    }
  }, [snapshot]);

  const active = queue[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const activeKey = active.key;
    const timer = window.setTimeout(() => {
      setQueue((cur) => cur.filter((item) => item.key !== activeKey));
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [active?.key]);

  if (!active) return null;

  return (
    <div
      className="sf-reward-stage"
      key={active.key}
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
          animation: sfRewardBurstIn 3800ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
          max-width: 660px;
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
        .sf-reward-emblem {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1.5px solid rgba(246, 204, 118, 0.72);
          background: radial-gradient(circle at 35% 30%, rgba(246, 201, 106, 0.28), rgba(16, 28, 54, 0.92));
          box-shadow: 0 0 22px rgba(246, 201, 106, 0.26);
          color: #fde68a;
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
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .sf-reward-loot-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          animation: sfRewardChipPop 420ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
        }
        .sf-reward-pill--gold {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(246, 201, 106, 0.28) 0%, rgba(217, 119, 6, 0.24) 100%);
          border: 1.5px solid rgba(251, 211, 128, 0.85);
          color: #fff6d6;
          font-size: 13.5px;
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
          gap: 6px;
          padding: 5px 11px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.16);
          border: 1.5px solid rgba(103, 232, 249, 0.62);
          color: #cffafe;
          font-size: 12.5px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .sf-reward-pill--item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px 3px 5px;
          border-radius: 10px;
          background: rgba(30, 48, 86, 0.88);
          border: 1.5px solid rgba(246, 204, 118, 0.68);
          color: #fff7db;
          font-size: 12.5px;
          font-weight: 800;
        }
        .sf-reward-aug-desc {
          font-size: 12.5px;
          line-height: 1.45;
          color: #dbeafe;
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
        {active.kind === 'learning' ? (() => {
          const pct = active.totalCount > 0 ? Math.round((active.correctCount / active.totalCount) * 100) : 100;
          const perfect = active.totalCount > 0 && active.correctCount === active.totalCount;
          const ringR = 28;
          const ringC = 2 * Math.PI * ringR;
          const ringOffset = ringC * (1 - Math.max(0, Math.min(1, pct / 100)));
          const orbTotal = active.orbSplits.length;
          return (
            <>
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
                    {active.totalCount > 0 ? `${active.correctCount}/${active.totalCount}` : '完成'}
                  </span>
                  <span className="sf-reward-ring__sub">{pct}%</span>
                </span>
              </div>

              <div className="sf-reward-body">
                <div className="sf-reward-kicker">
                  <span>学习节点 {active.nodeNumber} 战果结算</span>
                  <span>·</span>
                  <span>点击棋盘宝球或让小小英雄路过即可拾取</span>
                </div>
                <div className="sf-reward-title-row">
                  <span className="sf-reward-title">
                    {active.totalCount > 0
                      ? `答对 ${active.correctCount} / ${active.totalCount} 题`
                      : '本节学习已完成'}
                  </span>
                  {perfect ? (
                    <span className="sf-reward-perfect">
                      <GameUiIcon name="star" size={12} />
                      <span>满分全对</span>
                    </span>
                  ) : null}
                </div>
                <div className="sf-reward-loot-row">
                  <span className="sf-reward-pill--gold">
                    <GameUiIcon name="coin" size={15} />
                    <span>+{active.grantedGold} 金币</span>
                    {orbTotal > 0 ? <span className="sf-reward-pill--orb">· {orbTotal} 枚宝球坠落</span> : null}
                  </span>
                  <span className="sf-reward-pill--charge">
                    <GameUiIcon name="spark" size={13} />
                    <span>充能 {active.carryOutCents}/100</span>
                    <span className="sf-reward-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(4, Math.min(100, active.carryOutCents))}%` }} />
                    </span>
                  </span>
                </div>
              </div>
            </>
          );
        })() : (
          <>
            <div className="sf-reward-emblem" aria-hidden="true">
              {active.gainedItemIds.length === 1 && active.baseGold === 0 && active.interestGold === 0 ? (
                <GameItemIcon itemId={active.gainedItemIds[0]!} size="lg" />
              ) : (
                <GameUiIcon name={active.gainedAugment ? 'star' : 'coin'} size={28} />
              )}
            </div>
            <div className="sf-reward-body">
              <div className="sf-reward-kicker">
                <span>{active.kicker}</span>
              </div>
              <div className="sf-reward-title-row">
                <span className="sf-reward-title">{active.title}</span>
                {active.newLevel !== null ? (
                  <span className="sf-reward-perfect">
                    <GameUiIcon name="star" size={12} />
                    <span>Lv.{active.newLevel}</span>
                  </span>
                ) : null}
              </div>
              {active.gainedAugment ? (
                <div className="sf-reward-aug-desc">
                  <RichGameText text={active.gainedAugment.desc} />
                </div>
              ) : null}
              <div className="sf-reward-loot-row">
                {active.baseGold > 0 ? (
                  <span className="sf-reward-pill--gold">
                    <GameUiIcon name="coin" size={14} />
                    <span>基础 +{active.baseGold}G</span>
                  </span>
                ) : null}
                {active.interestGold > 0 ? (
                  <span className="sf-reward-pill--gold">
                    <GameUiIcon name="coin" size={14} />
                    <span>利息 +{active.interestGold}G</span>
                  </span>
                ) : null}
                {active.bonusGold > 0 ? (
                  <span className="sf-reward-pill--gold">
                    <GameUiIcon name="coin" size={14} />
                    <span>额外 +{active.bonusGold}G</span>
                  </span>
                ) : null}
                {active.xpGained > 0 ? (
                  <span className="sf-reward-pill--charge">
                    <GameUiIcon name="spark" size={13} />
                    <span>经验 +{active.xpGained}</span>
                  </span>
                ) : null}
                {active.vouchersGained > 0 ? (
                  <span className="sf-reward-pill--charge">
                    <span>免费刷新券 +{active.vouchersGained}</span>
                  </span>
                ) : null}
                {active.gainedItemIds.map((itemId, idx) => {
                  const info = lookupItemById(itemId);
                  return (
                    <span key={`${itemId}-${idx}`} className="sf-reward-pill--item">
                      <GameItemIcon itemId={itemId} size="xs" />
                      <span>{info?.item.name ?? itemId}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
