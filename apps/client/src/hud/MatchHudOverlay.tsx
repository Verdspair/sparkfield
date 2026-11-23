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
  type UnitDef,
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
  DescriptionModeToggle,
  GameEffectText,
  GameItemIcon,
  QuestionStepCard,
  StatInlineIcon,
  type LessonStepProgressItem,
  type QuestionAnswerSubmission,
  type QuestionFeedbackView,
} from '@pkg/learning-ui';
import type { MatchLearningFeedbackItem, MatchRoomSnapshot } from '../api/matchSocket.js';
import { TacticianPortrait, UnitPortrait } from '../components/UnitPortrait.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_LABELS,
  QUEUE_TYPE_LABELS,
  formatQuarterPoints,
} from '../utils/antiFakeZero.js';
import { GameUiIcon, TraitGlyphIcon } from '../components/GameUiIcons.js';
import { LearningRewardBanner } from './LearningRewardBanner.js';
import {
  MatchChoiceModal,
  MatchCodexModal,
  MatchLineupPlannerModal,
} from './MatchModals.js';
import './matchHud.css';

const ALL_CRAFT_COMPONENT_IDS: readonly string[] = [
  ...SEASON1_ITEMS.components.map((c) => c.id),
  SEASON1_ITEMS.special.spatulaComponent.id,
];

type PositioningIconKind = 'shield' | 'blade' | 'reticle' | 'cross' | 'spark';
type PositioningTone = 'tank' | 'assassin' | 'support' | 'phys' | 'magic';

interface UnitPositioningInfo {
  readonly label: string;
  readonly tone: PositioningTone;
  readonly iconKind: PositioningIconKind;
}

const PHYSICAL_MATRIX_UNIT_IDS = new Set(['S22', 'S23', 'S28']);

function resolveUnitPositioning(
  def: Pick<UnitDef, 'id' | 'role' | 'stats' | 'skillSummary'>,
): UnitPositioningInfo {
  const rowLabel =
    def.stats.range <= 1 ? '前排' : def.stats.range <= 2 ? '中排' : '后排';
  const isPhysical =
    PHYSICAL_MATRIX_UNIT_IDS.has(def.id) ||
    def.skillSummary.includes('物理') ||
    def.skillSummary.includes('重炮');

  switch (def.role) {
    case '重装':
      return { label: `${rowLabel} · 坦克`, tone: 'tank', iconKind: 'shield' };
    case '维生':
      return { label: `${rowLabel} · 治疗辅助`, tone: 'support', iconKind: 'cross' };
    case '跃迁':
      return { label: `${rowLabel} · 突进刺客`, tone: 'assassin', iconKind: 'blade' };
    case '磁轨':
      return { label: `${rowLabel} · 物理输出`, tone: 'phys', iconKind: 'reticle' };
    case '光子':
      return { label: `${rowLabel} · 法术输出`, tone: 'magic', iconKind: 'spark' };
    case '矩阵':
      return isPhysical
        ? { label: `${rowLabel} · 物理破甲`, tone: 'phys', iconKind: 'reticle' }
        : { label: `${rowLabel} · 法术控场`, tone: 'magic', iconKind: 'spark' };
    default:
      return isPhysical
        ? { label: `${rowLabel} · 物理输出`, tone: 'phys', iconKind: 'reticle' }
        : { label: `${rowLabel} · 法术输出`, tone: 'magic', iconKind: 'spark' };
  }
}

function PositioningIcon({ kind }: { readonly kind: PositioningIconKind }): React.JSX.Element {
  return (
    <svg
      className="sf-inspect-pos-icon"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      {kind === 'shield' ? (
        <path
          d="M6 1.2L10 2.9V6.2C10 8.5 8.3 10.1 6 10.9C3.7 10.1 2 8.5 2 6.2V2.9L6 1.2Z"
          fill="currentColor"
          fillOpacity="0.26"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ) : null}
      {kind === 'blade' ? (
        <g>
          <path d="M10.2 1.8L5 7L3.8 5.8L8.6 1.8H10.2Z" fill="currentColor" />
          <path d="M3.2 6.4L5.6 8.8M4 8L2 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ) : null}
      {kind === 'reticle' ? (
        <g>
          <circle cx="6" cy="6" r="3.4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          <path d="M6 1.1V2.6M6 9.4V10.9M1.1 6H2.6M9.4 6H10.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ) : null}
      {kind === 'cross' ? (
        <path
          d="M6 2.1V9.9M2.1 6H9.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : null}
      {kind === 'spark' ? (
        <path
          d="M6 1.1L7.3 4.7L10.9 6L7.3 7.3L6 10.9L4.7 7.3L1.1 6L4.7 4.7Z"
          fill="currentColor"
        />
      ) : null}
    </svg>
  );
}

function RangeStatIcon(): React.JSX.Element {
  return (
    <svg
      className="lui-stat-icon"
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      <path
        d="M8 1.5V3.5M8 12.5V14.5M1.5 8H3.5M12.5 8H14.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ITEM_KIND_LABELS: Readonly<Record<string, string>> = {
  component: '散件',
  spatula: '星环拓片',
  completed: '成装',
  emblem: '纹章',
  flag: '母舰旗',
};

function isCraftComponentKind(kind: string | undefined): boolean {
  return kind === 'component' || kind === 'spatula';
}

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

type ItemDragPayload =
  | { readonly kind: 'equip'; readonly inventoryItemIndex: number; readonly itemId: string }
  | { readonly kind: 'remover'; readonly itemId: 'TOOL_MAGNETIC_REMOVER' }
  | { readonly kind: 'reforger'; readonly itemId: 'TOOL_REFORGER' };

interface ActiveItemDrag {
  readonly pointerId: number;
  readonly payload: ItemDragPayload;
  readonly startX: number;
  readonly startY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly dragging: boolean;
  readonly targetUnitId: string | null;
  readonly targetScreenX: number;
  readonly targetScreenY: number;
}

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

function hasReforgeableUnitItem(unit: UnitInstance): boolean {
  return unit.items.some((itemId) => {
    const kind = lookupItemById(itemId)?.kind;
    return kind === 'component' || kind === 'completed' || kind === 'emblem';
  });
}

function describeEquipBlockReason(reason: string | undefined): string {
  switch (reason) {
    case 'item-slots-full':
      return '装备槽已满 (3/3)';
    case 'duplicate-unique-item':
      return '不可重复佩戴唯一装备';
    case 'one-emblem-per-unit':
      return '每枚棋子限戴 1 件纹章';
    case 'unit-frozen':
      return '棋子休眠冻结中';
    default:
      return '当前不可佩戴';
  }
}

function isInteractivePrepPhase(
  snapshot: MatchRoomSnapshot | null,
  hasChoiceModal: boolean,
): boolean {
  if (!snapshot) return false;
  return (
    snapshot.phase === 'strategy' ||
    snapshot.phase === 'entry' ||
    snapshot.phase === 'resource' ||
    snapshot.phase === 'rest' ||
    (snapshot.phase === 'choice' && !hasChoiceModal) ||
    (snapshot.phase === 'learning' && Boolean(snapshot.learning?.complete))
  );
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
  const [codexInitialTab, setCodexInitialTab] = useState<'items' | 'units'>('units');
  const [codexInitialItemId, setCodexInitialItemId] = useState<string | null>(null);
  const [hoveredBagIndex, setHoveredBagIndex] = useState<number | null>(null);
  const [hoveredCraftPartnerId, setHoveredCraftPartnerId] = useState<string | null>(null);
  const [hoveredInspectItemId, setHoveredInspectItemId] = useState<string | null>(null);
  const [expandedTraitName, setExpandedTraitName] = useState<string | null>(null);

  const [itemDrag, setItemDrag] = useState<ActiveItemDrag | null>(null);
  const itemDragRef = useRef<ActiveItemDrag | null>(null);
  itemDragRef.current = itemDrag;
  const suppressSlotClickRef = useRef<boolean>(false);

  const modeSpecTop = matchSnapshot ? MODE_BUDGETS.modes[matchSnapshot.mode] : null;
  const timelineEventTop =
    matchSnapshot && modeSpecTop ? modeSpecTop.timeline[matchSnapshot.phaseIndex] : undefined;
  const choiceKindTop = matchSnapshot
    ? getMatchChoiceKind(matchSnapshot.phase, timelineEventTop?.label ?? '')
    : null;
  const showAugmentChoiceTop =
    choiceKindTop === 'augment' && Boolean(matchSnapshot?.self.augmentOffer);
  const activeAnvilTop = matchSnapshot?.self.anvils[0] ?? null;
  const showAnvilChoiceTop = choiceKindTop === 'anvil' && Boolean(activeAnvilTop);
  const hasChoiceModalTop = showAugmentChoiceTop || showAnvilChoiceTop;
  const isStrategyTop = isInteractivePrepPhase(matchSnapshot, hasChoiceModalTop);

  const [targetAction, setTargetAction] = useState<TargetAction | null>(null);
  const activeTargetAction =
    isStrategyTop && matchSnapshot && targetAction?.phaseIndex === matchSnapshot.phaseIndex
      ? targetAction
      : null;
  const pendingEquipIndex =
    activeTargetAction?.kind === 'equip' ? activeTargetAction.inventoryItemIndex : null;
  const pendingTool =
    activeTargetAction?.kind === 'remover' || activeTargetAction?.kind === 'reforger'
      ? activeTargetAction.kind
      : null;

  const [learningReview, setLearningReview] = useState<{
    nodeIndex: number;
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
    setHoveredBagIndex(null);
    setHoveredCraftPartnerId(null);
    setItemDrag(null);
    getStageEngine()?.setItemDropTargetUnit(null);
    if (
      !matchSnapshot ||
      matchSnapshot.phase === 'battle' ||
      matchSnapshot.phase === 'settlement' ||
      matchSnapshot.phase === 'exit'
    ) {
      setLearningReview(null);
    } else {
      setLearningReview((current) =>
        current && current.nodeIndex !== matchSnapshot.nodeIndex ? null : current,
      );
    }
    if (matchSnapshot?.phase === 'battle') {
      setRightTab('score');
    }
  }, [matchSnapshot?.phase, matchSnapshot?.phaseIndex, matchSnapshot?.nodeIndex, getStageEngine]);

  useEffect(() => {
    if (leftTab !== 'items') {
      setHoveredBagIndex(null);
      setHoveredCraftPartnerId(null);
    }
  }, [leftTab]);

  useEffect(() => {
    setHoveredCraftPartnerId(null);
  }, [hoveredBagIndex, pendingEquipIndex]);

  useEffect(() => {
    return () => {
      getStageEngine()?.setItemDropTargetUnit(null);
    };
  }, [getStageEngine]);

  useEffect(() => {
    setHoveredInspectItemId(null);
  }, [inspectedUnitId]);

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
    if (!isStrategyTop || serverCommandsLocked) {
      if (itemDragRef.current) {
        getStageEngine()?.setItemDropTargetUnit(null);
        setItemDrag(null);
      }
    }
  }, [isStrategyTop, serverCommandsLocked, getStageEngine]);

  const hasActiveItemDrag = itemDrag !== null;
  useEffect(() => {
    if (!hasActiveItemDrag) return;
    const handleMove = (event: PointerEvent) => {
      const current = itemDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      const nowDragging = current.dragging || moved >= 6;
      if (!nowDragging) return;
      if (!current.dragging) {
        setHoveredBagIndex(null);
        setHoveredCraftPartnerId(null);
        clearInspectedUnit();
      }
      const stage = getStageEngine();
      const hit = stage?.pickAllyUnitAtClientPoint(event.clientX, event.clientY) ?? null;
      stage?.setItemDropTargetUnit(hit?.instanceId ?? null);
      setItemDrag({
        ...current,
        clientX: event.clientX,
        clientY: event.clientY,
        dragging: true,
        targetUnitId: hit?.instanceId ?? null,
        targetScreenX: hit?.screenX ?? event.clientX,
        targetScreenY: hit?.screenY ?? event.clientY,
      });
    };

    const handleEnd = (event: PointerEvent) => {
      const current = itemDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const stage = getStageEngine();
      stage?.setItemDropTargetUnit(null);
      if (current.dragging && event.type === 'pointerup') {
        suppressSlotClickRef.current = true;
        window.setTimeout(() => {
          suppressSlotClickRef.current = false;
        }, 0);
        const finalHit = stage?.pickAllyUnitAtClientPoint(event.clientX, event.clientY) ?? null;
        const dropUnitId = finalHit?.instanceId ?? current.targetUnitId;
        if (dropUnitId && matchSnapshot) {
          const targetUnit = matchSnapshot.self.units.find((u) => u.instanceId === dropUnitId);
          if (targetUnit) {
            if (current.payload.kind === 'equip') {
              const preview = previewItemEquip(targetUnit, current.payload.itemId);
              if (preview.ok) {
                sendMatchCommand({
                  type: 'EQUIP_ITEM',
                  inventoryItemIndex: current.payload.inventoryItemIndex,
                  targetInstanceId: dropUnitId,
                });
                setTargetAction(null);
              }
            } else if (current.payload.kind === 'remover') {
              if (
                targetUnit.frozenUntilRound === null &&
                targetUnit.items.length > 0 &&
                matchSnapshot.self.magneticCharges >= 1
              ) {
                sendMatchCommand({
                  type: 'USE_MAGNETIC_REMOVER',
                  targetInstanceId: dropUnitId,
                });
                setTargetAction(null);
              }
            } else if (current.payload.kind === 'reforger') {
              if (
                targetUnit.frozenUntilRound === null &&
                hasReforgeableUnitItem(targetUnit) &&
                matchSnapshot.self.reforgerCharges >= 1
              ) {
                sendMatchCommand({
                  type: 'USE_REFORGER',
                  targetInstanceId: dropUnitId,
                });
                setTargetAction(null);
              }
            }
          }
        }
      }
      setItemDrag(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [hasActiveItemDrag, matchSnapshot, getStageEngine, sendMatchCommand, clearInspectedUnit]);

  useEffect(() => {
    if (!matchSnapshot || !modeSpecTop) return;
    const inStrategyWindow = isStrategyTop;
    const modalBlocking =
      (matchSnapshot.phase === 'learning' && !matchSnapshot.learning?.complete) ||
      hasChoiceModalTop;
    const xpCapReached = matchSnapshot.self.level >= modeSpecTop.economy.base_level_cap;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableEventTarget(event.target)) return;

      if (event.code === 'Space' && inStrategyWindow && !modalBlocking && !plannerOpen && !codexOpen) {
        event.preventDefault();
        setShopCollapsed?.(!shopCollapsed);
        return;
      }

      if (event.key === 'Escape') {
        if (itemDragRef.current) {
          getStageEngine()?.setItemDropTargetUnit(null);
          setItemDrag(null);
        } else if (activeTargetAction) {
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
        inStrategyWindow &&
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
    modeSpecTop,
    isStrategyTop,
    hasChoiceModalTop,
    getStageEngine,
  ]);

  const activeBattleTop =
    matchSnapshot?.phase === 'battle' ? (matchSnapshot.battle ?? null) : null;
  const elapsedBattleScaledMsTop =
    activeBattleTop?.startedAtEpochMs !== undefined
      ? Math.max(0, (nowMs - activeBattleTop.startedAtEpochMs) / (activeBattleTop.timeScale ?? 1))
      : null;
  const isBattleOvertimeTop =
    elapsedBattleScaledMsTop !== null &&
    Boolean(activeBattleTop?.overtimeAtMs) &&
    elapsedBattleScaledMsTop >= activeBattleTop!.overtimeAtMs! &&
    (!activeBattleTop?.longestBattleMs || elapsedBattleScaledMsTop < activeBattleTop.longestBattleMs);
  const myRoundBattleTop =
    matchSnapshot && activeBattleTop
      ? activeBattleTop.battles.find(
          (b) => b.leftSeatId === matchSnapshot.seatId || b.rightSeatId === matchSnapshot.seatId,
        ) ?? null
      : null;
  const inLearningFocus = Boolean(
    matchSnapshot &&
      ((matchSnapshot.phase === 'learning' && !matchSnapshot.learning?.complete) ||
        (learningReview &&
          learningReview.nodeIndex === matchSnapshot.nodeIndex &&
          !['battle', 'settlement', 'exit'].includes(matchSnapshot.phase))),
  );

  useEffect(() => {
    if (!matchSnapshot || !modeSpecTop) return;
    audioBus.emit('onBgmContext', {
      scene: 'match',
      roundIndex: matchSnapshot.round,
      totalRounds: modeSpecTop.rounds,
      phase: matchSnapshot.phase,
      isOvertime: isBattleOvertimeTop,
      focusDuck: inLearningFocus,
    });
  }, [
    audioBus,
    inLearningFocus,
    isBattleOvertimeTop,
    matchSnapshot?.phase,
    matchSnapshot?.round,
    modeSpecTop,
  ]);

  const audioMatchIdRef = useRef<string>('');
  const audioPrevLevelRef = useRef<number | null>(null);
  const audioPrevPhaseRef = useRef<string | null>(null);
  const audioAnnouncedRoundRef = useRef<number | null>(null);
  const audioLastBattleRef = useRef<{
    round: number;
    outcome: 'win' | 'draw' | 'loss';
    elapsedMs: number;
  } | null>(null);

  useEffect(() => {
    if (!matchSnapshot) {
      audioMatchIdRef.current = '';
      audioPrevLevelRef.current = null;
      audioPrevPhaseRef.current = null;
      audioAnnouncedRoundRef.current = null;
      audioLastBattleRef.current = null;
      return;
    }

    if (audioMatchIdRef.current !== matchSnapshot.matchId) {
      audioMatchIdRef.current = matchSnapshot.matchId;
      audioPrevLevelRef.current = matchSnapshot.self.level;
      audioPrevPhaseRef.current = matchSnapshot.phase;
      audioAnnouncedRoundRef.current = null;
      audioLastBattleRef.current = null;
    }

    if (audioPrevLevelRef.current !== null && matchSnapshot.self.level > audioPrevLevelRef.current) {
      audioBus.emit('onShopAction', { action: 'level_up' });
    }
    audioPrevLevelRef.current = matchSnapshot.self.level;

    if (myRoundBattleTop) {
      const res = myRoundBattleTop.result;
      const myOutcome: 'win' | 'draw' | 'loss' =
        res.outcome === 'draw'
          ? 'draw'
          : res.winnerSeatId === matchSnapshot.seatId
            ? 'win'
            : 'loss';
      audioLastBattleRef.current = {
        round: matchSnapshot.round,
        outcome: myOutcome,
        elapsedMs: res.elapsedMs,
      };
    }

    const prevPhase = audioPrevPhaseRef.current;
    if (prevPhase !== matchSnapshot.phase) {
      if (matchSnapshot.phase === 'battle') {
        audioBus.emit('onBattleStart', {
          roundIndex: matchSnapshot.round,
          isPve: myRoundBattleTop?.pve ?? false,
        });
      } else {
        if (
          prevPhase === 'battle' &&
          audioLastBattleRef.current &&
          audioAnnouncedRoundRef.current !== audioLastBattleRef.current.round
        ) {
          audioAnnouncedRoundRef.current = audioLastBattleRef.current.round;
          audioBus.emit('onRoundResult', {
            outcome: audioLastBattleRef.current.outcome,
            quarterPointsEarned: matchSnapshot.self.victoryPoints,
          });
        }
        audioBus.emit('onPhaseChange', {
          phase: matchSnapshot.phase,
          roundIndex: matchSnapshot.round,
        });
      }
    }

    if (
      matchSnapshot.phase === 'battle' &&
      elapsedBattleScaledMsTop !== null &&
      audioLastBattleRef.current &&
      audioLastBattleRef.current.round === matchSnapshot.round &&
      elapsedBattleScaledMsTop >= audioLastBattleRef.current.elapsedMs &&
      audioAnnouncedRoundRef.current !== matchSnapshot.round
    ) {
      audioAnnouncedRoundRef.current = matchSnapshot.round;
      audioBus.emit('onRoundResult', {
        outcome: audioLastBattleRef.current.outcome,
        quarterPointsEarned: matchSnapshot.self.victoryPoints,
      });
    }

    audioPrevPhaseRef.current = matchSnapshot.phase;
  }, [audioBus, elapsedBattleScaledMsTop, matchSnapshot, myRoundBattleTop]);

  if (!matchSnapshot) return null;

  const self = matchSnapshot.self;
  const modeSpec = modeSpecTop!;
  const timelineEvent = timelineEventTop;
  const activeBattle = matchSnapshot.phase === 'battle' ? (matchSnapshot.battle ?? null) : null;
  const totalPhaseSec =
    activeBattle?.startedAtEpochMs &&
    matchSnapshot.deadlineEpochMs > activeBattle.startedAtEpochMs
      ? Math.max(1, (matchSnapshot.deadlineEpochMs - activeBattle.startedAtEpochMs) / 1000)
      : (timelineEvent?.duration ?? 50);
  const elapsedBattleScaledMs =
    activeBattle?.startedAtEpochMs !== undefined
      ? Math.max(0, (nowMs - activeBattle.startedAtEpochMs) / (activeBattle.timeScale ?? 1))
      : null;
  const isBattleOvertime =
    elapsedBattleScaledMs !== null &&
    Boolean(activeBattle?.overtimeAtMs) &&
    elapsedBattleScaledMs >= activeBattle!.overtimeAtMs! &&
    (!activeBattle?.longestBattleMs || elapsedBattleScaledMs < activeBattle.longestBattleMs);
  const isBattleAllFinished =
    elapsedBattleScaledMs !== null &&
    Boolean(activeBattle?.longestBattleMs) &&
    elapsedBattleScaledMs >= activeBattle!.longestBattleMs!;
  const liveRemainingSec = Math.max(0, (matchSnapshot.deadlineEpochMs - nowMs) / 1000);
  const progressPct =
    totalPhaseSec > 0
      ? Math.max(0, Math.min(100, ((totalPhaseSec - liveRemainingSec) / totalPhaseSec) * 100))
      : 0;

  const isStrategy = isStrategyTop;
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

  const showAugmentChoice = showAugmentChoiceTop;
  const hasChoiceModal = hasChoiceModalTop;

  const beginItemPointerDrag = (event: React.PointerEvent, payload: ItemDragPayload) => {
    if (serverCommandsLocked || !isStrategy) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    suppressSlotClickRef.current = false;
    setItemDrag({
      pointerId: event.pointerId,
      payload,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      dragging: false,
      targetUnitId: null,
      targetScreenX: event.clientX,
      targetScreenY: event.clientY,
    });
  };

  const openCodex = (tab: 'items' | 'units', itemId: string | null = null) => {
    audioBus.emit('onUiFeedback', { kind: 'open' });
    setCodexInitialTab(tab);
    setCodexInitialItemId(itemId);
    setCodexOpen(true);
  };

  const armTargetAction = (action: TargetAction) => {
    audioBus.emit('onUiFeedback', { kind: 'click' });
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
    const review = { nodeIndex: matchSnapshot.nodeIndex, question, feedback: null };
    setLearningReview(review);
    void sendMatchLearningSubmit(submission.questionId, {
      answer: submission.answer,
      status: submission.status,
      questionId: submission.questionId,
      hintUsed: submission.hintUsed,
    })
      .then((ack) => {
        if (!ack.ok) throw new Error(ack.reason ?? 'LEARNING_SUBMISSION_REJECTED');
        if (ack.feedback && !ack.feedback.isSkipped) {
          audioBus.emit('onLearningFeedback', { correct: ack.feedback.isCorrect });
        }
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

  const interestCap = modeSpec.economy.interest_cap;
  const nextInterestAt = Math.min(interestCap * 10, (interestPreview + 1) * 10);

  const renderWalletAndCharge = () => (
    <>
      <div
        className="sf-wallet-pill"
        data-testid="hud-integer-gold"
        title={`当前利息 +${interestPreview}G（每满 10G +1，上限 +${interestCap}G；下回合基础收入 +${modeSpec.economy.base_income}G${interestPreview < interestCap ? `；再存 ${Math.max(0, nextInterestAt - self.gold)}G 可达下一档` : '；已达满额利息'}）`}
      >
        <GameUiIcon name="coin" size={16} className="sf-wallet-coin-icon" />
        <span
          className="gold-roller"
          style={{
            fontSize: 16,
            transform: goldRolling ? 'translateY(-1px) scale(1.06)' : 'none',
          }}
        >
          {self.gold}G
        </span>
        <span className="sf-interest-group" data-testid="hud-interest-pips">
          <span className="sf-interest-pips" aria-hidden="true">
            {Array.from({ length: interestCap }, (_, idx) => (
              <span
                key={idx}
                className={`sf-interest-pip ${idx < interestPreview ? 'sf-interest-pip--lit' : ''}`.trim()}
              />
            ))}
          </span>
          <span className={`sf-interest-label ${interestPreview > 0 ? 'sf-interest-label--lit' : ''}`.trim()}>
            利息 +{interestPreview}
          </span>
        </span>
      </div>

      <div
        className="sf-charge-pill"
        title={`学习金币充能 ${self.learningChargeCents}/100：每次答题不足 1G 的余数将自动结转累计，满 100 时在下一次学习结算额外掉落 +1G 战利品法球`}
        data-testid="hud-science-charge-ring"
      >
        <GameUiIcon name="spark" size={14} className="sf-charge-icon" />
        <span className="sf-charge-label">充能</span>
        <span className="sf-charge-bar" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, self.learningChargeCents))}%` }} />
        </span>
        <span className="sf-charge-value">{self.learningChargeCents}/100</span>
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

  const activeBagIndex =
    leftTab === 'items'
      ? hoveredBagIndex !== null && hoveredBagIndex < self.inventoryItems.length
        ? hoveredBagIndex
        : pendingEquipIndex !== null && pendingEquipIndex < self.inventoryItems.length
          ? pendingEquipIndex
          : null
      : null;
  const activeBagItemId =
    activeBagIndex !== null ? self.inventoryItems[activeBagIndex] ?? null : null;
  const activeBagEntry = activeBagItemId ? lookupItemById(activeBagItemId) : null;
  const armedItemId =
    pendingEquipIndex !== null ? self.inventoryItems[pendingEquipIndex] ?? null : null;
  const armedItemEntry = armedItemId ? lookupItemById(armedItemId) : null;

  const otherBagIds =
    activeBagIndex !== null
      ? self.inventoryItems.filter((_, index) => index !== activeBagIndex)
      : [];
  const otherBagIdSet = new Set(otherBagIds);
  const craftableNow =
    activeBagItemId && isCraftComponentKind(activeBagEntry?.kind)
      ? Array.from(otherBagIdSet)
          .map((partnerId) => {
            const result = lookupCraftRecipe(activeBagItemId, partnerId);
            return result ? { partnerId, result } : null;
          })
          .filter(
            (
              row,
            ): row is {
              partnerId: string;
              result: NonNullable<ReturnType<typeof lookupCraftRecipe>>;
            } => row !== null,
          )
      : [];

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
            <span className="blc-chip" style={{ borderColor: 'var(--semantic-warning)', color: 'var(--text-primary)' }}>
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
            {isBattleOvertime ? (
              <span
                data-testid="battle-overtime-badge"
                style={{
                  padding: '1px 7px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  background: '#30252a',
                  border: '1px solid rgba(251, 191, 36, 0.85)',
                  color: '#ddca9f',
                  boxShadow: '0 0 10px rgba(244, 63, 94, 0.35)',
                  whiteSpace: 'nowrap',
                }}
              >
                极速加时
              </span>
            ) : isBattleAllFinished ? (
              <span
                data-testid="battle-finished-badge"
                style={{
                  padding: '1px 7px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  background: '#25322e',
                  border: '1px solid rgba(114,163,138, 0.72)',
                  color: '#d1fae5',
                  whiteSpace: 'nowrap',
                }}
              >
                全员完赛
              </span>
            ) : null}
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
          {isOfflineSandboxMatch && matchSnapshot.phase !== 'battle' ? (
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
            onClick={() => { audioBus.emit('onUiFeedback', { kind: 'open' }); setPlannerOpen(true); }}
            data-testid="open-lineup-planner-btn"
          >
            阵容 {self.lineupPlan.length}/{LINEUP_PLANNER_MAX_SLOTS}
          </button>

          <button
            type="button"
            className="ui-metal-frame blc-btn blc-btn--metal blc-btn--sm"
            onClick={() => openCodex(leftTab === 'items' ? 'items' : 'units', null)}
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
            <GameUiIcon name="gear" size={14} />
            <span>设置</span>
          </button>
        </div>
      </header>

      <LearningRewardBanner snapshot={matchSnapshot} />

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
        onMouseLeave={() => setHoveredBagIndex(null)}
      >
        <div className="sf-rail-tabs" role="tablist" aria-label="战术侧栏">
          <button
            type="button"
            role="tab"
            aria-selected={leftTab === 'traits'}
            className={`sf-rail-tab ${leftTab === 'traits' ? 'sf-rail-tab--active' : ''}`}
            onClick={() => { audioBus.emit('onUiFeedback', { kind: 'click' }); setLeftTab('traits'); }}
            data-testid="hud-left-traits-tab"
          >
            羁绊 ({activeTraits.filter((t) => t.activeTier > 0).length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={leftTab === 'items'}
            className={`sf-rail-tab ${leftTab === 'items' ? 'sf-rail-tab--active' : ''}`}
            onClick={() => { audioBus.emit('onUiFeedback', { kind: 'click' }); setLeftTab('items'); }}
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
                        className={`blc-trait-row ${
                          tr.activeTier > 0 ? `blc-trait-row--active blc-trait-row--${tierStyle}` : ''
                        }`.trim()}
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
                          <TraitGlyphIcon traitName={tr.traitName} size={14} />
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
                        <span className={`sf-trait-count ${tr.activeTier > 0 ? 'sf-trait-count--active' : ''}`.trim()}>
                          {tr.count}
                        </span>
                      </button>

                      {isOpen && rawDef ? (
                        <div className="ui-frosted-panel blc-trait-pop">
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 6,
                              marginBottom: 6,
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 11.5, flex: 1 }}>
                              <GameEffectText traitName={tr.traitName} fullText={rawDef.desc} />
                            </p>
                            <DescriptionModeToggle size="xs" />
                          </div>
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
          <div className="blc-hud-scroll sf-items-scroll">
            <div className="sf-bag-toolbar">
              <span className="sf-bag-toolbar__label">装备舱 · {self.inventoryItems.length}</span>
              <button
                type="button"
                className="sf-bag-codex-btn"
                onClick={() => openCodex('items', activeBagItemId)}
                data-testid="hud-equip-codex-btn"
                title="打开局内装备合成图鉴"
              >
                合成图鉴
              </button>
            </div>

            <fieldset
              disabled={serverCommandsLocked}
              style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
            >
              <div className="blc-tool-slots">
                <button
                  type="button"
                  disabled={self.magneticCharges < 1 || !isStrategy}
                  className={`sf-tool-slot sf-tool-slot--remover ${
                    pendingTool === 'remover' ? 'sf-bag-slot--armed' : ''
                  } ${
                    itemDrag?.dragging && itemDrag.payload.kind === 'remover'
                      ? 'sf-bag-slot--dragging'
                      : ''
                  }`.trim()}
                  onPointerDown={(event) => {
                    if (self.magneticCharges < 1) return;
                    beginItemPointerDrag(event, {
                      kind: 'remover',
                      itemId: 'TOOL_MAGNETIC_REMOVER',
                    });
                  }}
                  onClick={() => {
                    if (suppressSlotClickRef.current) {
                      suppressSlotClickRef.current = false;
                      return;
                    }
                    armTargetAction({ kind: 'remover', phaseIndex: matchSnapshot.phaseIndex });
                  }}
                  title="拖拽至友军棋子或点击：无损卸下全部装备退回背包"
                  aria-label={`磁拆 ×${self.magneticCharges}`}
                  data-testid="tool-magnetic-remover-btn"
                >
                  <span className="sf-tool-slot__icon">
                    <GameItemIcon itemId="TOOL_MAGNETIC_REMOVER" size="md" />
                  </span>
                  <span className="sf-tool-slot__count">×{self.magneticCharges}</span>
                  <span className="sf-tool-slot__label">磁拆</span>
                </button>

                <button
                  type="button"
                  disabled={self.reforgerCharges < 1 || !isStrategy}
                  className={`sf-tool-slot sf-tool-slot--reforger ${
                    pendingTool === 'reforger' ? 'sf-bag-slot--armed' : ''
                  } ${
                    itemDrag?.dragging && itemDrag.payload.kind === 'reforger'
                      ? 'sf-bag-slot--dragging'
                      : ''
                  }`.trim()}
                  onPointerDown={(event) => {
                    if (self.reforgerCharges < 1) return;
                    beginItemPointerDrag(event, {
                      kind: 'reforger',
                      itemId: 'TOOL_REFORGER',
                    });
                  }}
                  onClick={() => {
                    if (suppressSlotClickRef.current) {
                      suppressSlotClickRef.current = false;
                      return;
                    }
                    armTargetAction({ kind: 'reforger', phaseIndex: matchSnapshot.phaseIndex });
                  }}
                  title="拖拽至友军棋子或点击：重铸装备为同阶其他装备"
                  aria-label={`重铸 ×${self.reforgerCharges}`}
                  data-testid="tool-reforger-btn"
                >
                  <span className="sf-tool-slot__icon">
                    <GameItemIcon itemId="TOOL_REFORGER" size="md" />
                  </span>
                  <span className="sf-tool-slot__count">×{self.reforgerCharges}</span>
                  <span className="sf-tool-slot__label">重铸</span>
                </button>
              </div>

              {(pendingEquipIndex !== null || pendingTool !== null) && isStrategy ? (
                <div className="ui-frosted-panel blc-quick-target-box">
                  <div className="sf-quick-target-head">
                    <span className="sf-quick-target-head__title">
                      {pendingEquipIndex !== null
                        ? '点选棋子穿戴'
                        : pendingTool === 'remover'
                          ? '选择卸装棋子'
                          : '选择重铸棋子'}
                    </span>
                    {pendingEquipIndex !== null && armedItemId && armedItemEntry ? (
                      <span className="sf-quick-target-armed">
                        <GameItemIcon itemId={armedItemId} size="xs" />
                        <span>{armedItemEntry.item.name}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="sf-quick-target-list">
                    {self.units.map((u) => {
                      const def = SEASON1_UNITS_BY_ID.get(u.unitId);
                      const preview =
                        pendingEquipIndex !== null && armedItemId
                          ? previewItemEquip(u, armedItemId)
                          : null;
                      const crafted = preview?.craftedItemId
                        ? lookupItemById(preview.craftedItemId)
                        : null;
                      const matchedExistingId =
                        crafted && armedItemId
                          ? u.items.find(
                              (iid) => lookupCraftRecipe(iid, armedItemId)?.id === crafted.item.id,
                            ) ?? null
                          : null;
                      const isBlocked = preview !== null && !preview.ok;
                      return (
                        <button
                          key={u.instanceId}
                          type="button"
                          className={`sf-quick-target-btn ${
                            crafted ? 'sf-quick-target-btn--craft' : ''
                          } ${isBlocked ? 'sf-quick-target-btn--blocked' : ''}`.trim()}
                          onClick={() => {
                            if (!activeTargetAction) return;
                            sendMatchCommand(targetCommand(activeTargetAction, u.instanceId));
                            setTargetAction(null);
                          }}
                        >
                          <span className="sf-quick-target-btn__top">
                            <span className="sf-quick-target-btn__unit">
                              <span className="sf-quick-target-btn__stars">
                                {'★'.repeat(u.star)}
                              </span>
                              <span className="sf-quick-target-btn__name">
                                {def?.name ?? '棋子'}
                              </span>
                            </span>
                            {!crafted ? (
                              <span className="sf-quick-target-btn__items">
                                {u.items.length > 0 ? (
                                  u.items.map((iid, itemIdx) => (
                                    <GameItemIcon
                                      key={`${iid}-${itemIdx}`}
                                      itemId={iid}
                                      size="xs"
                                    />
                                  ))
                                ) : (
                                  <span className="sf-quick-target-btn__empty">空槽</span>
                                )}
                              </span>
                            ) : null}
                          </span>
                          {crafted && matchedExistingId && armedItemId ? (
                            <span className="sf-quick-craft-preview">
                              <span className="sf-quick-craft-formula">
                                <GameItemIcon itemId={matchedExistingId} size="xs" />
                                <span className="sf-craft-op">+</span>
                                <GameItemIcon itemId={armedItemId} size="xs" />
                                <span className="sf-craft-arrow">→</span>
                                <GameItemIcon itemId={crafted.item.id} size="xs" />
                              </span>
                              <span className="sf-quick-craft-name">{crafted.item.name}</span>
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {self.inventoryItems.length === 0 ? (
                <div className="blc-muted-hint">暂无装备</div>
              ) : (
                <div className="sf-bag-grid" data-testid="hud-inventory-grid">
                  {self.inventoryItems.map((itemId, idx) => {
                    const entry = lookupItemById(itemId);
                    const isComponent = isCraftComponentKind(entry?.kind);
                    const isEmblemOrFlag = entry?.kind === 'emblem' || entry?.kind === 'flag';
                    const isArmed = pendingEquipIndex === idx;
                    const isHovered = hoveredBagIndex === idx;
                    const canCraftNow =
                      isComponent &&
                      self.inventoryItems.some(
                        (otherId, otherIdx) =>
                          otherIdx !== idx && Boolean(lookupCraftRecipe(itemId, otherId)),
                      );

                    return (
                      <div
                        key={`${itemId}-${idx}`}
                        className="sf-bag-slot-cell"
                        onMouseEnter={() => { audioBus.emit('onUiFeedback', { kind: 'hover' }); setHoveredBagIndex(idx); }}
                      >
                        <button
                          type="button"
                          disabled={!isStrategy}
                          className={`sf-bag-slot ${
                            isComponent
                              ? 'sf-bag-slot--component'
                              : isEmblemOrFlag
                                ? 'sf-bag-slot--emblem'
                                : 'sf-bag-slot--completed'
                          } ${isArmed ? 'sf-bag-slot--armed blc-item-btn--armed' : ''} ${
                            isHovered ? 'sf-bag-slot--hovered' : ''
                          } ${
                            itemDrag?.dragging &&
                            itemDrag.payload.kind === 'equip' &&
                            itemDrag.payload.inventoryItemIndex === idx
                              ? 'sf-bag-slot--dragging'
                              : ''
                          }`.trim()}
                          onPointerDown={(event) => {
                            beginItemPointerDrag(event, {
                              kind: 'equip',
                              inventoryItemIndex: idx,
                              itemId,
                            });
                          }}
                          onFocus={() => setHoveredBagIndex(idx)}
                          onClick={() => {
                            if (suppressSlotClickRef.current) {
                              suppressSlotClickRef.current = false;
                              return;
                            }
                            armTargetAction({
                              kind: 'equip',
                              inventoryItemIndex: idx,
                              phaseIndex: matchSnapshot.phaseIndex,
                            });
                          }}
                          aria-label={entry?.item.name ?? '装备'}
                          data-testid={`inventory-item-${idx}`}
                          data-item-id={itemId}
                        >
                          <GameItemIcon itemId={itemId} size="md" />
                          {canCraftNow ? (
                            <span className="sf-bag-slot__craft-dot" aria-hidden="true" />
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>
          </div>
        )}

        {leftTab === 'items' && activeBagItemId && activeBagEntry && !itemDrag?.dragging ? (
          <div
            className="ui-metal-frame sf-craft-sheet"
            data-testid="hud-item-craft-sheet"
            role="region"
            aria-label="实时装备合成速查"
            onMouseLeave={() => setHoveredCraftPartnerId(null)}
          >
            <div className="sf-craft-sheet__head">
              <div className="sf-craft-sheet__title-wrap">
                <GameItemIcon itemId={activeBagItemId} size="md" />
                <div className="sf-craft-sheet__meta">
                  <div className="sf-craft-sheet__name-row">
                    <strong>{activeBagEntry.item.name}</strong>
                    <span className="sf-craft-sheet__kind">
                      {ITEM_KIND_LABELS[activeBagEntry.kind] ?? '装备'}
                    </span>
                  </div>
                  {isCraftComponentKind(activeBagEntry.kind) ? (
                    <div className="sf-craft-stat-chip">
                      {activeBagEntry.kind === 'spatula' ? (
                        <span>纹章 · 母舰旗合成核</span>
                      ) : (
                        <GameEffectText
                          itemId={activeBagItemId}
                          fullText={activeBagEntry.item.desc}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="sf-craft-sheet__head-actions">
                <DescriptionModeToggle size="xs" />
                <button
                  type="button"
                  className="sf-craft-sheet__mini-btn"
                  onClick={() => openCodex('items', activeBagItemId)}
                  title="在完整合成图鉴中查看"
                >
                  图鉴
                </button>
                {pendingEquipIndex !== null && hoveredBagIndex === null ? (
                  <button
                    type="button"
                    className="sf-craft-sheet__mini-btn sf-craft-sheet__mini-btn--close"
                    onClick={() => setTargetAction(null)}
                    aria-label="取消选中装备"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            {isCraftComponentKind(activeBagEntry.kind) ? (
              (() => {
                const previewPartnerId =
                  hoveredCraftPartnerId ?? craftableNow[0]?.partnerId ?? null;
                const previewResult = previewPartnerId
                  ? lookupCraftRecipe(activeBagItemId, previewPartnerId)
                  : null;
                return (
                  <>
                    {craftableNow.length > 0 ? (
                      <div
                        className="sf-craft-ready-section"
                        data-testid="hud-craft-ready-section"
                      >
                        <div className="sf-craft-section-head">
                          <span className="sf-craft-section-head__title">当前可直合</span>
                          <span className="sf-craft-section-head__badge">
                            {craftableNow.length}
                          </span>
                        </div>
                        <div className="sf-craft-ready-strip">
                          {craftableNow.map(({ partnerId, result }) => (
                            <button
                              key={partnerId}
                              type="button"
                              className={`sf-craft-ready-card ${
                                hoveredCraftPartnerId === partnerId
                                  ? 'sf-craft-ready-card--active'
                                  : ''
                              }`.trim()}
                              onMouseEnter={() => setHoveredCraftPartnerId(partnerId)}
                              onFocus={() => setHoveredCraftPartnerId(partnerId)}
                              onClick={() => openCodex('items', result.id)}
                              title={result.name}
                            >
                              <span className="sf-craft-ready-card__icons">
                                <GameItemIcon itemId={partnerId} size="xs" />
                                <span className="sf-craft-arrow">→</span>
                                <GameItemIcon itemId={result.id} size="md" />
                              </span>
                              <span className="sf-craft-ready-card__name">{result.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="sf-craft-all-section">
                      <div className="sf-craft-section-head">
                        <span className="sf-craft-section-head__title">全部合成</span>
                        <span className="sf-craft-section-head__sub">3×3 图谱</span>
                      </div>
                      <div className="sf-craft-matrix" data-testid="hud-craft-all-grid">
                        {ALL_CRAFT_COMPONENT_IDS.map((partnerId) => {
                          const res = lookupCraftRecipe(activeBagItemId, partnerId);
                          if (!res) return null;
                          const owned = otherBagIdSet.has(partnerId);
                          const isActive = previewPartnerId === partnerId;
                          const partnerEntry = lookupItemById(partnerId);
                          return (
                            <button
                              key={partnerId}
                              type="button"
                              className={`sf-craft-tile ${
                                owned ? 'sf-craft-tile--owned' : ''
                              } ${isActive ? 'sf-craft-tile--active' : ''}`.trim()}
                              onMouseEnter={() => setHoveredCraftPartnerId(partnerId)}
                              onFocus={() => setHoveredCraftPartnerId(partnerId)}
                              onClick={() => openCodex('items', res.id)}
                              aria-label={`${res.name}（配对 ${partnerEntry?.item.name ?? partnerId}）`}
                            >
                              <GameItemIcon itemId={res.id} size="md" />
                              <span className="sf-craft-tile__partner" aria-hidden="true">
                                <GameItemIcon itemId={partnerId} size="xs" />
                              </span>
                              {owned ? (
                                <span className="sf-craft-tile__dot" aria-hidden="true" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sf-craft-preview-bar" data-testid="hud-craft-preview-bar">
                      {previewResult && previewPartnerId ? (
                        <>
                          <div className="sf-craft-preview-bar__formula">
                            <span className="sf-craft-ready-icons">
                              <GameItemIcon itemId={activeBagItemId} size="xs" />
                              <span className="sf-craft-op">+</span>
                              <GameItemIcon itemId={previewPartnerId} size="xs" />
                              <span className="sf-craft-arrow">→</span>
                              <GameItemIcon itemId={previewResult.id} size="xs" />
                            </span>
                            <strong className="sf-craft-preview-bar__name">
                              {previewResult.name}
                            </strong>
                          </div>
                          <div className="sf-craft-preview-bar__effect">
                            <GameEffectText
                              itemId={previewResult.id}
                              fullText={previewResult.desc}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="sf-craft-preview-bar__hint">
                          滑过图标查看效果 · 点击进 9×9 图鉴
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                {'components' in activeBagEntry.item &&
                activeBagEntry.item.components.length === 2 ? (
                  <div className="sf-craft-formula-strip">
                    <span className="sf-craft-formula-strip__label">配方</span>
                    <span className="sf-craft-ready-icons">
                      <GameItemIcon itemId={activeBagEntry.item.components[0]!} size="xs" />
                      <span className="sf-craft-op">+</span>
                      <GameItemIcon itemId={activeBagEntry.item.components[1]!} size="xs" />
                      <span className="sf-craft-arrow">→</span>
                      <GameItemIcon itemId={activeBagItemId} size="xs" />
                    </span>
                  </div>
                ) : null}
                <div className="sf-craft-preview-bar">
                  <div className="sf-craft-preview-bar__effect">
                    <GameEffectText
                      itemId={activeBagItemId}
                      fullText={activeBagEntry.item.desc}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </aside>

      <aside
        className={`ui-metal-frame blc-hud-right ${!isBottomOpen ? 'blc-hud-right--tall' : ''}`.trim()}
        data-testid="hud-right-rail"
      >
        <div className="sf-rail-tabs" role="tablist" aria-label="排行榜视图">
          <button
            type="button"
            role="tab"
            aria-selected={rightTab === 'score'}
            className={`sf-rail-tab ${rightTab === 'score' ? 'sf-rail-tab--active' : ''}`}
            onClick={() => { audioBus.emit('onUiFeedback', { kind: 'click' }); setRightTab('score'); }}
            data-testid="hud-right-score-tab"
          >
            胜点
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightTab === 'damage'}
            className={`sf-rail-tab ${rightTab === 'damage' ? 'sf-rail-tab--active' : ''}`}
            onClick={() => { audioBus.emit('onUiFeedback', { kind: 'click' }); setRightTab('damage'); }}
            data-testid="hud-right-damage-tab"
          >
            伤害
          </button>
        </div>

        {rightTab === 'score' ? (
          <div className="blc-hud-scroll sf-rail-list">
            {sortedSeats.map((s, idx) => {
              const isSelf = s.seatId === matchSnapshot.seatId;
              const isScouted = (scoutedSeatId ?? matchSnapshot.seatId) === s.seatId;
              const isTopFour = idx < 4;
              const vpPct = Math.max(0, Math.min(100, Math.round((s.victoryPoints / maxSeatVp) * 100)));
              return (
                <button
                  key={s.seatId}
                  type="button"
                  className={`sf-rail-row ${isSelf ? 'sf-rail-row--self' : ''} ${
                    isScouted && !isSelf ? 'sf-rail-row--scouted' : ''
                  }`.trim()}
                  onClick={() => scoutMatchSeat(isSelf ? null : s.seatId)}
                  title={isSelf ? '返回主场' : `侦察 ${s.nickname} 战场`}
                  data-testid={`seat-ring-${s.seatId}`}
                >
                  <span className={`sf-rail-rank ${isTopFour ? 'sf-rail-rank--top' : ''}`}>
                    {idx + 1}
                  </span>
                  <span className="sf-rail-avatar">
                    <TacticianPortrait
                      tacticianId={s.tacticianId ?? 'tactician_lumina_bell'}
                      size="sm"
                      alt={s.nickname}
                    />
                  </span>
                  <span className="sf-rail-info">
                    <span className="sf-rail-name">
                      {s.nickname}
                      {matchSnapshot.queueType === 'solo' && s.isBot ? ' · 电脑' : ''}
                    </span>
                    <span className="sf-rail-lvl">Lv.{s.level}</span>
                  </span>
                  <span className={`sf-rail-vp ${isTopFour ? 'sf-rail-vp--top' : ''}`}>
                    {formatQuarterPoints(s.victoryPoints)}
                  </span>
                  <span className="sf-rail-bar" aria-hidden="true">
                    <i
                      className={isTopFour ? 'sf-rail-bar__fill--top' : ''}
                      style={{ width: `${Math.max(s.victoryPoints > 0 ? 6 : 0, vpPct)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="blc-hud-scroll sf-rail-list" data-testid="hud-damage-panel">
            <div className="sf-rail-subtabs">
              <button
                type="button"
                className={`sf-rail-subtab ${damageMetric === 'dealt' ? 'sf-rail-subtab--active' : ''}`}
                onClick={() => setDamageMetric('dealt')}
              >
                输出
              </button>
              <button
                type="button"
                className={`sf-rail-subtab ${damageMetric === 'taken' ? 'sf-rail-subtab--active' : ''}`}
                onClick={() => setDamageMetric('taken')}
              >
                承伤
              </button>
              <button
                type="button"
                className={`sf-rail-subtab ${damageMetric === 'heal' ? 'sf-rail-subtab--active' : ''}`}
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
                          <span className="sf-dmg-unit-name">
                            {'★'.repeat(r.star)} {def?.name ?? '棋子'}
                          </span>
                        </span>
                        <strong className="sf-dmg-val">{Math.round(r.metricVal)}</strong>
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

      {inspectedUnit && inspectedDef ? (() => {
        const positioning = resolveUnitPositioning(inspectedDef);
        const starScale = inspectedDef.starMultipliers[String(inspectedUnit.star)] ?? 1;
        const displayMaxHp = Math.round(inspectedDef.stats.hp * starScale + (inspectedUnit.bonusHp ?? 0));
        const displayAtk = Math.round(inspectedDef.stats.atk * starScale);
        const displayAp = Math.round(100 + (inspectedUnit.bonusSkillEfficiency ?? 0));
        const initialMana = inspectedDef.stats.initialMana;
        const maxMana = inspectedDef.stats.maxMana;
        const manaFillPct =
          maxMana > 0 ? Math.min(100, Math.max(0, Math.round((initialMana / maxMana) * 100))) : 0;

        return (
        <section
          className="ui-metal-frame blc-unit-inspect"
          aria-label="棋子战术检视卡"
          data-testid="unit-inspect-card"
        >
          <div className="sf-inspect-head">
            <UnitPortrait unitId={inspectedUnit.unitId} size="md" star={inspectedUnit.star} />
            <div className="sf-inspect-identity">
              <div className="sf-inspect-top-row">
                <div className="sf-inspect-name-group">
                  <span className="blc-chip blc-chip--gold">{inspectedDef.cost} 费</span>
                  <strong className="sf-inspect-name">
                    {'★'.repeat(inspectedUnit.star)} {inspectedDef.name}
                  </strong>
                </div>
                <div className="sf-inspect-head-controls">
                  <DescriptionModeToggle size="xs" />
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={clearInspectedUnit}
                    aria-label="关闭棋子检视卡"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="sf-inspect-meta-row">
                <span className="sf-inspect-meta-text">
                  {inspectedDef.faction} · {inspectedDef.role}
                  {inspectedDef.uniqueTrait ? ` · ${inspectedDef.uniqueTrait}` : ''}
                </span>
                <span
                  className={`sf-inspect-pos-badge sf-inspect-pos-badge--${positioning.tone}`}
                  data-testid="unit-inspect-positioning"
                >
                  <PositioningIcon kind={positioning.iconKind} />
                  <span>{positioning.label}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="sf-inspect-bars" data-testid="unit-inspect-resource-bars">
            <div className="sf-inspect-bar sf-inspect-bar--hp" title={`最大生命 ${displayMaxHp}`}>
              <span className="sf-inspect-bar__fill" style={{ width: '100%' }} />
              <span className="sf-inspect-bar__label">HP</span>
              <span className="sf-inspect-bar__value">{displayMaxHp}</span>
            </div>
            <div
              className="sf-inspect-bar sf-inspect-bar--mp"
              title={`初始法力 ${initialMana} / 法力上限 ${maxMana}`}
            >
              <span className="sf-inspect-bar__fill" style={{ width: `${manaFillPct}%` }} />
              <span className="sf-inspect-bar__label">MP</span>
              <span className="sf-inspect-bar__value">
                {initialMana}/{maxMana}
              </span>
            </div>
          </div>

          <div className="sf-inspect-stat-grid" data-testid="unit-inspect-stat-grid">
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--phys" title="物理攻击">
              <StatInlineIcon kind="phys" />
              <span className="sf-inspect-stat-cell__name">攻击</span>
              <span className="sf-inspect-stat-cell__val">{displayAtk}</span>
            </div>
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--magic" title="法术强度">
              <StatInlineIcon kind="magic" />
              <span className="sf-inspect-stat-cell__name">法强</span>
              <span className="sf-inspect-stat-cell__val">{displayAp}%</span>
            </div>
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--armor" title="物理护甲">
              <StatInlineIcon kind="armor" />
              <span className="sf-inspect-stat-cell__name">护甲</span>
              <span className="sf-inspect-stat-cell__val">{inspectedDef.stats.armor}</span>
            </div>
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--mr" title="魔法抗性">
              <StatInlineIcon kind="mr" />
              <span className="sf-inspect-stat-cell__name">魔抗</span>
              <span className="sf-inspect-stat-cell__val">{inspectedDef.stats.mr}</span>
            </div>
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--as" title="攻击速度">
              <StatInlineIcon kind="as" />
              <span className="sf-inspect-stat-cell__name">攻速</span>
              <span className="sf-inspect-stat-cell__val">{inspectedDef.stats.atkSpeed.toFixed(2)}</span>
            </div>
            <div className="sf-inspect-stat-cell sf-inspect-stat-cell--range" title="攻击射程">
              <RangeStatIcon />
              <span className="sf-inspect-stat-cell__name">射程</span>
              <span className="sf-inspect-stat-cell__val">{inspectedDef.stats.range}格</span>
            </div>
          </div>

          <div className="sf-inspect-skill-box" data-testid="unit-inspect-skill">
            <GameEffectText unitId={inspectedDef.id} fullText={inspectedDef.skillSummary} />
          </div>

          <div
            className="sf-inspect-equip-section"
            onMouseLeave={() => setHoveredInspectItemId(null)}
          >
            <div className="sf-inspect-section-head">
              <span>已穿戴装备</span>
              <span className="sf-inspect-section-count">{inspectedUnit.items.length}/3</span>
            </div>
            <div className="sf-inspect-equip-row" data-testid="unit-inspect-equip-slots">
              {[0, 1, 2].map((slotIdx) => {
                const iid = inspectedUnit.items[slotIdx] ?? null;
                if (!iid) {
                  return (
                    <div
                      key={`empty-${slotIdx}`}
                      className="sf-inspect-equip-slot sf-inspect-equip-slot--empty"
                      aria-label="空装备槽"
                    >
                      <span className="sf-inspect-equip-slot__empty-mark" aria-hidden="true" />
                    </div>
                  );
                }
                const itemEntry = lookupItemById(iid);
                const isComp = isCraftComponentKind(itemEntry?.kind);
                const isActiveHover = hoveredInspectItemId === iid;
                return (
                  <button
                    key={`${iid}-${slotIdx}`}
                    type="button"
                    className={`sf-inspect-equip-slot sf-inspect-equip-slot--filled ${
                      isComp ? 'sf-inspect-equip-slot--comp' : 'sf-inspect-equip-slot--completed'
                    } ${isActiveHover ? 'sf-inspect-equip-slot--active' : ''}`.trim()}
                    onMouseEnter={() => setHoveredInspectItemId(iid)}
                    onFocus={() => setHoveredInspectItemId(iid)}
                    onClick={() => openCodex('items', iid)}
                    aria-label={itemEntry?.item.name ?? '已穿戴装备'}
                  >
                    <GameItemIcon itemId={iid} size="sm" />
                  </button>
                );
              })}
            </div>

            {inspectedDef.recommendedItems.length > 0 ? (
              <div className="sf-inspect-rec-section" data-testid="unit-inspect-recommended">
                <div className="sf-inspect-section-head">
                  <span>推荐出装</span>
                  <span className="sf-inspect-rec-legend">
                    <span className="sf-inspect-rec-legend__dot" aria-hidden="true" />
                    背包已有散件
                  </span>
                </div>
                <div className="sf-rec-build-row">
                  {inspectedDef.recommendedItems.slice(0, 3).map((recId) => {
                    const recEntry = lookupItemById(recId);
                    if (!recEntry) return null;
                    const compIds =
                      'components' in recEntry.item ? recEntry.item.components : [];
                    const remainingBag = [...self.inventoryItems];
                    const compStates = compIds.map((cid) => {
                      const foundIdx = remainingBag.indexOf(cid);
                      const owned = foundIdx >= 0;
                      if (owned) remainingBag.splice(foundIdx, 1);
                      return { id: cid, owned };
                    });
                    const allOwned =
                      compStates.length === 2 && compStates.every((c) => c.owned);
                    const isHoveringRec = hoveredInspectItemId === recId;
                    return (
                      <button
                        key={recId}
                        type="button"
                        className={`sf-rec-build-card ${
                          allOwned ? 'sf-rec-build-card--ready' : ''
                        } ${isHoveringRec ? 'sf-rec-build-card--active' : ''}`.trim()}
                        onMouseEnter={() => setHoveredInspectItemId(recId)}
                        onFocus={() => setHoveredInspectItemId(recId)}
                        onClick={() => openCodex('items', recId)}
                        aria-label={`推荐装备：${recEntry.item.name}`}
                      >
                        {allOwned ? <span className="sf-rec-ready-tag">可合</span> : null}
                        <span className="sf-rec-build-icon">
                          <GameItemIcon itemId={recId} size="md" />
                        </span>
                        <span className="sf-rec-build-name">{recEntry.item.name}</span>
                        {compStates.length === 2 ? (
                          <span className="sf-rec-build-recipe">
                            <span
                              className={`sf-rec-comp ${
                                compStates[0]!.owned ? 'sf-rec-comp--owned' : ''
                              }`.trim()}
                            >
                              <GameItemIcon itemId={compStates[0]!.id} size="xs" />
                            </span>
                            <span className="sf-craft-op">+</span>
                            <span
                              className={`sf-rec-comp ${
                                compStates[1]!.owned ? 'sf-rec-comp--owned' : ''
                              }`.trim()}
                            >
                              <GameItemIcon itemId={compStates[1]!.id} size="xs" />
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {(() => {
              const hoveredEntry = hoveredInspectItemId
                ? lookupItemById(hoveredInspectItemId)
                : null;
              if (!hoveredInspectItemId || !hoveredEntry) return null;
              return (
                <div
                  className="sf-inspect-item-detail"
                  data-testid="unit-inspect-item-tooltip"
                >
                  <GameItemIcon itemId={hoveredInspectItemId} size="sm" />
                  <div className="sf-inspect-item-detail__body">
                    <div className="sf-inspect-item-detail__title">
                      <strong>{hoveredEntry.item.name}</strong>
                      <span className="sf-craft-sheet__kind">
                        {ITEM_KIND_LABELS[hoveredEntry.kind] ?? '装备'}
                      </span>
                    </div>
                    <div className="sf-inspect-item-detail__desc">
                      <GameEffectText
                        itemId={hoveredInspectItemId}
                        fullText={hoveredEntry.item.desc}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
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
        );
      })() : null}

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
                <GameUiIcon name={self.shopLocked ? 'lock' : 'unlock'} size={14} />
                <span>{self.shopLocked ? '已锁' : '锁店'}</span>
              </button>

              <button
                type="button"
                className="sf-shop-mini-btn sf-shop-mini-btn--gold"
                onClick={() => setShopCollapsed?.(true)}
                title="收起商店 (Space)"
                data-testid="toggle-shop-collapse-btn"
              >
                <GameUiIcon name={shopDockPosition === 'top' ? 'chevronUp' : 'chevronDown'} size={14} />
                <span>收起</span>
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
                        onMouseEnter={() => { if (preview.canBuy) audioBus.emit('onUiFeedback', { kind: 'hover' }); }}
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
          className="sf-phase-wait-capsule"
          data-testid="entry-briefing-banner"
          data-season-term-id={matchSnapshot.versionLock.seasonTermId}
          data-game-set-version={matchSnapshot.versionLock.gameSetVersion}
          data-course-pack-version={matchSnapshot.versionLock.coursePackVersion}
        >
          <span className="sf-phase-wait-capsule__dot" aria-hidden="true" />
          <span>入场备战 · 可自由交易与布阵，即将进入首轮学习</span>
        </div>
      ) : null}

      {matchSnapshot.phase === 'rest' ? (
        <div className="sf-phase-wait-capsule" data-testid="deep-mode-rest-overlay">
          <span className="sf-phase-wait-capsule__dot" aria-hidden="true" />
          <span>
            休息片刻 · 可自由交易与布阵，<strong>{formatMMSS(liveRemainingSec)}</strong> 后继续
          </span>
        </div>
      ) : null}

      {hasChoiceModal && !peekingBattlefield ? (
        <MatchChoiceModal
          showAugmentChoice={showAugmentChoice}
          self={self}
          serverCommandsLocked={serverCommandsLocked}
          onPeekBattlefield={() => setPeekingBattlefield(true)}
          onSendCommand={sendMatchCommand}
        />
      ) : null}

      {matchSnapshot.learning &&
      ((matchSnapshot.phase === 'learning' && !matchSnapshot.learning.complete) ||
        (learningReview &&
          learningReview.nodeIndex === matchSnapshot.nodeIndex &&
          !['battle', 'settlement', 'exit'].includes(matchSnapshot.phase))) ? (
        <div className="learning-briefing-backdrop" data-testid="inmatch-learning-overlay">
          <div className="sf-learning-overlay-shell">
            <div className="sf-learning-card-host">
              {(() => {
                const lrn = matchSnapshot.learning;
                const review =
                  learningReview && learningReview.nodeIndex === matchSnapshot.nodeIndex
                    ? learningReview
                    : null;
                const currentStepKind =
                  review?.question.stepRole ?? lrn.currentStep ?? 'verification';
                const activeStepObj = lrn.steps.find((s) => s.kind === currentStepKind);
                const unsubmittedQuestions = lrn.clientQuestions.filter(
                  (q) => !lrn.submittedQuestionIds.includes(q.questionId),
                );
                const currentQuestion =
                  review?.question ??
                  (lrn.complete ? null : unsubmittedQuestions[0] ?? lrn.clientQuestions.at(-1) ?? null);
                const currentFeedbackRaw =
                  review?.feedback ??
                  (currentQuestion ? lrn.feedback[currentQuestion.questionId] : undefined);
                const fbView: QuestionFeedbackView | null = currentFeedbackRaw
                  ? {
                      isCorrect: currentFeedbackRaw.isCorrect,
                      isSkipped: currentFeedbackRaw.isSkipped,
                      quality: currentFeedbackRaw.quality,
                      explanationMd: currentFeedbackRaw.explanationMd,
                      correctAnswerDisplay: currentFeedbackRaw.correctAnswerDisplay,
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
                    arcMeta={lrn.arcMeta ?? null}
                    stepKind={currentStepKind}
                    stepsProgress={progressItems}
                    question={currentQuestion}
                    lessonMaterialMd={materialMd}
                    lessonTitle={
                      lrn.arcMeta
                        ? `大轮次 ${lrn.arcMeta.arcIndex + 1} · ${lrn.arcMeta.stageLabel}`
                        : `学习节点 ${lrn.nodeIndex + 1} · ${
                            modeSpec.learning_detail[lrn.nodeIndex]?.goal ?? '核心概念与迁移'
                          }`
                    }
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
                        if (lrn.complete && matchSnapshot.phase === 'learning') {
                          advanceLearningStep();
                        }
                        return;
                      }
                      if (
                        matchSnapshot.phase === 'learning' &&
                        (lrn.complete ||
                          currentStepKind === 'material' ||
                          currentStepKind === 'remediation')
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
          onClose={() => { audioBus.emit('onUiFeedback', { kind: 'close' }); setPlannerOpen(false); }}
        />
      ) : null}

      {codexOpen ? (
        <MatchCodexModal
          codexUnitId={codexUnitId}
          ownedComponentIds={self.inventoryItems}
          audioBus={audioBus}
          initialTab={codexInitialTab}
          initialItemId={codexInitialItemId}
          onSelectUnit={setCodexUnitId}
          onClose={() => { audioBus.emit('onUiFeedback', { kind: 'close' }); setCodexOpen(false); }}
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

      {itemDrag?.dragging
        ? (() => {
            const targetUnit = itemDrag.targetUnitId
              ? self.units.find((u) => u.instanceId === itemDrag.targetUnitId) ?? null
              : null;
            const targetDef = targetUnit ? SEASON1_UNITS_BY_ID.get(targetUnit.unitId) ?? null : null;
            const equipPreview =
              targetUnit && itemDrag.payload.kind === 'equip'
                ? previewItemEquip(targetUnit, itemDrag.payload.itemId)
                : null;
            const craftedEntry = equipPreview?.craftedItemId
              ? lookupItemById(equipPreview.craftedItemId)
              : null;
            const matchedExistingId =
              targetUnit && craftedEntry && itemDrag.payload.kind === 'equip'
                ? targetUnit.items.find(
                    (iid) =>
                      lookupCraftRecipe(iid, itemDrag.payload.itemId)?.id === craftedEntry.item.id,
                  ) ?? null
                : null;

            const isToolValid =
              targetUnit !== null &&
              targetUnit.frozenUntilRound === null &&
              (itemDrag.payload.kind === 'remover'
                ? targetUnit.items.length > 0 && self.magneticCharges >= 1
                : itemDrag.payload.kind === 'reforger'
                  ? hasReforgeableUnitItem(targetUnit) && self.reforgerCharges >= 1
                  : false);

            const isValidDrop =
              targetUnit !== null &&
              (itemDrag.payload.kind === 'equip' ? Boolean(equipPreview?.ok) : isToolValid);

            const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
            const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
            const bubbleLeft = Math.max(150, Math.min(vw - 150, itemDrag.targetScreenX));
            const bubbleTop = Math.max(116, Math.min(vh - 150, itemDrag.targetScreenY - 14));

            return (
              <>
                <div
                  className={`sf-item-drag-ghost ${
                    isValidDrop
                      ? 'sf-item-drag-ghost--ready'
                      : targetUnit
                        ? 'sf-item-drag-ghost--blocked'
                        : ''
                  }`.trim()}
                  style={{ left: itemDrag.clientX, top: itemDrag.clientY }}
                  aria-hidden="true"
                >
                  <GameItemIcon itemId={itemDrag.payload.itemId} size="lg" />
                </div>

                {targetUnit ? (
                  <div
                    className={`sf-drag-equip-preview ${
                      craftedEntry && equipPreview?.ok
                        ? 'sf-drag-equip-preview--craft'
                        : !isValidDrop
                          ? 'sf-drag-equip-preview--blocked'
                          : itemDrag.payload.kind === 'remover'
                            ? 'sf-drag-equip-preview--remover'
                            : itemDrag.payload.kind === 'reforger'
                              ? 'sf-drag-equip-preview--reforger'
                              : 'sf-drag-equip-preview--equip'
                    }`.trim()}
                    style={{ left: bubbleLeft, top: bubbleTop }}
                    data-testid="hud-drag-equip-preview"
                  >
                    {itemDrag.payload.kind === 'equip' &&
                    equipPreview?.ok &&
                    craftedEntry &&
                    matchedExistingId ? (
                      <>
                        <div className="sf-drag-equip-preview__formula">
                          <GameItemIcon itemId={matchedExistingId} size="sm" />
                          <span className="sf-craft-op">+</span>
                          <GameItemIcon itemId={itemDrag.payload.itemId} size="sm" />
                          <span className="sf-craft-arrow">→</span>
                          <span className="sf-drag-equip-preview__result-icon">
                            <GameItemIcon itemId={craftedEntry.item.id} size="lg" />
                          </span>
                        </div>
                        <div className="sf-drag-equip-preview__title">
                          <strong>{craftedEntry.item.name}</strong>
                          <span className="sf-drag-equip-preview__unit-tag">
                            {targetDef?.name ?? '棋子'}
                          </span>
                        </div>
                        <div className="sf-drag-equip-preview__stats">
                          <GameEffectText
                            itemId={craftedEntry.item.id}
                            fullText={craftedEntry.item.desc}
                          />
                        </div>
                      </>
                    ) : itemDrag.payload.kind === 'equip' && equipPreview?.ok ? (
                      <>
                        <div className="sf-drag-equip-preview__title">
                          <strong>
                            {'★'.repeat(targetUnit.star)} {targetDef?.name ?? '棋子'}
                          </strong>
                          <span className="sf-drag-equip-preview__hint">松手穿戴</span>
                        </div>
                        <div className="sf-drag-equip-preview__slots">
                          {[0, 1, 2].map((slotIdx) => {
                            const nextItemId = equipPreview.items?.[slotIdx] ?? null;
                            const isNewlyAdded =
                              nextItemId !== null && slotIdx === targetUnit.items.length;
                            return (
                              <span
                                key={slotIdx}
                                className={`sf-drag-slot ${
                                  isNewlyAdded
                                    ? 'sf-drag-slot--new'
                                    : nextItemId
                                      ? 'sf-drag-slot--filled'
                                      : 'sf-drag-slot--empty'
                                }`.trim()}
                              >
                                {nextItemId ? (
                                  <GameItemIcon itemId={nextItemId} size="sm" />
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </>
                    ) : itemDrag.payload.kind !== 'equip' && isToolValid ? (
                      <>
                        <div className="sf-drag-equip-preview__tool-row">
                          <GameItemIcon itemId={itemDrag.payload.itemId} size="md" />
                          <div className="sf-drag-equip-preview__tool-meta">
                            <strong>
                              {itemDrag.payload.kind === 'remover'
                                ? '松手卸下全部装备'
                                : '松手重铸装备'}
                            </strong>
                            <span>{targetDef?.name ?? '棋子'}</span>
                          </div>
                        </div>
                        <div className="sf-drag-equip-preview__slots">
                          {targetUnit.items.map((iid, itemIdx) => (
                            <span key={`${iid}-${itemIdx}`} className="sf-drag-slot sf-drag-slot--filled">
                              <GameItemIcon itemId={iid} size="sm" />
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="sf-drag-equip-preview__blocked">
                        <strong>{targetDef?.name ?? '棋子'}</strong>
                        <span>
                          {itemDrag.payload.kind === 'equip'
                            ? describeEquipBlockReason(equipPreview?.reason)
                            : targetUnit.frozenUntilRound !== null
                              ? '棋子休眠冻结中'
                              : itemDrag.payload.kind === 'remover'
                                ? '该棋子暂无可卸装备'
                                : '该棋子无可重铸装备'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            );
          })()
        : null}
    </div>
  );
}
