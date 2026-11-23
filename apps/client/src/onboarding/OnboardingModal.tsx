import React, { useEffect, useRef, useState } from 'react';
import {
  SEASON1_UNITS_BY_ID,
  lookupItemById,
} from '@pkg/contracts';
import { previewItemEquip } from '@pkg/game-core';
import { QuestionStepCard, type QuestionAnswerSubmission } from '@pkg/learning-ui';
import { ApiClientError } from '../api/httpClient.js';
import type { BattleBroadcastPayload, MatchRoomSnapshot } from '../api/matchSocket.js';
import { TacticianPortrait, UnitPortrait } from '../components/UnitPortrait.js';
import {
  OnboardingMicroController,
  type OnboardingMicroProgress,
} from '../offline/offlinePracticeController.js';
import { LiveBattleChoreographer, SnapshotStageSynchronizer } from '../hud/stageSync.js';
import { useAppStore } from '../store/appStore.js';
import '../pages/lobbyPrep.css';

const FOUR_GUIDE_CARDS = [
  {
    step: '1 / 4',
    title: '答题蓄能，爆出鎏金法球',
    caption: '答对题目即时掉落整金法球与充能，化作本回合经济优势',
  },
  {
    step: '2 / 4',
    title: '三张同卡，聚拢跃升星级',
    caption: '集齐 3 张同星棋子自动合一升星，战力与体量同步跃迁',
  },
  {
    step: '3 / 4',
    title: '两件散件，拖放直合成装',
    caption: '任意两件基础组件装备至同一棋子，瞬间铸造强力星港神装',
  },
  {
    step: '4 / 4',
    title: '布阵交锋，双模商店随心切换',
    caption: '拖拽站位激活派系羁绊，设置内支持底部/顶部商店自由切换',
  },
] as const;

function formatCompactClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${m}:${rem}`;
}

function shortItemName(rawName: string): string {
  if (rawName.includes('钨芯刃')) return '钨芯刃';
  if (rawName.includes('加速轨')) return '加速轨';
  return rawName;
}

function resolveMicroTaskLabel(prog: OnboardingMicroProgress): string {
  if (prog.stageId === 'goal') return '确认演练目标';
  if (prog.stageId === 'sample') return '答对样例题 · 领整金法球';
  if (prog.stageId === 'prep') {
    if (!prog.checklist.mergedTwoStar) return '购买同卡 · 合成 2★ 主力';
    if (!prog.checklist.craftedRailgun) return '装配双散件 · 铸造洛伦兹连发轨';
    return '阵容已成 · 点击开战检验战果';
  }
  if (prog.stageId === 'battle') return '星港自动交锋中';
  return '演练完成 · 准备启航';
}

function SpotlightCue({ label }: { readonly label: string }): React.JSX.Element {
  return (
    <>
      <span className="ob-float-cue" aria-hidden="true">
        {label}
      </span>
      <span className="ob-pulse-beacon" aria-hidden="true">
        <span className="ob-pulse-beacon__core" />
      </span>
    </>
  );
}

function ChoiceIconCardsSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="16" height="20" rx="3" stroke="#c8b590" strokeWidth="1.5" />
      <path d="M9 13H17M9 17H15" stroke="#d3c2a0" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="26" cy="20" r="6.5" stroke="#9db5c7" strokeWidth="1.5" />
      <circle cx="26" cy="20" r="2.6" fill="#d3c2a0" />
      <path d="M21 15L24 17.5" stroke="#c8b590" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChoiceIconMicroSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <polygon
        points="18,4.5 29.5,11 29.5,25 18,31.5 6.5,25 6.5,11"
        stroke="#d3c2a0"
        strokeWidth="1.6"
        fill="rgba(200,181,144,0.14)"
      />
      <polygon
        points="18,10.5 23.8,14 23.8,21 18,24.5 12.2,21 12.2,14"
        stroke="#9db5c7"
        strokeWidth="1.3"
      />
      <circle cx="18" cy="17.5" r="2.6" fill="#d3c2a0" />
    </svg>
  );
}

function ChoiceIconSkipSvg(): React.JSX.Element {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="12" stroke="rgba(200,181,144,0.6)" strokeWidth="1.4" />
      <path
        d="M13 13L19 18L13 23M20 13L26 18L20 23"
        stroke="#d3c2a0"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuideSlideDiagram({ index }: { readonly index: number }): React.JSX.Element {
  if (index === 0) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="答题蓄能爆出鎏金法球">
        <g transform="translate(54, 32)">
          <rect x="0" y="0" width="148" height="130" rx="4" fill="#1b2433" stroke="#c8b590" strokeWidth="1.7" />
          <rect x="18" y="22" width="22" height="22" rx="4" fill="rgba(114,163,138,0.2)" stroke="#84ac96" strokeWidth="1.4" />
          <path d="M24 33L28 37L35 28" stroke="#84ac96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="50" y1="28" x2="126" y2="28" stroke="#d3c2a0" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="39" x2="104" y2="39" stroke="rgba(203,213,225,0.58)" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="18" y="60" width="112" height="22" rx="4" fill="rgba(200,181,144,0.16)" stroke="rgba(200,181,144,0.55)" strokeWidth="1.2" />
          <rect x="18" y="90" width="112" height="22" rx="4" fill="rgba(137,163,184,0.08)" stroke="rgba(137,163,184,0.22)" strokeWidth="1" />
          <text x="74" y="156" textAnchor="middle" fill="#cbd5e1" fontSize="13.5" fontWeight="600">战术简报答题</text>
        </g>

        <path d="M218 96 Q268 48 320 96" stroke="#c8b590" strokeWidth="2.2" className="ob-flow-line" />
        <polygon points="326,98 313,90 315,103" fill="#d3c2a0" />

        <g transform="translate(348, 28)">
          <circle cx="68" cy="68" r="54" stroke="rgba(200,181,144,0.34)" strokeWidth="1.4" strokeDasharray="4 5" />
          <circle cx="68" cy="68" r="40" fill="rgba(200,181,144,0.22)" stroke="#d3c2a0" strokeWidth="2.2" />
          <circle cx="56" cy="54" r="9" fill="rgba(255,252,240,0.4)" />
          <text x="68" y="75" textAnchor="middle" fill="#d3c2a0" fontSize="22" fontWeight="800">+2G</text>
          <text x="68" y="160" textAnchor="middle" fill="#c8b590" fontSize="13.5" fontWeight="700">鎏金法球</text>
        </g>

        <text x="514" y="104" textAnchor="middle" fill="#c8b590" fontSize="22" fontWeight="700">+</text>

        <g transform="translate(544, 32)">
          <circle cx="60" cy="64" r="42" stroke="rgba(137,163,184,0.2)" strokeWidth="6" />
          <path
            d="M60 22 A42 42 0 1 1 21 80"
            stroke="#9db5c7"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <text x="60" y="70" textAnchor="middle" fill="#f8fafc" fontSize="17" fontWeight="800">65%</text>
          <text x="60" y="156" textAnchor="middle" fill="#acc0cf" fontSize="13.5" fontWeight="600">星核充能</text>
        </g>
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="三张同卡聚拢跃升星级">
        {[
          { x: 64, y: 20 },
          { x: 64, y: 78 },
          { x: 64, y: 136 },
        ].map((pos, idx) => (
          <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x="0" y="0" width="124" height="46" rx="4" fill="#1b2433" stroke="#c8b590" strokeWidth="1.6" />
            <polygon points="26,13 29,20 36,20 30.5,24.5 32.5,31.5 26,27 19.5,31.5 21.5,24.5 16,20 23,20" fill="#9db5c7" />
            <text x="76" y="28" textAnchor="middle" fill="#d3c2a0" fontSize="15" fontWeight="700">1★ 同卡</text>
          </g>
        ))}

        <path d="M198 43 C270 43, 290 101, 376 101" stroke="#c8b590" strokeWidth="1.8" className="ob-flow-line" />
        <path d="M198 101 L376 101" stroke="#d3c2a0" strokeWidth="2.2" className="ob-flow-line" />
        <path d="M198 159 C270 159, 290 103, 376 103" stroke="#9db5c7" strokeWidth="1.8" className="ob-flow-line" />
        <rect x="256" y="86" width="62" height="28" rx="4" fill="#101b32" stroke="rgba(200,181,144,0.64)" strokeWidth="1.3" />
        <text x="287" y="105" textAnchor="middle" fill="#d3c2a0" fontSize="12.5" fontWeight="700">三合一</text>
        <polygon points="386,101 374,95 374,107" fill="#d3c2a0" />

        <g transform="translate(432, 16)">
          <rect x="74" y="4" width="52" height="148" rx="26" fill="rgba(200,181,144,0.16)" />
          <line x1="100" y1="8" x2="100" y2="146" stroke="#d3c2a0" strokeWidth="2.4" strokeDasharray="3 4" />
          <polygon
            points="100,112 154,132 134,158 66,158 46,132"
            fill="rgba(137,163,184,0.16)"
            stroke="#9db5c7"
            strokeWidth="1.7"
          />
          <circle cx="100" cy="82" r="35" fill="#182745" stroke="#d3c2a0" strokeWidth="2.4" />
          <text x="100" y="90" textAnchor="middle" fill="#ddca9f" fontSize="22" fontWeight="800">2★</text>
          <text x="100" y="182" textAnchor="middle" fill="#c8b590" fontSize="13.5" fontWeight="700">鎏金升星光柱</text>
        </g>
      </svg>
    );
  }

  if (index === 2) {
    return (
      <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="两件散件拖放直合成装">
        <g transform="translate(52, 40)">
          <rect x="0" y="0" width="118" height="110" rx="4" fill="#1b2433" stroke="#c8b590" strokeWidth="1.7" />
          <path d="M38 74L78 34M64 34H78V48M32 68L44 80" stroke="#d3c2a0" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="59" y="136" textAnchor="middle" fill="#cbd5e1" fontSize="13.5" fontWeight="600">钨芯刃</text>
        </g>

        <text x="196" y="104" textAnchor="middle" fill="#d3c2a0" fontSize="24" fontWeight="700">+</text>

        <g transform="translate(222, 40)">
          <rect x="0" y="0" width="118" height="110" rx="4" fill="#1b2433" stroke="#9db5c7" strokeWidth="1.7" />
          <path d="M32 68L78 34M42 78L88 44" stroke="#9db5c7" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="60" cy="56" r="6" fill="#d3c2a0" />
          <text x="59" y="136" textAnchor="middle" fill="#cbd5e1" fontSize="13.5" fontWeight="600">加速轨</text>
        </g>

        <line x1="362" y1="96" x2="458" y2="96" stroke="#c8b590" strokeWidth="2.2" className="ob-flow-line" />
        <polygon points="468,96 455,90 455,102" fill="#d3c2a0" />

        <g transform="translate(492, 24)">
          <polygon
            points="84,8 158,70 84,132 10,70"
            fill="rgba(200,181,144,0.18)"
            stroke="#d3c2a0"
            strokeWidth="2.2"

          />
          <polygon
            points="84,24 138,70 84,116 30,70"
            fill="#1b2433"
            stroke="#9db5c7"
            strokeWidth="1.4"
          />
          <path d="M56 82L112 58M62 66L106 48M68 92L112 74" stroke="#ddca9f" strokeWidth="2.3" strokeLinecap="round" />
          <text x="84" y="160" textAnchor="middle" fill="#c8b590" fontSize="14" fontWeight="700">洛伦兹连发轨</text>
        </g>
      </svg>
    );
  }

  return (
    <svg className="ob-diagram-svg" viewBox="0 0 720 220" fill="none" role="img" aria-label="布阵交锋双模商店随心切换">
      <g transform="translate(56, 28)">
        {[
          { cx: 56, cy: 52, active: true },
          { cx: 112, cy: 52, active: false },
          { cx: 168, cy: 52, active: false },
          { cx: 84, cy: 100, active: false },
          { cx: 140, cy: 100, active: true },
          { cx: 196, cy: 100, active: false },
        ].map((hex, i) => (
          <polygon
            key={i}
            points={`${hex.cx},${hex.cy - 26} ${hex.cx + 23},${hex.cy - 13} ${hex.cx + 23},${hex.cy + 13} ${hex.cx},${hex.cy + 26} ${hex.cx - 23},${hex.cy + 13} ${hex.cx - 23},${hex.cy - 13}`}
            fill={hex.active ? 'rgba(200,181,144,0.22)' : 'rgba(21,35,62,0.92)'}
            stroke={hex.active ? '#d3c2a0' : 'rgba(137,163,184,0.48)'}
            strokeWidth={hex.active ? '1.9' : '1.2'}
          />
        ))}
        <circle cx="56" cy="52" r="9" fill="#9db5c7" />
        <circle cx="140" cy="100" r="9" fill="#c8b590" />
        <path d="M68 44 C104 20, 134 44, 140 84" stroke="#d3c2a0" strokeWidth="1.8" strokeDasharray="4 4" />
        <path d="M128 108 C92 130, 62 106, 56 68" stroke="#9db5c7" strokeWidth="1.8" strokeDasharray="4 4" />
        <text x="124" y="158" textAnchor="middle" fill="#cbd5e1" fontSize="13.5" fontWeight="600">拖拽换位激活羁绊</text>
      </g>

      <line x1="316" y1="98" x2="424" y2="98" stroke="#c8b590" strokeWidth="2.2" className="ob-flow-line" />
      <polygon points="434,98 421,92 421,104" fill="#d3c2a0" />

      <g transform="translate(460, 26)">
        <rect x="12" y="14" width="176" height="122" rx="4" fill="#1b2433" stroke="#c8b590" strokeWidth="1.8" />
        <rect x="26" y="28" width="148" height="22" rx="4" fill="rgba(137,163,184,0.22)" stroke="#9db5c7" strokeWidth="1.2" />
        <text x="100" y="43" textAnchor="middle" fill="#acc0cf" fontSize="11.5" fontWeight="700">顶部悬浮抽屉</text>
        <rect x="26" y="64" width="148" height="22" rx="4" fill="rgba(137,163,184,0.1)" stroke="rgba(137,163,184,0.24)" strokeWidth="1" />
        <text x="100" y="79" textAnchor="middle" fill="#cbd5e1" fontSize="11">9 格备战席零遮挡</text>
        <rect x="26" y="100" width="148" height="24" rx="4" fill="rgba(200,181,144,0.22)" stroke="#c8b590" strokeWidth="1.3" />
        <text x="100" y="116" textAnchor="middle" fill="#d3c2a0" fontSize="11.5" fontWeight="700">底部零遮挡安全区</text>
        <text x="100" y="160" textAnchor="middle" fill="#c8b590" fontSize="13.5" fontWeight="700">双模商店自由切换</text>
      </g>
    </svg>
  );
}

export function OnboardingModal(): React.JSX.Element | null {
  const {
    onboardingOpen,
    onboardingInitialMode,
    closeOnboarding,
    profile,
    preferredTacticianId,
    patchUserProfile,
    getStageEngine,
    registerStageEngine,
    setCustomStageOverride,
    setExternalLearningOverlay,
    audioBus,
    pushToast,
  } = useAppStore();

  const [step, setStep] = useState<'choice' | 'cards' | 'micro_match'>(onboardingInitialMode);
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef<boolean>(false);

  const [microSnap, setMicroSnap] = useState<MatchRoomSnapshot | null>(null);
  const [microProg, setMicroProg] = useState<OnboardingMicroProgress | null>(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const [overSell, setOverSell] = useState<boolean>(false);

  const microCtrlRef = useRef<OnboardingMicroController | null>(null);
  const syncRef = useRef<SnapshotStageSynchronizer>(new SnapshotStageSynchronizer());
  const choreoRef = useRef<LiveBattleChoreographer>(new LiveBattleChoreographer());
  const battlePayloadRef = useRef<BattleBroadcastPayload | null>(null);

  useEffect(() => {
    if (!onboardingOpen) return;
    setStep(onboardingInitialMode);
    setCardIndex(0);
  }, [onboardingInitialMode, onboardingOpen]);

  useEffect(() => {
    if (!onboardingOpen || step !== 'cards') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCardIndex((i) => Math.min(FOUR_GUIDE_CARDS.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setCardIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onboardingOpen, step]);

  useEffect(() => {
    if (!onboardingOpen || step !== 'micro_match') {
      setExternalLearningOverlay('onboarding-sample', false);
      return;
    }

    setCustomStageOverride(true);
    const stage = getStageEngine();
    const prevSceneMode = stage?.getSceneMode() ?? 'lobby';
    if (stage) {
      stage.setSceneMode('match');
    }

    const ctrl = new OnboardingMicroController({
      onUpdate: (snap, prog) => {
        setMicroSnap(snap);
        setMicroProg(prog);
        setExternalLearningOverlay('onboarding-sample', prog.stageId === 'sample');
        const stEngine = getStageEngine();
        if (stEngine && prog.stageId !== 'battle') {
          choreoRef.current.stop();
          syncRef.current.syncSnapshot(stEngine, snap);
        }
      },
      onBattle: (payload) => {
        battlePayloadRef.current = payload;
        const stEngine = getStageEngine();
        if (stEngine && microCtrlRef.current) {
          const snap = microCtrlRef.current.scenario;
          choreoRef.current.start({
            stage: stEngine,
            snapshot: {
              roomId: 'onboarding-micro-room',
              matchId: 'onboarding-90s-micro',
              mode: 'quick',
              queueType: 'solo',
              phase: 'battle',
              phaseIndex: 3,
              deadlineEpochMs: Date.now() + 20_000,
              remainingSeconds: 20,
              round: 1,
              nodeIndex: 0,
              versionLock: {
                seasonTermId: 'onboarding-sandbox',
                gameSetVersion: 'season1-v1',
                coursePackVersion: '1.0.0',
              },
              seatId: snap.playerSeatId,
              self: structuredClone(
                snap.game.seats.find((s) => s.id === snap.playerSeatId)!,
              ),
              seats: snap.game.seats.map((s) => ({
                seatId: s.id,
                nickname: s.id,
                level: s.level,
                units: structuredClone(s.units.filter((u) => u.location.zone === 'board')),
                victoryPoints: 0,
                chosenAugments: [],
              })),
              learning: null,
              resourceSettlement: null,
              summary: null,
              completed: false,
              failure: null,
            },
            battlePayload: payload,
            viewedSeatId: snap.playerSeatId,
            stageSeatIndex: 0,
          });
        }
      },
      onFinished: () => {
        void finishChoiceAndProceed('micro_match');
      },
    });

    microCtrlRef.current = ctrl;

    if (stage) {
      stage.returnHome();
      stage.setCallbacks({
        onMoveUnit: (instanceId, to) => {
          ctrl.sendCommand({ type: 'MOVE_UNIT', instanceId, to });
        },
        onSellUnitRequest: (instanceId) => {
          ctrl.sendCommand({ type: 'SELL_UNIT', instanceId });
        },
        onCollectLootOrb: (orbId) => {
          syncRef.current.markOrbCollected(orbId);
        },
        onInspectUnit: (instanceId) => {
          if (instanceId && selectedItemIdxRef.current !== null) {
            ctrl.sendCommand({
              type: 'EQUIP_ITEM',
              inventoryItemIndex: selectedItemIdxRef.current,
              targetInstanceId: instanceId,
            });
            setSelectedItemIdx(null);
          }
        },
        onDragStateChange: (id, over) => {
          setDraggingUnitId(id);
          setOverSell(over);
        },
      });
    }

    ctrl.start();

    return () => {
      choreoRef.current.stop();
      ctrl.dispose();
      microCtrlRef.current = null;
      setMicroSnap(null);
      setMicroProg(null);
      setSelectedItemIdx(null);
      setDraggingUnitId(null);
      setOverSell(false);
      setExternalLearningOverlay('onboarding-sample', false);
      setCustomStageOverride(false);
      const currentEngine = getStageEngine();
      if (currentEngine) {
        currentEngine.setSceneMode(prevSceneMode === 'match' ? 'lobby' : prevSceneMode);
        registerStageEngine(currentEngine);
      }
    };
  }, [onboardingOpen, step]);

  const selectedItemIdxRef = useRef<number | null>(null);
  selectedItemIdxRef.current = selectedItemIdx;

  const [, setTick] = useState<number>(0);
  useEffect(() => {
    if (!onboardingOpen || step !== 'micro_match') return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [onboardingOpen, step]);

  if (!onboardingOpen) return null;

  const isFirstTimeUnset = profile?.onboardingChoice === 'unset';

  async function finishChoiceAndProceed(choice: 'cards' | 'micro_match' | 'skipped') {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await patchUserProfile({ onboardingChoice: choice });
      closeOnboarding();
    } catch (err) {
      const detail = err instanceof ApiClientError ? err.message : '请重试当前操作。';
      pushToast(`启航进度尚未确认保存。${detail}`, 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (step === 'micro_match' && microSnap && microProg) {
    const selfSeat = microSnap.self;
    const carryUnit = selfSeat.units.find((u) => u.unitId === 'S09') ?? selfSeat.units[0];
    const dotStepIndex =
      microProg.stageId === 'goal'
        ? 0
        : microProg.stageId === 'sample'
          ? 1
          : microProg.stageId === 'prep'
            ? 2
            : 3;

    const activePrepSpotlight: 'buy' | 'equip' | 'battle' = !microProg.checklist.mergedTwoStar
      ? 'buy'
      : !microProg.checklist.craftedRailgun && selfSeat.inventoryItems.length > 0
        ? 'equip'
        : 'battle';

    return (
      <div className="blc-micro-overlay" data-testid="onboarding-micro-scenario">
        <header className="ob-micro-topbar">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span className="ob-micro-title">实机演练</span>
            <div className="ob-progress-dots" aria-label="演练进度">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`ob-pdot ${
                    idx < dotStepIndex
                      ? 'ob-pdot--done'
                      : idx === dotStepIndex
                        ? 'ob-pdot--active'
                        : ''
                  }`.trim()}
                />
              ))}
            </div>
            <span className="ob-micro-task-chip">{resolveMicroTaskLabel(microProg)}</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="blc-clock-pill">
              {formatCompactClock(microProg.stageRemainingSec)}
            </span>
            <button
              type="button"
              className="sf-ghost-pill-btn"
              style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }}
              disabled={saving}
              onClick={() => void finishChoiceAndProceed('micro_match')}
              data-testid="skip-micro-scenario-btn"
            >
              跳过
            </button>
          </div>
        </header>

        {microProg.stageId === 'goal' ? (
          <div className="ob-goal-banner">
            <div className="ob-goal-steps">
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4.5 7L6.3 8.8L9.5 5.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>答题</span>
              </span>
              <span className="ob-goal-arrow">→</span>
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <polygon points="7,1.5 8.7,5 12.5,5.5 9.7,8.2 10.4,12 7,10.2 3.6,12 4.3,8.2 1.5,5.5 5.3,5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span>升 2★</span>
              </span>
              <span className="ob-goal-arrow">→</span>
              <span className="ob-goal-pill">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <polygon points="7,1.5 12.5,7 7,12.5 1.5,7" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <span>合装开战</span>
              </span>
            </div>

            <button
              type="button"
              className="sf-gold-btn"
              style={{ minHeight: 36, padding: '0 20px', fontSize: 13.5 }}
              onClick={() => microCtrlRef.current?.advanceStageNow()}
            >
              开始
            </button>
          </div>
        ) : null}

        {microProg.stageId === 'sample' ? (
          <div className="learning-briefing-backdrop" style={{ zIndex: 55 }}>
            <div className="learning-briefing-modal">
              <QuestionStepCard
                stepKind="resource_check"
                question={microProg.sampleQuestion}
                feedback={microProg.sampleFeedback}
                sharedRemainingSeconds={microProg.stageRemainingSec}
                sharedTotalSeconds={10}
                variant="overlay"
                audioBus={audioBus}
                submitLabel="提交"
                nextStepLabel="下一步"
                onSubmitAnswer={(sub: QuestionAnswerSubmission) =>
                  microCtrlRef.current?.submitSampleQuestion({
                    answer: sub.answer,
                    status: 'submitted',
                    hintUsed: sub.hintUsed,
                  })
                }
                onSkipQuestion={() =>
                  microCtrlRef.current?.submitSampleQuestion({
                    answer: null,
                    status: 'skipped',
                  })
                }
                onAdvanceStep={() => microCtrlRef.current?.advanceStageNow()}
              />
            </div>
          </div>
        ) : null}

        {microProg.stageId === 'prep' ? (
          <>
            <aside className="ob-hud-dock" data-testid="micro-checklist">
              <div className="ob-mini-checks">
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.mergedTwoStar ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.mergedTwoStar ? '✓' : '○'}</span>
                  <span>升 2★</span>
                </span>
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.craftedRailgun ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.craftedRailgun ? '✓' : '○'}</span>
                  <span>合主装</span>
                </span>
                <span
                  className={`ob-mini-check ${
                    microProg.checklist.repositionedUnit ? 'ob-mini-check--done' : ''
                  }`.trim()}
                >
                  <span>{microProg.checklist.repositionedUnit ? '✓' : '○'}</span>
                  <span>布阵</span>
                </span>
              </div>

              {selfSeat.inventoryItems.length > 0 ? (
                <div className="ob-equip-rack ob-spotlight-anchor">
                  {activePrepSpotlight === 'equip' ? (
                    <SpotlightCue label="点散件 · 装主核" />
                  ) : null}
                  {selfSeat.inventoryItems.map((itemId, idx) => {
                    const itemEntry = lookupItemById(itemId);
                    const preview = carryUnit ? previewItemEquip(carryUnit, itemId) : null;
                    const craftedEntry = preview?.craftedItemId
                      ? lookupItemById(preview.craftedItemId)
                      : null;
                    return (
                      <button
                        key={`${itemId}-${idx}`}
                        type="button"
                        className={`ob-equip-chip ${
                          selectedItemIdx === idx ? 'ob-equip-chip--selected' : ''
                        }`.trim()}
                        onClick={() => {
                          if (carryUnit) {
                            microCtrlRef.current?.sendCommand({
                              type: 'EQUIP_ITEM',
                              inventoryItemIndex: idx,
                              targetInstanceId: carryUnit.instanceId,
                            });
                          } else {
                            setSelectedItemIdx(idx);
                          }
                        }}
                        data-testid={`micro-equip-item-${idx}`}
                      >
                        <span>◆ {shortItemName(itemEntry?.item.name ?? itemId)}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>
                          {craftedEntry ? `→ ${craftedEntry.item.name}` : '穿戴'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="ob-spotlight-anchor">
                {activePrepSpotlight === 'battle' ? (
                  <SpotlightCue label="就绪 · 点击开战" />
                ) : null}
                <button
                  type="button"
                  className="sf-gold-btn"
                  style={{ width: '100%', minHeight: 40, fontSize: 14 }}
                  onClick={() => microCtrlRef.current?.advanceStageNow()}
                  data-testid="micro-start-battle-now-btn"
                >
                  开战
                </button>
              </div>
            </aside>

            <footer
              className="ui-metal-frame blc-micro-shop"
              style={{ overflow: 'visible' }}
            >
              {draggingUnitId ? (
                <div
                  className={`shop-sell-dropzone ${
                    overSell ? 'shop-sell-dropzone--magnet-active' : ''
                  }`.trim()}
                >
                  <span>松手出售</span>
                </div>
              ) : (
                <div className="blc-shop-row">
                  <div className="blc-shop-wallet">
                    <span className="gold-roller" style={{ fontSize: 22 }}>
                      {selfSeat.gold}G
                    </span>
                    <div
                      className="science-charge-ring"
                      style={
                        {
                          '--charge-pct': `${selfSeat.learningChargeCents}%`,
                        } as React.CSSProperties
                      }
                      title="充能环"
                    >
                      {selfSeat.learningChargeCents}
                    </div>
                  </div>

                  <div className="blc-shop-cards" style={{ overflow: 'visible' }}>
                    {selfSeat.shop.map((unitId, sIdx) => {
                      if (!unitId) {
                        return (
                          <div key={sIdx} className="blc-shop-empty">
                            已购入
                          </div>
                        );
                      }
                      const def = SEASON1_UNITS_BY_ID.get(unitId);
                      const copiesOwned = selfSeat.units.filter(
                        (u) => u.unitId === unitId && u.star === 1,
                      ).length;
                      const canMerge2 = copiesOwned >= 2;
                      const showShopSpotlight =
                        activePrepSpotlight === 'buy' && canMerge2;

                      return (
                        <div key={sIdx} className="ob-spotlight-anchor">
                          {showShopSpotlight ? (
                            <SpotlightCue label="买牌 · 升 2★" />
                          ) : null}
                          <button
                            type="button"
                            className={`shop-card ob-micro-shop-card shop-card--cost-${def?.cost ?? 1} ${
                              canMerge2 ? 'shop-card--merge-2star' : ''
                            }`.trim()}
                            disabled={selfSeat.gold < (def?.cost ?? 1)}
                            onClick={() =>
                              microCtrlRef.current?.sendCommand({
                                type: 'BUY_CARD',
                                shopIndex: sIdx,
                              })
                            }
                            data-testid={`micro-shop-slot-${sIdx}`}
                          >
                            <UnitPortrait
                              unitId={unitId}
                              size="card"
                              className="ob-micro-card-portrait"
                            />
                            <div className="ob-micro-card-traits">
                              {def?.faction ? (
                                <span className="ob-micro-trait-pill">{def.faction}</span>
                              ) : null}
                              {def?.role ? (
                                <span className="ob-micro-trait-pill">{def.role}</span>
                              ) : null}
                            </div>
                            {canMerge2 ? (
                              <span className="ob-micro-merge-tag">★ 升 2★</span>
                            ) : null}
                            <div className="ob-micro-card-scrim">
                              <div className="blc-shop-card__top">
                                <strong>{def?.name ?? unitId}</strong>
                                <span className="blc-gold-text">{def?.cost ?? 1}G</span>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </footer>
          </>
        ) : null}

        {microProg.stageId === 'summary' ? (
          <div className="blc-center-float">
            <div className="ui-metal-frame ob-summary-card">
              <svg width="46" height="46" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                <polygon
                  points="22,3 38,12 38,32 22,41 6,32 6,12"
                  fill="rgba(200,181,144,0.18)"
                  stroke="#d3c2a0"
                  strokeWidth="1.7"
                />
                <path
                  d="M15 22.5L20 27.5L29.5 17"
                  stroke="#ddca9f"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3 style={{ margin: 0, color: 'var(--accent-gold-bright)', fontSize: 21 }}>
                {microProg.battleOutcome === 'win' ? '演练胜利' : '演练完成'}
              </h3>
              <button
                type="button"
                className="sf-gold-btn"
                disabled={saving}
                onClick={() => void finishChoiceAndProceed('micro_match')}
                data-testid="micro-finish-continue-btn"
              >
                {isFirstTimeUnset ? '进入星港大厅' : '完成'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="启航引导"
      data-testid="onboarding-modal"
    >
      <div className="ob-minimal-panel">
        {step === 'choice' ? (
          <div key="choice" className="ob-stage-anim">
            <header className="ob-welcome-hero">
              <TacticianPortrait
                tacticianId={preferredTacticianId}
                size="md"
                alt="小小领航员"
              />
              <div className="ob-welcome-copy">
                <h2 className="ob-welcome-title">欢迎来到灵光之野</h2>
              </div>
              {!isFirstTimeUnset ? (
                <button
                  type="button"
                  className="sf-ghost-pill-btn"
                  disabled={saving}
                  onClick={closeOnboarding}
                >
                  关闭
                </button>
              ) : null}
            </header>

            <div className="ob-choices-grid" data-testid="onboarding-three-choices">
              <div className="ob-choice-card">
                <div className="ob-choice-icon">
                  <ChoiceIconCardsSvg />
                </div>
                <h3 className="ob-choice-title">核心图解</h3>
                <p className="ob-choice-sub">4 步图文演示</p>
                <button
                  type="button"
                  className="sf-ghost-pill-btn"
                  style={{ width: '100%', minHeight: 42 }}
                  disabled={saving}
                  onClick={() => setStep('cards')}
                  data-testid="onboarding-opt-cards"
                >
                  查看图解
                </button>
              </div>

              <div className="ob-choice-card ob-choice-card--featured">
                <span className="ob-choice-ribbon">推荐体验</span>
                <div className="ob-choice-icon">
                  <ChoiceIconMicroSvg />
                </div>
                <h3 className="ob-choice-title">实机演练</h3>
                <p className="ob-choice-sub">90 秒实战体验</p>
                <button
                  type="button"
                  className="sf-gold-btn"
                  style={{ width: '100%', minHeight: 42 }}
                  disabled={saving}
                  onClick={() => setStep('micro_match')}
                  data-testid="onboarding-opt-micro"
                >
                  开始演练
                </button>
              </div>

              <div className="ob-choice-card">
                <div className="ob-choice-icon">
                  <ChoiceIconSkipSvg />
                </div>
                <h3 className="ob-choice-title">直接进入</h3>
                <p className="ob-choice-sub">跳过新手引导</p>
                <button
                  type="button"
                  className="sf-ghost-pill-btn"
                  style={{ width: '100%', minHeight: 42 }}
                  disabled={saving}
                  onClick={() => void finishChoiceAndProceed('skipped')}
                  data-testid="onboarding-opt-skip"
                >
                  直接进入大厅
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'cards' ? (
          <div key="cards" className="ob-stage-anim">
            <header className="ob-cards-top">
              <span className="ob-step-counter">{FOUR_GUIDE_CARDS[cardIndex]!.step}</span>
              <button
                type="button"
                className="sf-ghost-pill-btn"
                style={{ minHeight: 32, padding: '0 14px', fontSize: 12.5 }}
                disabled={saving}
                onClick={() => void finishChoiceAndProceed('cards')}
                data-testid="cards-skip-now-btn"
              >
                跳过图解
              </button>
            </header>

            <div
              key={cardIndex}
              className="ob-diagram-stage ob-stage-anim"
              data-testid="guide-card-slide"
            >
              <h2 className="ob-diagram-title">{FOUR_GUIDE_CARDS[cardIndex]!.title}</h2>
              <p className="ob-diagram-caption">{FOUR_GUIDE_CARDS[cardIndex]!.caption}</p>
              <GuideSlideDiagram index={cardIndex} />
              <div className="ob-dots-row">
                {FOUR_GUIDE_CARDS.map((c, idx) => (
                  <button
                    key={c.step}
                    type="button"
                    className={`ob-dot-btn ${idx === cardIndex ? 'ob-dot-btn--active' : ''}`.trim()}
                    disabled={saving}
                    onClick={() => setCardIndex(idx)}
                    aria-label={`第 ${idx + 1} 页`}
                  />
                ))}
              </div>
            </div>

            <footer className="blc-onboarding-footer">
              <button
                type="button"
                className="sf-ghost-pill-btn"
                disabled={saving || cardIndex === 0}
                onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
              >
                上一页
              </button>

              {cardIndex < FOUR_GUIDE_CARDS.length - 1 ? (
                <button
                  type="button"
                  className="sf-gold-btn"
                  disabled={saving}
                  onClick={() => setCardIndex((i) => i + 1)}
                  data-testid="guide-card-next-btn"
                >
                  下一页
                </button>
              ) : (
                <button
                  type="button"
                  className="sf-gold-btn"
                  disabled={saving}
                  onClick={() => void finishChoiceAndProceed('cards')}
                  data-testid="guide-card-finish-btn"
                >
                  {isFirstTimeUnset ? '前往星港大厅' : '完成'}
                </button>
              )}
            </footer>
          </div>
        ) : null}
      </div>
    </div>
  );
}
