import React, { useEffect, useRef } from 'react';
import type { ArenaThemeId } from '@pkg/contracts';
import { BoardStageEngine } from '../stage/index.js';
import { useAppStore } from '../store/appStore.js';

export const ARENA_THEME_OPTIONS: readonly {
  id: ArenaThemeId;
  name: string;
  subtitle: string;
}[] = [
  {
    id: 'orbital_elevator_port',
    name: '天梯港',
    subtitle: '近地轨道天梯',
  },
  {
    id: 'mercury_dyson_forge',
    name: '戴森熔炉',
    subtitle: '水星日冕镜阵',
  },
  {
    id: 'event_horizon_observatory',
    name: '视界观测台',
    subtitle: '黑洞引力星环',
  },
];

export function PersistentStageCanvas(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { audioBus, arenaTheme, registerStageEngine } = useAppStore();
  const initialThemeRef = useRef(arenaTheme);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const engine = new BoardStageEngine(el, {
      initialTheme: initialThemeRef.current,
      initialPhase: 'strategy',
      showBuiltInHudOverlay: true,
      interactiveDeployEnabled: true,
      audioBus,
    });
    registerStageEngine(engine);
    (window as unknown as { __getStagePerfStats?: () => ReturnType<BoardStageEngine['getPerfStats']> }).__getStagePerfStats =
      () => engine.getPerfStats();

    return () => {
      delete (window as unknown as { __getStagePerfStats?: unknown }).__getStagePerfStats;
      registerStageEngine(null);
      engine.dispose();
    };
  }, [audioBus]);

  return (
    <div
      ref={containerRef}
      className="blc-persistent-stage"
      data-testid="persistent-stage-canvas"
      aria-label="光锥之外棋盘舞台"
    />
  );
}

export function ArenaThemeSwitcher({
  compact = false,
}: {
  readonly compact?: boolean;
}): React.JSX.Element {
  const { arenaTheme, setArenaThemeLive } = useAppStore();

  return (
    <div
      className="ui-frosted-panel blc-arena-switcher"
      style={{
        padding: compact ? '3px' : '4px',
        borderRadius: 999,
        border: '1px solid rgba(240, 220, 170, 0.22)',
        background: 'rgba(12, 16, 24, 0.68)',
        gap: 3,
      }}
      role="group"
      aria-label="舞台切换"
      data-testid="arena-theme-switcher"
    >
      <div className="blc-arena-switcher__pills" style={{ gap: 3 }}>
        {ARENA_THEME_OPTIONS.map((opt) => {
          const active = arenaTheme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`blc-pill-btn ${active ? 'blc-pill-btn--active' : ''}`.trim()}
              style={{
                minHeight: compact ? 28 : 32,
                padding: compact ? '3px 10px' : '4px 12px',
                borderRadius: 999,
                fontSize: compact ? 11.5 : 12,
                border: active
                  ? '1px solid rgba(240, 220, 170, 0.55)'
                  : '1px solid transparent',
                background: active ? 'rgba(200, 170, 110, 0.2)' : 'transparent',
              }}
              onClick={() => void setArenaThemeLive(opt.id)}
              title={opt.subtitle}
              data-testid={`arena-theme-${opt.id}`}
            >
              {opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
