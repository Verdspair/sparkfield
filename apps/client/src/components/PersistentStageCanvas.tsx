import React, { useEffect, useRef } from 'react';
import type { ArenaThemeId } from '@pkg/contracts';
import {
  BoardStageEngine,
  DEFAULT_TACTICIAN_ID,
  prebakePortraitsAsync,
  type ShopCameraLayout,
  type StageSceneMode,
  type TacticianId,
} from '../stage/index.js';
import { useAppStore } from '../store/appStore.js';

export const ARENA_THEME_OPTIONS: readonly {
  id: ArenaThemeId;
  name: string;
  subtitle: string;
}[] = [
  {
    id: 'orbital_elevator_port',
    name: '天梯港',
    subtitle: '',
  },
  {
    id: 'mercury_dyson_forge',
    name: '戴森熔炉',
    subtitle: '',
  },
  {
    id: 'event_horizon_observatory',
    name: '视界观测台',
    subtitle: '',
  },
];

export interface PersistentStageCanvasProps {
  readonly sceneMode?: StageSceneMode;
  readonly tacticianId?: TacticianId;
  readonly shopCameraLayout?: ShopCameraLayout;
  readonly onTacticianTap?: (tacticianId: TacticianId, variant: number) => void;
}

export function PersistentStageCanvas({
  sceneMode,
  tacticianId,
  shopCameraLayout,
  onTacticianTap,
}: PersistentStageCanvasProps = {}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BoardStageEngine | null>(null);
  const onTacticianTapRef = useRef(onTacticianTap);
  onTacticianTapRef.current = onTacticianTap;

  const {
    audioBus,
    arenaTheme,
    authMode,
    entryGatePassed,
    inActiveMatch,
    onboardingOpen,
    onboardingInitialMode,
    redemptionOpen,
    activeTab,
    viewingPrepRoom,
    lobbyState,
    preferredTacticianId,
    shopDockPosition,
    shopCollapsed,
    matchSnapshot,
    registerStageEngine,
  } = useAppStore();

  const isMicroMatch = onboardingOpen && onboardingInitialMode === 'micro_match';
  const derivedSceneMode: StageSceneMode =
    sceneMode ??
    (authMode === 'booting' || authMode === 'unauthenticated' || (authMode === 'authenticated' && !entryGatePassed)
      ? 'splash'
      : inActiveMatch || isMicroMatch
        ? 'match'
        : !redemptionOpen && activeTab === 'lobby' && viewingPrepRoom && Boolean(lobbyState.prepRoom)
          ? 'prep'
          : !redemptionOpen && activeTab === 'lobby'
            ? 'lobby'
            : 'subpage');

  const resolvedTacticianId: TacticianId = tacticianId ?? preferredTacticianId ?? DEFAULT_TACTICIAN_ID;
  const isStrategyPhase =
    !inActiveMatch ||
    matchSnapshot?.phase === 'strategy' ||
    (matchSnapshot?.phase === 'learning' && Boolean(matchSnapshot.learning?.complete));
  const derivedShopLayout: ShopCameraLayout =
    shopCameraLayout ??
    (isStrategyPhase && shopDockPosition === 'bottom' && !shopCollapsed
      ? 'bottom_open'
      : 'top_or_collapsed');
  const resolvedShopCameraLayout: ShopCameraLayout = derivedShopLayout;

  const initialThemeRef = useRef(arenaTheme);
  const initialModeRef = useRef(derivedSceneMode);
  const initialTacticianRef = useRef(resolvedTacticianId);
  const initialLayoutRef = useRef(resolvedShopCameraLayout);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const engine = new BoardStageEngine(el, {
      initialTheme: initialThemeRef.current,
      initialPhase: 'strategy',
      initialSceneMode: initialModeRef.current,
      initialTacticianId: initialTacticianRef.current,
      initialShopCameraLayout: initialLayoutRef.current,
      showBuiltInHudOverlay: true,
      interactiveDeployEnabled: true,
      audioBus,
      callbacks: {
        onTacticianTap: (tid, variant) => {
          onTacticianTapRef.current?.(tid, variant);
        },
      },
    });
    engineRef.current = engine;
    registerStageEngine(engine);

    const win = window as unknown as {
      __getStagePerfStats?: () => ReturnType<BoardStageEngine['getPerfStats']>;
      __getStageEngine?: () => BoardStageEngine;
    };
    win.__getStagePerfStats = () => engine.getPerfStats();
    win.__getStageEngine = () => engine;

    void prebakePortraitsAsync({ renderer: engine.getRenderer() });

    return () => {
      delete win.__getStagePerfStats;
      delete win.__getStageEngine;
      engineRef.current = null;
      registerStageEngine(null);
      engine.dispose();
    };
  }, [audioBus, registerStageEngine]);

  useEffect(() => {
    engineRef.current?.setSceneMode(derivedSceneMode);
  }, [derivedSceneMode]);

  useEffect(() => {
    engineRef.current?.setTactician(resolvedTacticianId);
  }, [resolvedTacticianId]);

  useEffect(() => {
    engineRef.current?.setShopCameraLayout(resolvedShopCameraLayout);
  }, [resolvedShopCameraLayout]);

  return (
    <div
      ref={containerRef}
      className="blc-persistent-stage"
      data-testid="persistent-stage-canvas"
      data-scene-mode={derivedSceneMode}
      aria-label="SparkField 灵光之野 3D 舞台"
    />
  );
}
