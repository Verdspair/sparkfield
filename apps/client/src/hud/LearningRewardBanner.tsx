import React, { useEffect, useRef, useState } from 'react';
import { lookupItemById, SEASON1_AUGMENTS } from '@pkg/contracts';
import { GameItemIcon, RichGameText } from '@pkg/learning-ui';
import type { MatchRoomSnapshot } from '../api/matchSocket.js';
import { GameUiIcon } from '../components/GameUiIcons.js';
import './learningReward.css';

interface LearningCardData {
  readonly kind: 'learning';
  readonly key: string;
  readonly nodeNumber: number;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly grantedGold: number;
  readonly orbSplits: readonly number[];
  readonly carryOutCents: number;
  readonly bonusItemIds: readonly string[];
  readonly bonusRerollVouchers: number;
  readonly performanceTier: string | null;
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

function subtractClaimedItems(
  gainedIds: readonly string[],
  claimedIds: readonly string[],
): string[] {
  if (claimedIds.length === 0) return [...gainedIds];
  const remainingClaim = countById(claimedIds);
  const out: string[] = [];
  for (const id of gainedIds) {
    const count = remainingClaim[id] ?? 0;
    if (count > 0) {
      remainingClaim[id] = count - 1;
    } else {
      out.push(id);
    }
  }
  return out;
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
    let claimedItemsThisFrame: string[] = [];
    let claimedVouchersThisFrame = 0;

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
          const extra = settlement as {
            bonusItemIds?: readonly string[];
            bonusRerollVouchers?: number;
            performanceTier?: string;
          };
          const bonusItemIds = Array.isArray(extra.bonusItemIds)
            ? extra.bonusItemIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
            : [];
          const bonusRerollVouchers =
            typeof extra.bonusRerollVouchers === 'number' && extra.bonusRerollVouchers > 0
              ? Math.floor(extra.bonusRerollVouchers)
              : 0;
          const performanceTier =
            typeof extra.performanceTier === 'string' && extra.performanceTier.length > 0
              ? extra.performanceTier
              : null;

          claimedItemsThisFrame = bonusItemIds;
          claimedVouchersThisFrame = bonusRerollVouchers;

          toEnqueue.push({
            kind: 'learning',
            key,
            nodeNumber: settlement.nodeIndex + 1,
            correctCount,
            totalCount,
            grantedGold: settlement.grantedIntegerGold,
            orbSplits: settlement.orbSplits,
            carryOutCents: settlement.carryOutCents,
            bonusItemIds,
            bonusRerollVouchers,
            performanceTier,
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
      const vouchersGained = Math.max(
        0,
        self.rerollVouchers - prev.vouchers - claimedVouchersThisFrame,
      );
      const gainedItemIds = subtractClaimedItems(
        diffAddedItems(prev.itemCounts, self.inventoryItems),
        claimedItemsThisFrame,
      );

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
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="sf-reward-stage"
      key={active.key}
      role="status"
      aria-live="polite"
      data-testid="learning-reward-banner"
    >
      <div className="sf-reward-card">
        {active.kind === 'learning' ? (() => {
          const pct = active.totalCount > 0 ? Math.round((active.correctCount / active.totalCount) * 100) : null;
          const perfect = active.totalCount > 0 && active.correctCount === active.totalCount;
          const excellent = !perfect && active.performanceTier === 'excellent';
          const ringR = 28;
          const ringC = 2 * Math.PI * ringR;
          const ringOffset = ringC * (1 - Math.max(0, Math.min(1, (pct ?? 0) / 100)));
          const orbTotal = active.orbSplits.length;
          return (
            <>
              {pct !== null ? <div className="sf-reward-ring" aria-hidden="true">
                <svg viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r={ringR} fill="none" stroke="rgba(255, 255, 255, 0.09)" strokeWidth="5.5" />
                  <circle
                    className="sf-reward-ring__prog"
                    cx="34"
                    cy="34"
                    r={ringR}
                    fill="none"
                    stroke={perfect ? '#e5c785' : '#5cc498'}
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
                    {pct}%
                  </span>
                </span>
              </div> : null}

              <div className="sf-reward-body">
                <div className="sf-reward-kicker">
                  学习节点 {active.nodeNumber} · 战果结算
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
                      <span>全对</span>
                    </span>
                  ) : excellent ? (
                    <span className="sf-reward-excellent" data-testid="reward-performance-excellent">
                      <GameUiIcon name="star" size={12} />
                      <span>表现优异</span>
                    </span>
                  ) : null}
                </div>
                <div className="sf-reward-loot-row">
                  <span className="sf-reward-pill--gold">
                    <GameUiIcon name="coin" size={15} />
                    <span>+{active.grantedGold} 金币</span>
                    {orbTotal > 0 ? <span className="sf-reward-pill--orb">· {orbTotal} 枚宝球</span> : null}
                  </span>
                  <span className="sf-reward-pill--charge">
                    <GameUiIcon name="spark" size={13} />
                    <span>充能 {active.carryOutCents}/100</span>
                  </span>
                  {active.bonusRerollVouchers > 0 ? (
                    <span className="sf-reward-pill--charge" data-testid="learning-bonus-vouchers">
                      <GameUiIcon name="star" size={13} />
                      <span>免费刷新券 +{active.bonusRerollVouchers}</span>
                    </span>
                  ) : null}
                  {active.bonusItemIds.map((itemId, idx) => {
                    const info = lookupItemById(itemId);
                    return (
                      <span
                        key={`${itemId}-${idx}`}
                        className="sf-reward-pill--item"
                        data-testid={`learning-bonus-item-${idx}`}
                      >
                        <GameItemIcon itemId={itemId} size="xs" />
                        <span>{info?.item.name ?? itemId}</span>
                      </span>
                    );
                  })}
                </div>
                {orbTotal > 0 ? <p className="sf-reward-pickup-hint">点击棋盘上的宝球，或移动领航员拾取。</p> : null}
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
