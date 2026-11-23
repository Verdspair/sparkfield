import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getMatchChoiceKind,
  LINEUP_PLANNER_MAX_SLOTS,
  type ClientQuestionView,
  type GameCommand,
  MODE_BUDGETS,
  SEASON1_ITEMS,
  SEASON1_TRAITS,
  SEASON1_UNITS,
  SEASON1_UNITS_BY_ID,
  lookupCraftRecipe,
  lookupItemById,
} from '@pkg/contracts';
import {
  computeActiveTraits,
  getShopPurchasePreview,
  populationCap,
  previewItemEquip,
  starCopies,
  type UnitInstance,
} from '@pkg/game-core';
import {
  QuestionStepCard,
  RecommendedItemsTree,
  type LessonStepProgressItem,
  type QuestionAnswerSubmission,
  type QuestionFeedbackView,
} from '@pkg/learning-ui';
import type { MatchLearningFeedbackItem } from '../api/matchSocket.js';
import { TacticianPortrait, UnitPortrait } from '../components/UnitPortrait.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_LABELS,
  QUEUE_TYPE_LABELS,
  formatQuarterPoints,
} from '../utils/antiFakeZero.js';
import {
  MatchChoiceModal,
  MatchCodexModal,
  MatchLineupPlannerModal,
} from './MatchModals.js';
import './matchHud.css';

const PHASE_LABELS = {
  entry: '入场',
  learning: '学习',
  resource: '资源结算',
  choice: '抉择',
  strategy: '备战',
  battle: '战斗',
  settlement: '结算',
  rest: '休息',
  exit: '结束',
} as const;

const STEP_LABELS = {
  material: '导学',
  practice: '练习',
  resource_check: '测验',
  remediation: '订正',
  verification: '巩固',
} as const;

function traitTierClass(
  activeTier: number,
  totalTiers: number,
  kind: 'faction' | 'role' | 'unique',
): 'iron' | 'bronze' | 'silver' | 'gold' | 'prismatic' {
  if (activeTier <= 0) return 'iron';
  if (kind === 'unique') return 'gold';
  if (totalTiers >= 4 && activeTier >= 4) return 'prismatic';
  if (activeTier === 1) return 'bronze';
  if (activeTier === 2) return totalTiers === 2 ? 'gold' : 'silver';
  return 'gold';
}

function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

type TargetAction = { phaseIndex: number } & (
  | { kind: 'equip'; inventoryItemIndex: number }
  | { kind: 'remover' | 'reforger' }
);

function targetCommand(action: TargetAction, targetInstanceId: string): GameCommand {
  if (action.kind === 'equip') {
    return {
      type: 'EQUIP_ITEM',
      inventoryItemIndex: action.inventoryItemIndex,
      targetInstanceId,
    };
  }
  return {
    type: action.kind === 'remover' ? 'USE_MAGNETIC_REMOVER' : 'USE_REFORGER',
    targetInstanceId,
  };
}

export function MatchHudOverlay(): React.JSX.Element | null {
  const store = useAppStore();
  const {
    matchSnapshot,
    matchConnectionState,
    matchActionPending,
    isOfflineSandboxMatch,
    combatTelemetry,
    scoutedSeatId,
    inspectedUnitId,
    draggingUnitId,
    overSellDropzone,
    sendMatchCommand,
    sendMatchLearningSubmit,
    sendMatchLearningAdvance,
    skipOfflinePhaseWait,
    scoutMatchSeat,
    clearInspectedUnit,
    setInspectedUnitManual,
    getStageEngine,
    audioBus,
    pushToast,
  } = store;

  const shopDockPosition = store.shopDockPosition ?? 'bottom';
  const shopCollapsed = store.shopCollapsed ?? false;
  const setShopCollapsed = store.setShopCollapsed;
  const openSettings = store.openSettings;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [leftTab, setLeftTab] = useState<'traits' | 'items'>('traits');
  const [rightTab, setRightTab] = useState<'score' | 'damage'>('score');
  const [damageMetric, setDamageMetric] = useState<'dealt' | 'taken' | 'heal'>('dealt');

  const [peekingBattlefield, setPeekingBattlefield] = useState<boolean>(false);
  const [plannerOpen, setPlannerOpen] = useState<boolean>(false);
  const [codexOpen, setCodexOpen] = useState<boolean>(false);
  const [codexUnitId, setCodexUnitId] = useState<string>('S01');
  const [expandedTraitName, setExpandedTraitName] = useState<string | null>(null);

  const [targetAction, setTargetAction] = useState<TargetAction | null>(null);
  const activeTargetAction =
    matchSnapshot?.phase === 'strategy' && targetAction?.phaseIndex === matchSnapshot.phaseIndex
      ? targetAction
      : null;
  const pendingEquipIndex =
    activeTargetAction?.kind === 'equip' ? activeTargetAction.inventoryItemIndex : null;
  const pendingTool =
    activeTargetAction?.kind === 'remover' || activeTargetAction?.kind === 'reforger'
      ? activeTargetAction.kind
      : null;

  const [learningReview, setLearningReview] = useState<{
    phaseIndex: number;
    question: ClientQuestionView;
    feedback: MatchLearningFeedbackItem | null;
  } | null>(null);

  const prevGoldRef = useRef<number | null>(null);
  const [goldRolling, setGoldRolling] = useState<boolean>(false);

  const prevTraitTiersRef = useRef<Map<string, number>>(new Map());
  const [newlyActivatedTraits, setNewlyActivatedTraits] = useState<Set<string>>(new Set());
  const lastOrbEmotePhaseRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const currentGold = matchSnapshot?.self.gold ?? 0;
  useEffect(() => {
    if (prevGoldRef.current !== null && prevGoldRef.current !== currentGold) {
      setGoldRolling(true);
      const t = setTimeout(() => setGoldRolling(false), 200);
      prevGoldRef.current = currentGold;
      return () => clearTimeout(t);
    }
    prevGoldRef.current = currentGold;
    return undefined;
  }, [currentGold]);

  useEffect(() => {
    setPeekingBattlefield(false);
    setTargetAction(null);
    setLearningReview(null);
    if (matchSnapshot?.phase === 'battle') {
      setRightTab('score');
    }
  }, [matchSnapshot?.phase, matchSnapshot?.phaseIndex]);

  useEffect(() => {
    if (!matchSnapshot || matchSnapshot.phase !== 'resource') return;
    const granted = matchSnapshot.resourceSettlement?.grantedIntegerGold ?? 0;
    const orbCount = matchSnapshot.self.learningGoldOrbs?.length ?? 0;
    if (granted <= 0 && orbCount <= 0) return;
    if (lastOrbEmotePhaseRef.current === matchSnapshot.phaseIndex) return;
    lastOrbEmotePhaseRef.current = matchSnapshot.phaseIndex;
    getStageEngine()?.triggerTacticianEmote('collect_orb');
  }, [matchSnapshot, getStageEngine]);

  useEffect(() => {
    if (!inspectedUnitId || !activeTargetAction || !matchSnapshot) return;
    if (!matchSnapshot.self.units.some((unit) => unit.instanceId === inspectedUnitId)) return;
    sendMatchCommand(targetCommand(activeTargetAction, inspectedUnitId));
    setTargetAction(null);
  }, [inspectedUnitId, matchSnapshot, activeTargetAction, sendMatchCommand]);

  const viewedUnits = useMemo(() => {
    if (!matchSnapshot) return [];
    if (!scoutedSeatId || scoutedSeatId === matchSnapshot.seatId) {
      return matchSnapshot.self.units;
    }
    return matchSnapshot.seats.find((s) => s.seatId === scoutedSeatId)?.units ?? [];
  }, [matchSnapshot, scoutedSeatId]);

  const activeTraits = useMemo(() => computeActiveTraits(viewedUnits), [viewedUnits]);

  const activeTraitNames = useMemo(
    () => new Set(activeTraits.filter((t) => t.activeTier > 0).map((t) => t.traitName)),
    [activeTraits],
  );

  useEffect(() => {
    const activated = new Set<string>();
    for (const tr of activeTraits) {
      const prev = prevTraitTiersRef.current.get(tr.traitName) ?? 0;
      if (tr.activeTier > prev && tr.activeTier > 0) {
        activated.add(tr.traitName);
      }
      prevTraitTiersRef.current.set(tr.traitName, tr.activeTier);
    }
    if (activated.size > 0) {
      setNewlyActivatedTraits(activated);
      const t = setTimeout(() => setNewlyActivatedTraits(new Set()), 750);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activeTraits]);

  const plannedTraits = useMemo(() => {
    if (!matchSnapshot) return [];
    const dummyUnits: UnitInstance[] = matchSnapshot.self.lineupPlan.map((uid, idx) => ({
      instanceId: `plan-${idx}`,
      unitId: uid,
      star: 1,
      location: { zone: 'board', row: Math.floor(idx / 7) % 4, col: idx % 7 },
      items: [],
      cryoRounds: 0,
      frozenUntilRound: null,
      bonusHp: 0,
      bonusSkillEfficiency: 0,
    }));
    return computeActiveTraits(dummyUnits).filter((t) => t.count > 0);
  }, [matchSnapshot]);

  const serverCommandsLocked = matchActionPending || matchConnectionState !== 'connected';

  useEffect(() => {
    if (!matchSnapshot) return;
    const modeSpecForKey = MODE_BUDGETS.modes[matchSnapshot.mode];
    const timelineForKey = modeSpecForKey.timeline[matchSnapshot.phaseIndex];
    const choiceKindForKey = getMatchChoiceKind(matchSnapshot.phase, timelineForKey?.label ?? '');
    const modalBlocking =
      matchSnapshot.phase === 'learning' ||
      (choiceKindForKey === 'augment' && Boolean(matchSnapshot.self.augmentOffer)) ||
      (choiceKindForKey === 'anvil' && matchSnapshot.self.anvils.length > 0);
    const xpCapReached = matchSnapshot.self.level >= modeSpecForKey.economy.base_level_cap;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableEventTarget(event.target)) return;

      if (event.code === 'Space' && matchSnapshot.phase === 'strategy' && !modalBlocking && !plannerOpen && !codexOpen) {
        event.preventDefault();
        setShopCollapsed?.(!shopCollapsed);
        return;
      }

      if (event.key === 'Escape') {
        if (activeTargetAction) {
          setTargetAction(null);
        } else if (inspectedUnitId) {
          clearInspectedUnit();
        } else if (plannerOpen) {
          setPlannerOpen(false);
        } else if (codexOpen) {
          setCodexOpen(false);
        }
        return;
      }

      if (event.key === 'Home' && scoutedSeatId && scoutedSeatId !== matchSnapshot.seatId) {
        event.preventDefault();
        scoutMatchSeat(null);
        return;
      }

      if (
        matchSnapshot.phase === 'strategy' &&
        !shopCollapsed &&
        !serverCommandsLocked &&
        !modalBlocking &&
        !plannerOpen &&
        !codexOpen
      ) {
        const lower = event.key.toLowerCase();
        if (lower === 'd' && (matchSnapshot.self.rerollVouchers > 0 || matchSnapshot.self.gold >= 2)) {
          event.preventDefault();
          sendMatchCommand({ type: 'REFRESH_SHOP' });
        } else if (lower === 'f' && !xpCapReached && matchSnapshot.self.gold >= 4) {
          event.preventDefault();
          sendMatchCommand({ type: 'BUY_XP' });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    matchSnapshot,
    shopCollapsed,
    setShopCollapsed,
    serverCommandsLocked,
    plannerOpen,
    codexOpen,
    activeTargetAction,
    inspectedUnitId,
    clearInspectedUnit,
    scoutedSeatId,
    scoutMatchSeat,
    sendMatchCommand,
  ]);

  if (!matchSnapshot) return null;

  const self = matchSnapshot.self;
  const modeSpec = MODE_BUDGETS.modes[matchSnapshot.mode];
  const timelineEvent = modeSpec.timeline[matchSnapshot.phaseIndex];
  const totalPhaseSec = timelineEvent?.duration ?? 50;
  const liveRemainingSec = Math.max(0, (matchSnapshot.deadlineEpochMs - nowMs) / 1000);
  const progressPct =
    totalPhaseSec > 0
      ? Math.max(0, Math.min(100, ((totalPhaseSec - liveRemainingSec) / totalPhaseSec) * 100))
      : 0;

  const isStrategy = matchSnapshot.phase === 'strategy';
  const isShopExpanded = isStrategy && !shopCollapsed;
  const isBottomOpen = isShopExpanded && shopDockPosition === 'bottom';
  const isUrgentCountdown = isStrategy && liveRemainingSec > 0 && liveRemainingSec <= 5;

  const cap = populationCap(self, matchSnapshot.mode);
  const deployedCount = self.units.filter((u) => u.location.zone === 'board').length;
  const xpToNext =
    self.level >= modeSpec.economy.base_level_cap
      ? null
      : (MODE_BUDGETS.xp_to_next as Record<string, number>)[String(self.level)] ?? null;
  const xpFillPct = xpToNext ? Math.min(100, Math.round((self.xp / xpToNext) * 100)) : 100;
  const shopOdds =
    (MODE_BUDGETS.shop_odds as Record<string, number[]>)[String(self.level)] ?? [
      100, 0, 0, 0, 0,
    ];
  const interestPreview = Math.min(modeSpec.economy.interest_cap, Math.floor(self.gold / 10));

  const hasBiocareTrait = activeTraits.some(
    (t) => t.traitName === '生科保育' && t.activeTier > 0,
  );

  const sortedSeats = [...matchSnapshot.seats].sort(
    (a, b) => b.victoryPoints - a.victoryPoints,
  );
  const maxSeatVp = Math.max(4, ...sortedSeats.map((s) => s.victoryPoints));

  const inspectedAllyUnit = inspectedUnitId
    ? self.units.find((u) => u.instanceId === inspectedUnitId) ?? null
    : null;
  const inspectedEnemyUnit =
    inspectedUnitId && !inspectedAllyUnit
      ? matchSnapshot.seats
          .flatMap((s) => s.units)
          .find((u) => u.instanceId === inspectedUnitId) ?? null
      : null;
  const inspectedUnit = inspectedAllyUnit ?? inspectedEnemyUnit;
  const inspectedDef = inspectedUnit ? SEASON1_UNITS_BY_ID.get(inspectedUnit.unitId) : null;

  const draggingUnit = draggingUnitId
    ? self.units.find((u) => u.instanceId === draggingUnitId) ?? null
    : null;
  const draggingSellGold = draggingUnit
    ? (SEASON1_UNITS_BY_ID.get(draggingUnit.unitId)?.cost ?? 1) *
      starCopies(draggingUnit.star)
    : 1;

  const choiceKind = getMatchChoiceKind(matchSnapshot.phase, timelineEvent?.label ?? '');
  const showAugmentChoice = choiceKind === 'augment' && Boolean(self.augmentOffer);
  const activeAnvil = self.anvils[0] ?? null;
  const showAnvilChoice = choiceKind === 'anvil' && Boolean(activeAnvil);
  const hasChoiceModal = showAugmentChoice || showAnvilChoice;

  const armTargetAction = (action: TargetAction) => {
    clearInspectedUnit();
    setTargetAction((previous) =>
      previous?.phaseIndex === action.phaseIndex &&
      previous.kind === action.kind &&
      (previous.kind !== 'equip' ||
        (action.kind === 'equip' && previous.inventoryItemIndex === action.inventoryItemIndex))
        ? null
        : action,
    );
  };

  const submitLearningAnswer = (submission: QuestionAnswerSubmission) => {
    const question = matchSnapshot.learning?.clientQuestions.find(
      (item) => item.questionId === submission.questionId,
    );
    if (!question) return;
    const review = { phaseIndex: matchSnapshot.phaseIndex, question, feedback: null };
    setLearningReview(review);
    void sendMatchLearningSubmit(submission.questionId, {
      answer: submission.answer,
      status: submission.status,
      questionId: submission.questionId,
      hintUsed: submission.hintUsed,
    })
      .then((ack) => {
        if (!ack.ok) throw new Error(ack.reason ?? 'LEARNING_SUBMISSION_REJECTED');
        setLearningReview((current) =>
          current === review ? { ...review, feedback: ack.feedback ?? null } : current,
        );
      })
      .catch((error: unknown) => {
        setLearningReview((current) => (current === review ? null : current));
        pushToast(error instanceof Error ? error.message : '提交学习答案失败', 'warning');
      });
  };

  const advanceLearningStep = () => {
    void sendMatchLearningAdvance()
      .then((ack) => {
        if (!ack.ok) throw new Error(ack.reason ?? 'LEARNING_ADVANCE_REJECTED');
      })
      .catch((error: unknown) =>
        pushToast(error instanceof Error ? error.message : '推进学习步骤失败', 'warning'),
      );
  };

  const togglePlannerUnit = (unitId: string) => {
    const exists = self.lineupPlan.includes(unitId);
    let next: string[];
    if (exists) {
      next = self.lineupPlan.filter((id) => id !== unitId);
    } else {
      if (self.lineupPlan.length >= LINEUP_PLANNER_MAX_SLOTS) {
        pushToast(`阵容规划器最多容纳 ${LINEUP_PLANNER_MAX_SLOTS} 张目标棋子`, 'info');
        return;
      }
      next = [...self.lineupPlan, unitId];
    }
    sendMatchCommand({ type: 'SET_LINEUP_PLAN', unitIds: next });
  };

  const renderWalletAndCharge = () => (
    <>
      <div className="sf-wallet-pill" data-testid="hud-integer-gold">
        <span className="sf-gold-dot" aria-hidden="true" />
        <span
          className="gold-roller"
          style={{
            fontSize: 16,
            transform: goldRolling ? 'translateY(-1px) scale(1.06)' : 'none',
          }}
        >
          {self.gold}G
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>+{interestPreview}</span>
      </div>

      <div
        className="sf-charge-pill"
        title="科研充能满 100 在学习结算时换为 1 枚整数金币"
        data-testid="hud-science-charge-ring"
      >
        <div
          className="science-charge-ring"
          style={{ '--charge-pct': `${self.learningChargeCents}%` } as React.CSSProperties}
        >
          {self.learningChargeCents}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {self.learningChargeCents}/100
        </span>
      </div>
    </>
  );

  const renderSellDropzone = () => (
    <div
      className={`shop-sell-dropzone ${
        overSellDropzone ? 'shop-sell-dropzone--magnet-active' : ''
      }`.trim()}
      data-testid="magnetic-sell-dropzone"
    >
      <span>松手出售 {SEASON1_UNITS_BY_ID.get(draggingUnit?.unitId ?? '')?.name ?? '棋子'}</span>
      <strong>+{draggingSellGold}G</strong>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>装备退回背包</span>
    </div>
  );

  return (
    <div
      className="blc-match-hud"
      data-testid="match-hud-overlay"
      data-shop-dock-position={shopDockPosition}
      data-shop-collapsed={shopCollapsed ? 'true' : 'false'}
    >
      <header className="blc-hud-topbar">
        <div className="blc-hud-topbar__left">
          <span className="blc-chip blc-chip--gold">
            {DURATION_MODE_LABELS[matchSnapshot.mode]} · {QUEUE_TYPE_LABELS[matchSnapshot.queueType]}
          </span>
          {matchConnectionState === 'reconnecting' ? (
            <span className="blc-chip" style={{ borderColor: '#F59E0B', color: '#FDE68A' }}>
              正在重连…
            </span>
          ) : null}
          {scoutedSeatId && scoutedSeatId !== matchSnapshot.seatId ? (
            <button
              type="button"
              className="sf-hud-scout-return"
              onClick={() => scoutMatchSeat(null)}
              data-testid="return-home-board-btn"
            >
              返回主场
            </button>
          ) : null}
        </div>

        <div
          className={`ui-metal-frame blc-phase-capsule ${
            isUrgentCountdown ? 'blc-phase-capsule--urgent' : ''
          }`.trim()}
          data-testid="hud-phase-capsule"
        >
          <div className="blc-phase-capsule__top">
            <span className="blc-phase-round">第 {matchSnapshot.round} 轮</span>
            <strong className="blc-phase-label">
              {timelineEvent?.label ?? PHASE_LABELS[matchSnapshot.phase]}
            </strong>
            <span className="blc-phase-clock" data-testid="hud-phase-countdown">
              {formatMMSS(liveRemainingSec)}
            </span>
          </div>
          <div className="blc-phase-bar">
            <div
              className="blc-phase-bar__fill"
              style={{ width: `${100 - progressPct}%` }}
            />
          </div>
        </div>

        <div className="blc-hud-topbar__right">
          {isOfflineSandboxMatch ? (
            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              onClick={skipOfflinePhaseWait}
              title="进入下一阶段"
              data-testid="offline-skip-phase-btn"
            >
              跳过等待
            </button>
          ) : null}

          <button
            type="button"
            className="ui-metal-frame blc-btn blc-btn--metal blc-btn--sm"
            onClick={() => setPlannerOpen(true)}
            data-testid="open-lineup-planner-btn"
          >
            阵容 {self.lineupPlan.length}/{LINEUP_PLANNER_MAX_SLOTS}
          </button>

          <button
            type="button"
            className="ui-metal-frame blc-btn blc-btn--metal blc-btn--sm"
            onClick={() => setCodexOpen(true)}
            data-testid="open-inmatch-codex-btn"
          >
            图鉴
          </button>

          <button
            type="button"
            className="sf-hud-gear-btn"
            onClick={() => openSettings?.('match')}
            aria-label="打开设置"
            data-testid="open-inmatch-settings-btn"
          >
            <span aria-hidden="true">⚙</span>
            <span>设置</span>
          </button>
        </div>
      </header>

      {hasChoiceModal && peekingBattlefield ? (
        <div className="blc-peek-banner" data-testid="choice-peek-return-bar">
          <span>正在查看战场</span>
          <button
            type="button"
            className="blc-btn blc-btn--primary blc-btn--sm"
            onClick={() => setPeekingBattlefield(false)}
            data-testid="exit-battlefield-peek-btn"
          >
            返回选择
          </button>
        </div>
      ) : null}

      <aside
        className={`ui-metal-frame blc-hud-left ${!isBottomOpen ? 'blc-hud-left--tall' : ''}`.trim()}
        data-testid="hud-left-rail"
      >
        <div className="blc-seg-tabs">
          <button
            type="button"
            className={`blc-seg-tab ${leftTab === 'traits' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setLeftTab('traits')}
            data-testid="hud-left-traits-tab"
          >
            羁绊 ({activeTraits.filter((t) => t.activeTier > 0).length})
          </button>
          <button
            type="button"
            className={`blc-seg-tab ${leftTab === 'items' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setLeftTab('items')}
            data-testid="hud-left-items-tab"
          >
            装备 ({self.inventoryItems.length})
          </button>
        </div>

        {leftTab === 'traits' ? (
          <div className="blc-hud-scroll">
            {isStrategy && (hasBiocareTrait || self.cryoPodEnabled) ? (
              <button
                type="button"
                className={`blc-btn blc-btn--xs blc-btn--block ${
                  self.cryoPodEnabled ? 'blc-btn--primary' : 'blc-btn--metal'
                }`}
                disabled={serverCommandsLocked}
                style={{ marginBottom: 4 }}
                onClick={() =>
                  sendMatchCommand({
                    type: 'TOGGLE_CRYO_POD',
                    enabled: !self.cryoPodEnabled,
                  })
                }
                data-testid="toggle-cryo-pod-btn"
              >
                休眠舱 · {self.cryoPodEnabled ? '已开启' : '未开启'}
              </button>
            ) : null}

            {activeTraits.filter((t) => t.count > 0).length === 0 ? (
              <div className="blc-muted-hint">上阵同羁绊棋子即可激活。</div>
            ) : (
              activeTraits
                .filter((t) => t.count > 0)
                .sort((a, b) => b.activeTier - a.activeTier || b.count - a.count)
                .map((tr) => {
                  const rawDef =
                    SEASON1_TRAITS.factions.find((f) => f.name === tr.traitName) ??
                    SEASON1_TRAITS.roles.find((r) => r.name === tr.traitName) ??
                    SEASON1_TRAITS.uniques.find((u) => u.name === tr.traitName);
                  const thresholds = rawDef?.thresholds ?? [1];
                  const tierStyle = traitTierClass(tr.activeTier, thresholds.length, tr.kind);
                  const sheen = newlyActivatedTraits.has(tr.traitName);
                  const isOpen = expandedTraitName === tr.traitName;

                  return (
                    <div key={tr.traitName} className="blc-trait-item-wrap">
                      <button
                        type="button"
                        className="blc-trait-row"
                        onClick={() =>
                          setExpandedTraitName((prev) =>
                            prev === tr.traitName ? null : tr.traitName,
                          )
                        }
                        data-testid={`hud-trait-${tr.traitName}`}
                      >
                        <span
                          className={`trait-hex-badge trait-hex-badge--${tierStyle} ${
                            sheen ? 'trait-hex-badge--activated' : ''
                          }`.trim()}
                        >
                          {tr.count}
                        </span>
                        <div className="blc-trait-row__meta">
                          <strong>{tr.traitName}</strong>
                          <div className="sf-trait-steps">
                            {thresholds.map((step, idx) => (
                              <React.Fragment key={step}>
                                {idx > 0 ? <span>/</span> : null}
                                <span
                                  className={tr.count >= step ? 'sf-trait-step--hit' : undefined}
                                >
                                  {step}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </button>

                      {isOpen && rawDef ? (
                        <div className="ui-frosted-panel blc-trait-pop">
                          <p style={{ margin: '0 0 6px', fontSize: 11.5 }}>{rawDef.desc}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {SEASON1_UNITS.filter(
                              (u) =>
                                u.faction === tr.traitName ||
                                u.role === tr.traitName ||
                                u.uniqueTrait === tr.traitName,
                            ).map((u) => {
                              const onBoard = viewedUnits.some(
                                (vu) => vu.unitId === u.id && vu.location.zone === 'board',
                              );
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={`blc-unit-pill ${
                                    onBoard ? 'blc-unit-pill--active' : ''
                                  }`.trim()}
                                  onClick={() => {
                                    setCodexUnitId(u.id);
                                    setCodexOpen(true);
                                  }}
                                >
                                  {u.cost}费·{u.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
            )}
          </div>
        ) : (
          <div className="blc-hud-scroll">
            <fieldset
              disabled={serverCommandsLocked}
              style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
            >
              <div className="blc-tool-slots">
                <button
                  type="button"
                  disabled={self.magneticCharges < 1 || !isStrategy}
                  className={`blc-btn blc-btn--xs ${
                    pendingTool === 'remover' ? 'blc-btn--primary' : 'blc-btn--metal'
                  }`}
                  onClick={() => {
                    armTargetAction({ kind: 'remover', phaseIndex: matchSnapshot.phaseIndex });
                  }}
                  title="无损卸下目标友军全部装备退回背包"
                  data-testid="tool-magnetic-remover-btn"
                >
                  磁拆 ×{self.magneticCharges}
                </button>

                <button
                  type="button"
                  disabled={self.reforgerCharges < 1 || !isStrategy}
                  className={`blc-btn blc-btn--xs ${
                    pendingTool === 'reforger' ? 'blc-btn--primary' : 'blc-btn--metal'
                  }`}
                  onClick={() => {
                    armTargetAction({ kind: 'reforger', phaseIndex: matchSnapshot.phaseIndex });
                  }}
                  title="重铸目标友军装备为同阶其他装备"
                  data-testid="tool-reforger-btn"
                >
                  重铸 ×{self.reforgerCharges}
                </button>
              </div>

              {(pendingEquipIndex !== null || pendingTool !== null) && isStrategy ? (
                <div className="ui-frosted-panel blc-quick-target-box">
                  <div style={{ fontSize: 11.5, color: 'var(--gold-light)', marginBottom: 6 }}>
                    {pendingEquipIndex !== null
                      ? '选择要装备的棋子'
                      : pendingTool === 'remover'
                        ? '选择要卸装的棋子'
                        : '选择要重铸的棋子'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {self.units.map((u) => {
                      const def = SEASON1_UNITS_BY_ID.get(u.unitId);
                      const preview =
                        pendingEquipIndex !== null && self.inventoryItems[pendingEquipIndex]
                          ? previewItemEquip(u, self.inventoryItems[pendingEquipIndex]!)
                          : null;
                      const crafted = preview?.craftedItemId
                        ? lookupItemById(preview.craftedItemId)
                        : null;
                      return (
                        <button
                          key={u.instanceId}
                          type="button"
                          className="blc-btn blc-btn--metal blc-btn--xs"
                          onClick={() => {
                            if (!activeTargetAction) return;
                            sendMatchCommand(targetCommand(activeTargetAction, u.instanceId));
                            setTargetAction(null);
                          }}
                        >
                          {'★'.repeat(u.star)}
                          {def?.name ?? '棋子'}
                          {crafted ? ` → ${crafted.item.name}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {self.inventoryItems.length === 0 ? (
                <div className="blc-muted-hint">暂无装备</div>
              ) : (
                <div className="blc-item-list">
                  {self.inventoryItems.map((itemId, idx) => {
                    const entry = lookupItemById(itemId);
                    const isComponent = entry?.kind === 'component' || entry?.kind === 'spatula';
                    const isArmed = pendingEquipIndex === idx;

                    return (
                      <div key={`${itemId}-${idx}`} className="item-recipe-trigger blc-item-slot-row">
                        <button
                          type="button"
                          disabled={!isStrategy}
                          className={`blc-item-btn ${isArmed ? 'blc-item-btn--armed' : ''}`}
                          onClick={() => {
                            armTargetAction({
                              kind: 'equip',
                              inventoryItemIndex: idx,
                              phaseIndex: matchSnapshot.phaseIndex,
                            });
                          }}
                          data-testid={`inventory-item-${idx}`}
                          data-item-id={itemId}
                        >
                          <span className="blc-item-glyph">◆</span>
                          <span className="blc-item-btn__name">
                            {entry?.item.name ?? '装备'}
                          </span>
                        </button>

                        {isComponent ? (
                          <div className="item-recipe-popover">
                            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                              {entry?.item.name} · 合成
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {[
                                ...SEASON1_ITEMS.components.map((c) => c.id),
                                SEASON1_ITEMS.special.spatulaComponent.id,
                              ]
                                .slice(0, 6)
                                .map((partnerId) => {
                                  const res = lookupCraftRecipe(itemId, partnerId);
                                  if (!res) return null;
                                  const partnerEntry = lookupItemById(partnerId);
                                  const ownedCount = self.inventoryItems.filter(
                                    (x, i) => i !== idx && x === partnerId,
                                  ).length;
                                  return (
                                    <div
                                      key={partnerId}
                                      className={`item-recipe-node ${
                                        ownedCount > 0 ? 'item-recipe-node--owned' : ''
                                      }`.trim()}
                                    >
                                      <span>+ {partnerEntry?.item.name ?? '散件'}</span>
                                      <span>→ {res.name}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>
          </div>
        )}
      </aside>

      <aside
        className={`ui-metal-frame blc-hud-right ${!isBottomOpen ? 'blc-hud-right--tall' : ''}`.trim()}
        data-testid="hud-right-rail"
      >
        <div className="blc-seg-tabs">
          <button
            type="button"
            className={`blc-seg-tab ${rightTab === 'score' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setRightTab('score')}
            data-testid="hud-right-score-tab"
          >
            胜点
          </button>
          <button
            type="button"
            className={`blc-seg-tab ${rightTab === 'damage' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setRightTab('damage')}
            data-testid="hud-right-damage-tab"
          >
            伤害
          </button>
        </div>

        {rightTab === 'score' ? (
          <div className="blc-hud-scroll">
            {sortedSeats.map((s, idx) => {
              const isSelf = s.seatId === matchSnapshot.seatId;
              const isScouted = (scoutedSeatId ?? matchSnapshot.seatId) === s.seatId;
              const ringPct = Math.max(18, Math.min(100, Math.round((s.victoryPoints / maxSeatVp) * 100)));
              const ringColor = isSelf
                ? '#f2c97d'
                : idx < 4
                  ? '#34d399'
                  : '#4fd1ff';
              return (
                <button
                  key={s.seatId}
                  type="button"
                  className={`blc-seat-pill ${isSelf ? 'blc-seat-pill--self' : ''} ${
                    isScouted ? 'blc-seat-pill--scouted' : ''
                  }`.trim()}
                  onClick={() => scoutMatchSeat(isSelf ? null : s.seatId)}
                  title={isSelf ? '返回主场' : `侦察 ${s.nickname} 战场`}
                  data-testid={`seat-ring-${s.seatId}`}
                >
                  <div className="blc-seat-pill__who">
                    <strong>
                      {s.nickname}
                      {matchSnapshot.queueType === 'solo' && s.isBot ? ' · 电脑' : ''}
                    </strong>
                    <span className="sf-seat-meta-line">
                      <span>#{idx + 1}</span>
                      <span>Lv.{s.level}</span>
                      <span className="sf-seat-vp-num">
                        {formatQuarterPoints(s.victoryPoints)}
                      </span>
                    </span>
                  </div>
                  <span
                    className="sf-seat-ring-avatar"
                    style={
                      {
                        '--ring-pct': `${ringPct}%`,
                        '--ring-color': ringColor,
                      } as React.CSSProperties
                    }
                  >
                    <TacticianPortrait
                      tacticianId={s.tacticianId ?? 'tactician_lumina_bell'}
                      size="sm"
                      alt={s.nickname}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="blc-hud-scroll" data-testid="hud-damage-panel">
            <div className="blc-seg-tabs" style={{ marginBottom: 6 }}>
              <button
                type="button"
                className={`blc-seg-tab ${damageMetric === 'dealt' ? 'blc-seg-tab--active' : ''}`}
                onClick={() => setDamageMetric('dealt')}
              >
                输出
              </button>
              <button
                type="button"
                className={`blc-seg-tab ${damageMetric === 'taken' ? 'blc-seg-tab--active' : ''}`}
                onClick={() => setDamageMetric('taken')}
              >
                承伤
              </button>
              <button
                type="button"
                className={`blc-seg-tab ${damageMetric === 'heal' ? 'blc-seg-tab--active' : ''}`}
                onClick={() => setDamageMetric('heal')}
              >
                护疗
              </button>
            </div>

            {combatTelemetry.length === 0 ? (
              <div className="blc-muted-hint">战斗开始后显示统计。</div>
            ) : (
              (() => {
                const rows = [...combatTelemetry].map((t) => {
                  const totalDealt = t.physicalDealt + t.magicDealt + t.trueDealt;
                  const val =
                    damageMetric === 'dealt'
                      ? totalDealt
                      : damageMetric === 'taken'
                        ? t.damageTaken
                        : t.healingAndShielding;
                  return { ...t, totalDealt, metricVal: val };
                });
                rows.sort((a, b) => b.metricVal - a.metricVal);
                const maxVal = Math.max(1, rows[0]?.metricVal ?? 1);

                return rows.map((r) => {
                  const def = SEASON1_UNITS_BY_ID.get(r.unitId);
                  return (
                    <div key={r.instanceId} className="blc-dmg-row" data-unit-id={r.unitId}>
                      <div className="blc-dmg-row__head">
                        <span className="sf-dmg-unit-head">
                          <UnitPortrait unitId={r.unitId} size="sm" />
                          <span>
                            {'★'.repeat(r.star)} {def?.name ?? '棋子'}
                          </span>
                        </span>
                        <strong>{Math.round(r.metricVal)}</strong>
                      </div>
                      <div className="blc-dmg-bar-track">
                        {damageMetric === 'dealt' ? (
                          <>
                            <div
                              style={{
                                width: `${(r.physicalDealt / maxVal) * 100}%`,
                                background: 'var(--dmg-physical)',
                              }}
                              title={`物理 ${Math.round(r.physicalDealt)}`}
                            />
                            <div
                              style={{
                                width: `${(r.magicDealt / maxVal) * 100}%`,
                                background: 'var(--dmg-magic)',
                              }}
                              title={`魔法 ${Math.round(r.magicDealt)}`}
                            />
                            <div
                              style={{
                                width: `${(r.trueDealt / maxVal) * 100}%`,
                                background: 'var(--dmg-true)',
                              }}
                              title={`真伤 ${Math.round(r.trueDealt)}`}
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              width: `${(r.metricVal / maxVal) * 100}%`,
                              background:
                                damageMetric === 'taken'
                                  ? 'var(--enemy-crimson)'
                                  : 'var(--hp-ally-fill)',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}
      </aside>

      {inspectedUnit && inspectedDef ? (
        <section
          className="ui-metal-frame ui-corner-ornaments blc-unit-inspect"
          aria-label="棋子战术检视卡"
          data-testid="unit-inspect-card"
        >
          <div className="blc-col-head">
            <div className="sf-inspect-hero">
              <UnitPortrait unitId={inspectedUnit.unitId} size="md" star={inspectedUnit.star} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="blc-chip blc-chip--gold">{inspectedDef.cost} 费</span>
                  <strong style={{ fontSize: 15.5 }}>
                    {'★'.repeat(inspectedUnit.star)} {inspectedDef.name}
                  </strong>
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {inspectedDef.faction} · {inspectedDef.role}
                  {inspectedDef.uniqueTrait ? ` · ${inspectedDef.uniqueTrait}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              onClick={clearInspectedUnit}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: '8px 0 6px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {inspectedDef.skillSummary}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5, marginBottom: 8 }}>
            <span className="blc-chip">射程 {inspectedDef.stats.range} 格</span>
            <span className="blc-chip">
              法力 {inspectedDef.stats.initialMana}/{inspectedDef.stats.maxMana}
            </span>
            {inspectedUnit.items.map((iid, i) => (
              <span key={`${iid}-${i}`} className="blc-chip blc-chip--gold">
                ◆ {lookupItemById(iid)?.item.name ?? '装备'}
              </span>
            ))}
          </div>

          <div className="blc-inspect-paper-box">
            <RecommendedItemsTree
              recommendedItemIds={inspectedDef.recommendedItems}
              ownedComponentIds={self.inventoryItems}
            />
          </div>

          {inspectedAllyUnit && isStrategy ? (
            <div className="blc-inspect-actions">
              <fieldset
                disabled={serverCommandsLocked}
                style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
              >
                {inspectedAllyUnit.location.zone === 'bench' && deployedCount < cap ? (
                  <button
                    type="button"
                    className="blc-btn blc-btn--primary blc-btn--xs"
                    onClick={() => {
                      const freeHex = [0, 1, 2, 3]
                        .flatMap((r) => [3, 2, 4, 1, 5, 0, 6].map((c) => ({ row: r, col: c })))
                        .find(
                          (pos) =>
                            !self.units.some(
                              (u) =>
                                u.location.zone === 'board' &&
                                u.location.row === pos.row &&
                                u.location.col === pos.col,
                            ),
                        );
                      if (freeHex) {
                        sendMatchCommand({
                          type: 'MOVE_UNIT',
                          instanceId: inspectedAllyUnit.instanceId,
                          to: { zone: 'board', row: freeHex.row, col: freeHex.col },
                        });
                      }
                    }}
                  >
                    快捷上阵
                  </button>
                ) : inspectedAllyUnit.location.zone === 'board' ? (
                  <button
                    type="button"
                    className="blc-btn blc-btn--metal blc-btn--xs"
                    onClick={() => {
                      const freeSlot = Array.from({ length: 9 }, (_, i) => i).find(
                        (sl) =>
                          !self.units.some(
                            (u) => u.location.zone === 'bench' && u.location.slot === sl,
                          ),
                      );
                      if (freeSlot !== undefined) {
                        sendMatchCommand({
                          type: 'MOVE_UNIT',
                          instanceId: inspectedAllyUnit.instanceId,
                          to: { zone: 'bench', slot: freeSlot },
                        });
                      }
                    }}
                  >
                    撤回备战席
                  </button>
                ) : null}

                <button
                  type="button"
                  className="blc-btn blc-btn--ghost blc-btn--xs"
                  onClick={() => {
                    sendMatchCommand({
                      type: 'SELL_UNIT',
                      instanceId: inspectedAllyUnit.instanceId,
                    });
                    clearInspectedUnit();
                  }}
                  data-testid="inspect-sell-unit-btn"
                >
                  出售 +{inspectedDef.cost * starCopies(inspectedAllyUnit.star)}金
                </button>
              </fieldset>

              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => {
                  setCodexUnitId(inspectedDef.id);
                  setCodexOpen(true);
                }}
              >
                查看列传
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {isShopExpanded ? (
        <footer
          className={`sf-shop-dock sf-shop-dock--${shopDockPosition}`}
          data-testid="strategy-shop-dock"
          data-shop-dock-position={shopDockPosition}
        >
          <div className="sf-shop-crown">
            <div className="sf-shop-crown__left">
              <span className="sf-level-pill">
                Lv.{self.level}
                <small>{xpToNext ? `${self.xp}/${xpToNext}` : '满级'}</small>
              </span>
              <span className="sf-pop-pill">
                上阵 {deployedCount}/{cap}
              </span>
              <div className="sf-odds-strip" aria-label="五阶刷牌概率">
                {shopOdds.map((pct, idx) => (
                  <span key={idx} className={`blc-odd-item--c${idx + 1}`}>
                    ●{pct}%
                  </span>
                ))}
              </div>
            </div>

            <div className="sf-shop-crown__right">
              {self.rerollVouchers > 0 ? (
                <span className="blc-chip blc-chip--gold" data-testid="free-reroll-voucher-badge">
                  免费刷新 ×{self.rerollVouchers}
                </span>
              ) : null}

              {renderWalletAndCharge()}

              <button
                type="button"
                className={`sf-shop-mini-btn ${
                  self.shopLocked ? 'sf-shop-mini-btn--locked' : ''
                }`.trim()}
                disabled={serverCommandsLocked}
                onClick={() => sendMatchCommand({ type: 'TOGGLE_LOCK_SHOP' })}
                title="锁定当前商店保留至下一准备期，跨轮后自动解锁"
                data-testid="toggle-lock-shop-btn"
              >
                {self.shopLocked ? '🔒 已锁' : '🔓 锁店'}
              </button>

              <button
                type="button"
                className="sf-shop-mini-btn sf-shop-mini-btn--gold"
                onClick={() => setShopCollapsed?.(true)}
                title="收起商店 (Space)"
                data-testid="toggle-shop-collapse-btn"
              >
                {shopDockPosition === 'top' ? '▲ 收起' : '▼ 收起'}
              </button>
            </div>
          </div>

          <fieldset
            disabled={serverCommandsLocked}
            style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
          >
            {draggingUnitId && shopDockPosition === 'bottom' ? (
              renderSellDropzone()
            ) : (
              <div className="sf-shop-main">
                <div className="sf-shop-actions">
                  <button
                    type="button"
                    className="sf-shop-act-btn"
                    disabled={self.gold < 4 || xpToNext === null}
                    onClick={() => sendMatchCommand({ type: 'BUY_XP' })}
                    data-testid="buy-xp-btn"
                    title={`获得 ${self.chosenAugments.includes('AUG_P02') ? 6 : 4} 经验 (F)`}
                  >
                    <span className="sf-shop-act-btn__label">购买经验</span>
                    <span className="sf-shop-act-btn__cost">4G</span>
                    <span className="sf-shop-xp-bar" aria-hidden="true">
                      <span
                        className="sf-shop-xp-bar__fill"
                        style={{ width: `${xpFillPct}%` }}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    className="sf-shop-act-btn sf-shop-act-btn--refresh"
                    disabled={self.rerollVouchers < 1 && self.gold < 2}
                    onClick={() => sendMatchCommand({ type: 'REFRESH_SHOP' })}
                    data-testid="refresh-shop-btn"
                    title="刷新商店 (D)"
                  >
                    <span className="sf-shop-act-btn__label">刷新商店</span>
                    <span className="sf-shop-act-btn__cost">
                      {self.rerollVouchers > 0 ? '免费' : '2G'}
                    </span>
                  </button>
                </div>

                <div className="sf-shop-cards">
                  {self.shop.map((unitId, sIdx) => {
                    if (!unitId) {
                      return (
                        <div key={sIdx} className="sf-shop-empty">
                          已购买
                        </div>
                      );
                    }
                    const def = SEASON1_UNITS_BY_ID.get(unitId);
                    if (!def) return null;
                    const preview = getShopPurchasePreview(self, sIdx);
                    const isStarUp =
                      preview.canDirectStarUp ||
                      (preview.targetStar !== null && preview.targetStar >= 2);
                    const isPair = !isStarUp && preview.ownedCount === 1;
                    const inPlanner = self.lineupPlan.includes(unitId);
                    const traits = [def.faction, def.role, ...(def.uniqueTrait ? [def.uniqueTrait] : [])];

                    return (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={!preview.canBuy}
                        className={`shop-card shop-card--cost-${def.cost} sf-shop-card ${
                          isStarUp
                            ? `sf-shop-card--starup ${
                                preview.targetStar === 3
                                  ? 'shop-card--merge-3star'
                                  : 'shop-card--merge-2star'
                              }`
                            : isPair
                              ? 'sf-shop-card--pair'
                              : ''
                        }`.trim()}
                        onClick={() => sendMatchCommand({ type: 'BUY_CARD', shopIndex: sIdx })}
                        data-testid={`shop-card-slot-${sIdx}`}
                        data-starup={isStarUp ? String(preview.targetStar ?? 2) : undefined}
                      >
                        <UnitPortrait
                          unitId={unitId}
                          size="card"
                          className="sf-shop-card__portrait"
                        />
                        <span className="sf-shop-card__scrim" aria-hidden="true" />

                        {inPlanner ? (
                          <span
                            className="shop-card__planner-bookmark"
                            title="阵容规划目标棋子"
                          />
                        ) : null}

                        {isStarUp ? (
                          <span
                            className="sf-shop-starup-badge"
                            data-testid={`shop-starup-badge-${sIdx}`}
                          >
                            {preview.targetStar === 3 ? '可升3★' : '可升星 ★'}
                          </span>
                        ) : isPair ? (
                          <span className="sf-shop-pair-badge">已有 1</span>
                        ) : null}

                        <div className="sf-shop-card__traits">
                          {traits.map((traitName) => (
                            <span
                              key={traitName}
                              className={`sf-shop-trait-pill ${
                                activeTraitNames.has(traitName) ? 'sf-shop-trait-pill--active' : ''
                              }`.trim()}
                            >
                              {traitName}
                            </span>
                          ))}
                        </div>

                        {preview.reason === 'BENCH_FULL' ? (
                          <span className="sf-shop-status-tag">备战席满</span>
                        ) : null}

                        <div className="sf-shop-card__footer">
                          <strong className="sf-shop-card__name">{def.name}</strong>
                          <span className="sf-shop-card__cost">
                            <span className="sf-gold-dot" aria-hidden="true" />
                            {def.cost}G
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>
        </footer>
      ) : null}

      {draggingUnitId && (!isShopExpanded || shopDockPosition === 'top') ? (
        <div className="sf-sell-zone-bottom">{renderSellDropzone()}</div>
      ) : null}

      {!isShopExpanded && !draggingUnitId ? (
        <div className="sf-economy-capsule" data-testid="hud-economy-capsule">
          <span className="sf-level-pill">Lv.{self.level}</span>
          <span className="sf-pop-pill">
            {deployedCount}/{cap}
          </span>
          {renderWalletAndCharge()}
          {isStrategy ? (
            <button
              type="button"
              className="sf-economy-capsule__expand"
              onClick={() => setShopCollapsed?.(false)}
              title="展开商店 (Space)"
              data-testid="toggle-shop-collapse-btn"
            >
              展开商店
            </button>
          ) : null}
        </div>
      ) : null}

      {isStrategy && shopCollapsed && shopDockPosition === 'top' ? (
        <button
          type="button"
          className="sf-floating-shop-fab"
          onClick={() => setShopCollapsed?.(false)}
          title="展开顶部商店 (Space)"
          data-testid="floating-shop-toggle-btn"
        >
          <span className="sf-floating-shop-fab__gold">{self.gold}G</span>
          <span className="sf-floating-shop-fab__label">商店</span>
        </button>
      ) : null}

      {matchSnapshot.phase === 'entry' ? (
        <div
          className="blc-center-float"
          data-testid="entry-briefing-banner"
          data-season-term-id={matchSnapshot.versionLock.seasonTermId}
          data-game-set-version={matchSnapshot.versionLock.gameSetVersion}
          data-course-pack-version={matchSnapshot.versionLock.coursePackVersion}
        >
          <div className="ui-metal-frame blc-micro-dialog">
            <h3>准备就绪</h3>
            <p>即将开始第一节学习</p>
          </div>
        </div>
      ) : null}

      {matchSnapshot.phase === 'resource' && matchSnapshot.resourceSettlement ? (
        <div className="blc-center-float" data-testid="resource-settlement-banner">
          <div className="ui-metal-frame sf-resource-dialog">
            <h3 style={{ margin: '0 0 10px', color: 'var(--accent-gold-bright)' }}>
              节点 {matchSnapshot.resourceSettlement.nodeIndex + 1} 科研结算
            </h3>
            <dl className="blc-resource-facts">
              <div>
                <dt>法球金币</dt>
                <dd>+{matchSnapshot.resourceSettlement.grantedIntegerGold}G</dd>
              </div>
              <div>
                <dt>结余充能</dt>
                <dd>{matchSnapshot.resourceSettlement.carryOutCents}/100</dd>
              </div>
            </dl>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              本节充能 {matchSnapshot.resourceSettlement.rawEarnedCents} · 结转{' '}
              {matchSnapshot.resourceSettlement.carryInCents}
            </p>
          </div>
        </div>
      ) : null}

      {matchSnapshot.phase === 'rest' ? (
        <div className="learning-briefing-backdrop" data-testid="deep-mode-rest-overlay">
          <div className="ui-metal-frame blc-micro-dialog">
            <h3>休息片刻</h3>
            <p>
              <strong>{formatMMSS(liveRemainingSec)}</strong> 后继续
            </p>
          </div>
        </div>
      ) : null}

      {hasChoiceModal && !peekingBattlefield ? (
        <MatchChoiceModal
          showAugmentChoice={showAugmentChoice}
          self={self}
          liveRemainingSec={liveRemainingSec}
          serverCommandsLocked={serverCommandsLocked}
          onPeekBattlefield={() => setPeekingBattlefield(true)}
          onSendCommand={sendMatchCommand}
        />
      ) : null}

      {matchSnapshot.phase === 'learning' && matchSnapshot.learning ? (
        <div className="learning-briefing-backdrop" data-testid="inmatch-learning-overlay">
          <div className="sf-learning-overlay-shell">
            <div className="sf-learning-card-host">
              {(() => {
                const lrn = matchSnapshot.learning;
                const review =
                  learningReview?.phaseIndex === matchSnapshot.phaseIndex ? learningReview : null;
                const currentStepKind =
                  review?.question.stepRole ?? lrn.currentStep ?? 'verification';
                const activeStepObj = lrn.steps.find((s) => s.kind === currentStepKind);
                const unsubmittedQuestions = lrn.clientQuestions.filter(
                  (q) => !lrn.submittedQuestionIds.includes(q.questionId),
                );
                const currentQuestion =
                  review?.question ?? (lrn.complete ? null : unsubmittedQuestions[0] ?? null);
                const currentFeedbackRaw =
                  review?.feedback ??
                  (currentQuestion ? lrn.feedback[currentQuestion.questionId] : undefined);
                const fbView: QuestionFeedbackView | null = currentFeedbackRaw
                  ? {
                      isCorrect: currentFeedbackRaw.isCorrect,
                      isSkipped: currentFeedbackRaw.isSkipped,
                      quality: currentFeedbackRaw.quality,
                      explanationMd: currentFeedbackRaw.explanationMd,
                      stepResults: currentFeedbackRaw.stepResults,
                    }
                  : null;

                const progressItems: LessonStepProgressItem[] = lrn.steps.map((st) => {
                  const currentIdx = lrn.steps.findIndex((x) => x.kind === currentStepKind);
                  const thisIdx = lrn.steps.indexOf(st);
                  return {
                    kind: st.kind,
                    label: STEP_LABELS[st.kind],
                    status:
                      lrn.complete || thisIdx < currentIdx
                        ? 'done'
                        : thisIdx === currentIdx
                          ? 'active'
                          : 'upcoming',
                  };
                });

                const materialMd =
                  activeStepObj?.materials.map((m) => m.materialMd).join('\n\n---\n\n') ?? '';
                const remediationItems =
                  activeStepObj?.corrections.map((c) => ({
                    questionId: c.questionId,
                    stemMd: '结算题 · 错因分析',
                    explanationMd: c.explanationMd,
                  })) ?? [];

                return (
                  <QuestionStepCard
                    stepKind={currentStepKind}
                    stepsProgress={progressItems}
                    question={currentQuestion}
                    lessonMaterialMd={materialMd}
                    lessonTitle={`学习节点 ${lrn.nodeIndex + 1} · ${
                      modeSpec.learning_detail[lrn.nodeIndex]?.goal ?? '核心概念与迁移'
                    }`}
                    remediationItems={remediationItems}
                    feedback={fbView}
                    sharedRemainingSeconds={Math.ceil(liveRemainingSec)}
                    sharedTotalSeconds={totalPhaseSec}
                    isWaitingForRoomDeadline={lrn.complete && !review}
                    canProceedEarly={lrn.complete && !review && !lrn.readyToProceed}
                    waitingMessage={
                      lrn.readyToProceed && (lrn.totalHumansCount ?? 1) > 1
                        ? `等待其他玩家完成（${lrn.readyHumansCount ?? 1}/${lrn.totalHumansCount ?? 1}）`
                        : lrn.readyToProceed
                          ? '正在结算奖励并进入策略阶段…'
                          : '本节学习已完成，点击下方按钮立即进入策略阶段'
                    }
                    nextStepLabel={lrn.complete ? '进入策略阶段' : '下一步'}
                    readOnly={Boolean(review)}
                    variant="overlay"
                    audioBus={audioBus}
                    onSubmitAnswer={submitLearningAnswer}
                    onSkipQuestion={submitLearningAnswer}
                    onAdvanceStep={() => {
                      if (review) {
                        setLearningReview(null);
                        if (lrn.complete) advanceLearningStep();
                      } else if (
                        lrn.complete ||
                        currentStepKind === 'material' ||
                        currentStepKind === 'remediation'
                      ) {
                        advanceLearningStep();
                      }
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {plannerOpen ? (
        <MatchLineupPlannerModal
          lineupPlan={self.lineupPlan}
          plannedTraits={plannedTraits}
          serverCommandsLocked={serverCommandsLocked}
          onClearPlan={() => sendMatchCommand({ type: 'SET_LINEUP_PLAN', unitIds: [] })}
          onToggleUnit={togglePlannerUnit}
          onClose={() => setPlannerOpen(false)}
        />
      ) : null}

      {codexOpen ? (
        <MatchCodexModal
          codexUnitId={codexUnitId}
          ownedComponentIds={self.inventoryItems}
          audioBus={audioBus}
          onSelectUnit={setCodexUnitId}
          onClose={() => setCodexOpen(false)}
        />
      ) : null}

      {isStrategy && self.units.length > 0 ? (
        <div
          className={`blc-ally-quick-strip ${!isBottomOpen ? 'blc-ally-quick-strip--low' : ''}`.trim()}
          aria-label="本方棋子快捷检视栏"
        >
          {self.units.slice(0, 8).map((u) => {
            const d = SEASON1_UNITS_BY_ID.get(u.unitId);
            return (
              <button
                key={u.instanceId}
                type="button"
                className={`blc-unit-pill ${
                  inspectedUnitId === u.instanceId ? 'blc-unit-pill--active' : ''
                }`}
                onClick={() =>
                  setInspectedUnitManual(
                    inspectedUnitId === u.instanceId ? null : u.instanceId,
                  )
                }
              >
                {'★'.repeat(u.star)}
                {d?.name ?? '棋子'}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
