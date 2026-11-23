import React, { useEffect, useMemo, useState } from 'react';
import type { ArenaThemeId, CoursePackManifest, TacticianId } from '@pkg/contracts';
import { useDescriptionMode } from '@pkg/learning-ui';
import { httpClient } from '../api/httpClient.js';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import {
  TACTICIAN_CATALOG,
  bakePortraitNow,
  getArenaPreviewUrl,
} from '../stage/index.js';
import {
  useAppStore,
  type SettingsTab,
  type ShopDockPosition,
} from '../store/appStore.js';
import { GameUiIcon, type GameUiIconName } from './GameUiIcons.js';
import { ARENA_THEME_OPTIONS } from './PersistentStageCanvas.js';
import { TacticianPortrait } from './UnitPortrait.js';

const SETTINGS_TABS: readonly {
  id: SettingsTab;
  label: string;
  icon: GameUiIconName;
}[] = [
  { id: 'match', label: '对局与商店', icon: 'coin' },
  { id: 'display', label: '画面与舞台', icon: 'wardrobe' },
  { id: 'learning', label: '学习与引导', icon: 'spark' },
  { id: 'account', label: '账号与系统', icon: 'gear' },
];

const ARENA_ACCENT_BY_ID: Readonly<Record<ArenaThemeId, string>> = {
  orbital_elevator_port: 'linear-gradient(135deg, #1b3f66 0%, #10203a 58%, #9b7339 100%)',
  mercury_dyson_forge: 'linear-gradient(135deg, #5a2714 0%, #2a130e 58%, #c7852e 100%)',
  event_horizon_observatory: 'linear-gradient(135deg, #321b5c 0%, #130e29 58%, #be964f 100%)',
};

function readInitialArenaPreviews(): Record<ArenaThemeId, string> {
  return {
    orbital_elevator_port: getArenaPreviewUrl('orbital_elevator_port', { size: 256 }),
    mercury_dyson_forge: getArenaPreviewUrl('mercury_dyson_forge', { size: 256 }),
    event_horizon_observatory: getArenaPreviewUrl('event_horizon_observatory', { size: 256 }),
  };
}

function ShopLayoutDiagramSvg({
  position,
}: {
  readonly position: ShopDockPosition;
}): React.JSX.Element {
  const isBottom = position === 'bottom';
  const boardY = isBottom ? 34 : 52;
  const benchY = isBottom ? 114 : 138;
  const shopY = isBottom ? 136 : 24;

  return (
    <div className="sf-settings-diagram" data-testid="shop-layout-diagram" data-position={position}>
      <div className="sf-settings-diagram__head">
        <span className="sf-settings-diagram__title">布局预览</span>
        <span className="sf-settings-diagram__badge">
          {isBottom ? '底部商店' : '顶部抽屉'}
        </span>
      </div>

      <svg
        className="sf-settings-diagram__svg"
        viewBox="0 0 420 176"
        role="img"
        aria-label={isBottom ? '底部商店布局示意' : '顶部抽屉商店布局示意'}
      >
        <defs>
          <linearGradient id="sfDiagBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#142341" />
            <stop offset="55%" stopColor="#0e182e" />
            <stop offset="100%" stopColor="#091020" />
          </linearGradient>
          <linearGradient id="sfDiagBoard" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#253b64" stopOpacity="0.86" />
            <stop offset="100%" stopColor="#182846" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="sfDiagShop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f2c97d" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#4fd1ff" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f2c97d" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <rect x="2" y="2" width="416" height="172" rx="10" fill="url(#sfDiagBg)" stroke="rgba(148,179,224,0.28)" />

        <rect x="116" y="8" width="188" height="11" rx="5.5" fill="rgba(22,36,64,0.9)" stroke="rgba(242,201,125,0.34)" />
        <rect x="132" y="11.5" width="46" height="4" rx="2" fill="#f2c97d" opacity="0.82" />
        <rect x="188" y="11.5" width="76" height="4" rx="2" fill="#4fd1ff" opacity="0.65" />

        <g opacity="0.78">
          <rect x="12" y="34" width="38" height="14" rx="4" fill="rgba(26,42,74,0.85)" stroke="rgba(242,201,125,0.35)" />
          <rect x="12" y="53" width="38" height="14" rx="4" fill="rgba(26,42,74,0.85)" stroke="rgba(148,179,224,0.25)" />
          <rect x="12" y="72" width="38" height="14" rx="4" fill="rgba(26,42,74,0.85)" stroke="rgba(148,179,224,0.25)" />
          <rect x="12" y="91" width="38" height="14" rx="4" fill="rgba(26,42,74,0.85)" stroke="rgba(79,209,255,0.35)" />
        </g>

        <g opacity="0.78">
          {[0, 1, 2, 3, 4].map((idx) => (
            <rect
              key={idx}
              x="366"
              y={32 + idx * 18}
              width="42"
              height="13"
              rx="4"
              fill={idx === 0 ? 'rgba(242,201,125,0.2)' : 'rgba(26,42,74,0.85)'}
              stroke={idx === 0 ? 'rgba(242,201,125,0.72)' : 'rgba(148,179,224,0.25)'}
            />
          ))}
        </g>

        <g>
          <polygon
            points={`108,${boardY} 312,${boardY} 336,${boardY + 72} 84,${boardY + 72}`}
            fill="url(#sfDiagBoard)"
            stroke="rgba(79,209,255,0.45)"
            strokeWidth="1.2"
          />
          <line x1="96" y1={boardY + 36} x2="324" y2={boardY + 36} stroke="rgba(242,201,125,0.28)" strokeDasharray="4 4" />
          <text
            x="210"
            y={boardY + 32}
            textAnchor="middle"
            fill="#cbd5e1"
            fontSize="9.5"
            fontWeight="600"
          >
            3D 棋盘
          </text>
          <text
            x="210"
            y={boardY + 54}
            textAnchor="middle"
            fill="#7dd3fc"
            fontSize="8.5"
          >
            我方区域
          </text>
        </g>

        <g>
          <rect
            x="84"
            y={benchY}
            width="252"
            height="16"
            rx="4"
            fill="rgba(79,209,255,0.12)"
            stroke="rgba(79,209,255,0.72)"
            strokeWidth="1.1"
          />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
            <rect
              key={slot}
              x={92 + slot * 26.8}
              y={benchY + 3.5}
              width="21"
              height="9"
              rx="2.5"
              fill="rgba(79,209,255,0.34)"
            />
          ))}
          <text
            x="342"
            y={benchY + 11}
            fill="#a5f3fc"
            fontSize="8.5"
            fontWeight="700"
          >
            备战席
          </text>
        </g>

        <g>
          <rect
            x="64"
            y={shopY}
            width="292"
            height="32"
            rx="7"
            fill="url(#sfDiagShop)"
            stroke="#f2c97d"
            strokeWidth="1.4"
          />
          <rect x="72" y={shopY + 5} width="40" height="10" rx="3" fill="rgba(242,201,125,0.45)" />
          <rect x="72" y={shopY + 18} width="40" height="9" rx="3" fill="rgba(79,209,255,0.38)" />
          {[0, 1, 2, 3, 4].map((card) => (
            <rect
              key={card}
              x={118 + card * 46}
              y={shopY + 5}
              width="42"
              height="22"
              rx="4"
              fill="rgba(16,28,50,0.88)"
              stroke="rgba(242,201,125,0.58)"
              strokeWidth="0.9"
            />
          ))}
          <text
            x="233"
            y={shopY + 19}
            textAnchor="middle"
            fill="#fff0c4"
            fontSize="9"
            fontWeight="700"
          >
            {isBottom ? '底部英雄商店' : '顶部悬浮商店'}
          </text>
        </g>
      </svg>
    </div>
  );
}

export function SettingsModal(): React.JSX.Element | null {
  const {
    settingsModalOpen,
    settingsInitialTab,
    closeSettings,
    shopDockPosition,
    setShopDockPosition,
    preferredTacticianId,
    setPreferredTacticianId,
    arenaTheme,
    setArenaThemeLive,
    getStageEngine,
    profile,
    authMode,
    patchUserProfile,
    updateSelfRoomPrefs,
    lobbyState,
    inActiveMatch,
    isOfflineSandboxMatch,
    exitMatchToLobby,
    openOnboarding,
    logout,
    pushToast,
    setActiveTab,
    closeRedemption,
    setViewingPrepRoom,
  } = useAppStore();

  const [tab, setTab] = useState<SettingsTab>(settingsInitialTab);
  const [packs, setPacks] = useState<readonly CoursePackManifest[]>(() =>
    STARTER_COURSE_PACKS.map((p) => p.manifest),
  );
  const [englishNode, setEnglishNode] = useState<string>(
    profile?.learningStartSelections?.english ??
      STARTER_COURSE_PACKS[0]!.manifest.knowledgeGraph[0]!.nodeId,
  );
  const [mathNode, setMathNode] = useState<string>(
    profile?.learningStartSelections?.math ??
      STARTER_COURSE_PACKS[1]!.manifest.knowledgeGraph[0]!.nodeId,
  );
  const [savingLearning, setSavingLearning] = useState<boolean>(false);
  const [learningSaveError, setLearningSaveError] = useState<string | null>(null);
  const [savingDisplay, setSavingDisplay] = useState<boolean>(false);
  const [savingTacticianId, setSavingTacticianId] = useState<TacticianId | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState<string>(profile?.nickname ?? '');
  const [savingNickname, setSavingNickname] = useState<boolean>(false);
  const [arenaPreviews, setArenaPreviews] = useState<Record<ArenaThemeId, string>>(readInitialArenaPreviews);
  const { mode: descMode, isDetailed: descDetailed, setMode: setDescMode } = useDescriptionMode();

  const isOffline = authMode === 'offline_practice';
  const isStaff = profile?.role === 'admin' || profile?.role === 'editor';
  const isFullscreen = Boolean(profile?.displaySettings?.fullscreen);

  useEffect(() => {
    if (!settingsModalOpen) return;
    setTab(settingsInitialTab);
    setNicknameDraft(profile?.nickname ?? '');
    setLearningSaveError(null);
    const engDefault = STARTER_COURSE_PACKS[0]!.manifest.knowledgeGraph[0]!.nodeId;
    const mathDefault = STARTER_COURSE_PACKS[1]!.manifest.knowledgeGraph[0]!.nodeId;
    setEnglishNode(
      lobbyState.selfPrefs?.learningStartSelections?.english ??
        profile?.learningStartSelections?.english ??
        engDefault,
    );
    setMathNode(
      lobbyState.selfPrefs?.learningStartSelections?.math ??
        profile?.learningStartSelections?.math ??
        mathDefault,
    );

    if (authMode === 'authenticated') {
      void httpClient
        .getCoursePacks()
        .then((rows) => {
          if (rows.length > 0) setPacks(rows.map((r) => r.manifest));
        })
        .catch(() => undefined);
    }
  }, [
    authMode,
    lobbyState.selfPrefs?.learningStartSelections?.english,
    lobbyState.selfPrefs?.learningStartSelections?.math,
    profile?.learningStartSelections?.english,
    profile?.learningStartSelections?.math,
    profile?.nickname,
    settingsInitialTab,
    settingsModalOpen,
  ]);

  useEffect(() => {
    if (!settingsModalOpen || tab !== 'display') return;
    const current = readInitialArenaPreviews();
    setArenaPreviews(current);
    const renderer = getStageEngine()?.getRenderer() ?? null;
    if (!renderer) return;

    const pending = ARENA_THEME_OPTIONS.filter((opt) =>
      current[opt.id].startsWith('data:image/svg'),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    let rafId = 0;
    let idx = 0;

    const bakeNext = () => {
      if (cancelled || idx >= pending.length) return;
      const opt = pending[idx]!;
      idx += 1;
      const baked = bakePortraitNow('arena', opt.id, { size: 256, renderer });
      if (!cancelled && baked) {
        setArenaPreviews((prev) =>
          prev[opt.id] === baked ? prev : { ...prev, [opt.id]: baked },
        );
      }
      if (!cancelled && idx < pending.length) {
        rafId = window.requestAnimationFrame(bakeNext);
      }
    };

    rafId = window.requestAnimationFrame(bakeNext);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [getStageEngine, settingsModalOpen, tab]);

  useEffect(() => {
    if (!settingsModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSettings, settingsModalOpen]);

  const englishManifest = useMemo(
    () =>
      packs.find((m) => m.subject === 'english') ??
      STARTER_COURSE_PACKS[0]!.manifest,
    [packs],
  );
  const mathManifest = useMemo(
    () =>
      packs.find((m) => m.subject === 'math') ??
      STARTER_COURSE_PACKS[1]!.manifest,
    [packs],
  );

  if (!settingsModalOpen) return null;

  const handleToggleDisplayMode = async (fullscreen: boolean) => {
    if (savingDisplay) return;
    setSavingDisplay(true);
    try {
      await patchUserProfile({
        displaySettings: { fullscreen, orientation: 'landscape' },
      });
      pushToast(fullscreen ? '已切换至全屏横屏' : '已切换至窗口横屏', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '显示模式切换失败', 'warning');
    } finally {
      setSavingDisplay(false);
    }
  };

  const handleSelectTactician = async (id: TacticianId) => {
    if (savingTacticianId || id === preferredTacticianId) return;
    setSavingTacticianId(id);
    try {
      await setPreferredTacticianId(id);
      const chosen = TACTICIAN_CATALOG.find((item) => item.id === id);
      pushToast(`已切换领航员：${chosen?.name ?? id}`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '领航员切换失败', 'error');
    } finally {
      setSavingTacticianId(null);
    }
  };

  const handleSaveLearningStart = async () => {
    if (savingLearning) return;
    setSavingLearning(true);
    setLearningSaveError(null);
    const selections = {
      english: englishNode,
      math: mathNode,
    };
    try {
      if (authMode === 'authenticated' && lobbyState.prepRoom?.status === 'idle') {
        await updateSelfRoomPrefs({ learningStartSelections: selections });
      } else {
        await patchUserProfile({ learningStartSelections: selections });
      }
      pushToast('学习起始章节已保存', 'success');
    } catch {
      const msg = '保存失败，请检查连接后重试。';
      setLearningSaveError(msg);
      pushToast(msg, 'error');
    } finally {
      setSavingLearning(false);
    }
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nicknameDraft.trim();
    if (!trimmed || savingNickname) return;
    setSavingNickname(true);
    try {
      await patchUserProfile({ nickname: trimmed });
      pushToast('昵称已更新', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '更新昵称失败', 'error');
    } finally {
      setSavingNickname(false);
    }
  };

  const handleJumpWorkbench = () => {
    closeSettings();
    closeRedemption();
    setViewingPrepRoom(false);
    setActiveTab('profile');
  };

  const handleLogout = () => {
    closeSettings();
    void logout();
  };

  return (
    <div
      className="blc-modal-backdrop sf-settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="系统设置"
      data-testid="settings-modal"
      onClick={closeSettings}
    >
      <div
        className="ui-metal-frame ui-corner-ornaments sf-settings-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sf-settings-header">
          <div className="sf-settings-header__title">
            <span className="sf-settings-header__icon" aria-hidden="true"><GameUiIcon name="gear" size={18} /></span>
            <h2>设置</h2>
          </div>
          <button
            type="button"
            className="sf-settings-close-btn"
            aria-label="关闭设置"
            onClick={closeSettings}
            data-testid="settings-close-btn"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="sf-settings-body">
          <nav className="sf-settings-nav" aria-label="设置分类">
            {SETTINGS_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sf-settings-nav__item ${active ? 'sf-settings-nav__item--active' : ''}`.trim()}
                  onClick={() => setTab(item.id)}
                  data-testid={`settings-tab-${item.id}`}
                >
                  <span
                    className="sf-settings-nav__glyph"
                    aria-hidden="true"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <GameUiIcon name={item.icon} size={14} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="sf-settings-panel">
            {tab === 'match' ? (
              <div className="sf-settings-section-stack">
                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>英雄商店布局</h3>
                  </div>

                  <div className="sf-settings-radio-grid" role="radiogroup" aria-label="英雄商店位置">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={shopDockPosition === 'bottom'}
                      className={`sf-settings-radio-card ${shopDockPosition === 'bottom' ? 'sf-settings-radio-card--active' : ''}`.trim()}
                      onClick={() => setShopDockPosition('bottom')}
                      data-testid="shop-dock-bottom-btn"
                    >
                      <div className="sf-settings-radio-card__top">
                        <strong>底部商店</strong>
                        <span className="sf-settings-pill sf-settings-pill--gold">推荐</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={shopDockPosition === 'top'}
                      className={`sf-settings-radio-card ${shopDockPosition === 'top' ? 'sf-settings-radio-card--active' : ''}`.trim()}
                      onClick={() => setShopDockPosition('top')}
                      data-testid="shop-dock-top-btn"
                    >
                      <div className="sf-settings-radio-card__top">
                        <strong>顶部抽屉</strong>
                      </div>
                    </button>
                  </div>

                  <ShopLayoutDiagramSvg position={shopDockPosition} />
                </div>

                <div className="sf-settings-card" data-testid="desc-mode-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>描述展示模式</h3>
                    <span className="blc-chip">{descDetailed ? '详细数值' : '简洁缩略'}</span>
                  </div>

                  <div className="sf-settings-radio-grid" role="group" aria-label="描述展示模式">
                    <button
                      type="button"
                      aria-pressed={descMode === 'compact'}
                      className={`sf-settings-radio-card ${descMode === 'compact' ? 'sf-settings-radio-card--active' : ''}`.trim()}
                      onClick={() => setDescMode('compact')}
                      data-testid="desc-mode-compact-btn"
                    >
                      <div className="sf-settings-radio-card__top">
                        <strong>简洁缩略（默认）</strong>
                        <span className="sf-settings-pill sf-settings-pill--gold">推荐</span>
                      </div>
                      <span className="sf-settings-radio-card__desc">
                        隐藏复杂数值，聚焦核心效果与机制
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={descMode === 'detailed'}
                      className={`sf-settings-radio-card ${descMode === 'detailed' ? 'sf-settings-radio-card--active' : ''}`.trim()}
                      onClick={() => setDescMode('detailed')}
                      data-testid="desc-mode-detailed-btn"
                    >
                      <div className="sf-settings-radio-card__top">
                        <strong>详细数值</strong>
                      </div>
                      <span className="sf-settings-radio-card__desc">
                        展开完整百分比、秒数与技能系数
                      </span>
                    </button>
                  </div>
                </div>

                {inActiveMatch && isOfflineSandboxMatch ? (
                  <div className="sf-settings-card">
                    <div className="sf-settings-card__head">
                      <h3>单人演练</h3>
                    </div>
                    <div className="sf-settings-inline-actions">
                      <button
                        type="button"
                        className="blc-btn blc-btn--danger blc-btn--sm"
                        onClick={() => {
                          closeSettings();
                          exitMatchToLobby();
                        }}
                        data-testid="quit-offline-match-btn"
                      >
                        结束演练并返回大厅
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === 'display' ? (
              <div className="sf-settings-section-stack">
                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>显示模式</h3>
                    <span className="blc-chip">{isFullscreen ? '全屏横屏' : '窗口横屏'}</span>
                  </div>
                  <div className="sf-settings-inline-actions">
                    <button
                      type="button"
                      className={`blc-btn blc-btn--sm ${!isFullscreen ? 'blc-btn--primary' : 'blc-btn--ghost'}`}
                      disabled={savingDisplay}
                      onClick={() => void handleToggleDisplayMode(false)}
                      data-testid="display-landscape-window-btn"
                    >
                      窗口横屏
                    </button>
                    <button
                      type="button"
                      className={`blc-btn blc-btn--sm ${isFullscreen ? 'blc-btn--primary' : 'blc-btn--ghost'}`}
                      disabled={savingDisplay}
                      onClick={() => void handleToggleDisplayMode(true)}
                      data-testid="display-landscape-fullscreen-btn"
                    >
                      全屏横屏
                    </button>
                  </div>
                </div>

                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>竞技场舞台</h3>
                  </div>
                  <div className="sf-settings-arena-grid">
                    {ARENA_THEME_OPTIONS.map((opt) => {
                      const active = arenaTheme === opt.id;
                      const previewUrl = arenaPreviews[opt.id] ?? getArenaPreviewUrl(opt.id, { size: 256 });
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`sf-settings-arena-card ${active ? 'sf-settings-arena-card--active' : ''}`.trim()}
                          onClick={() => void setArenaThemeLive(opt.id)}
                          data-testid={`settings-arena-${opt.id}`}
                        >
                          <div
                            className="sf-settings-arena-card__thumb"
                            style={{ background: ARENA_ACCENT_BY_ID[opt.id] }}
                          >
                            <img src={previewUrl} alt={opt.name} draggable={false} />
                            {active ? <span className="sf-settings-equipped-tag">已装备</span> : null}
                          </div>
                          <div className="sf-settings-arena-card__meta">
                            <strong>{opt.name}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>小小领航员</h3>
                  </div>
                  <div className="sf-settings-tactician-grid">
                    {TACTICIAN_CATALOG.map((item) => {
                      const active = preferredTacticianId === item.id;
                      const busy = savingTacticianId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={Boolean(savingTacticianId)}
                          className={`sf-settings-tactician-card ${active ? 'sf-settings-tactician-card--active' : ''}`.trim()}
                          onClick={() => void handleSelectTactician(item.id)}
                          data-testid={`settings-tactician-${item.id}`}
                        >
                          <TacticianPortrait
                            tacticianId={item.id}
                            size="md"
                            alt={item.name}
                          />
                          <div className="sf-settings-tactician-card__info">
                            <strong>{item.name}</strong>
                            {busy ? (
                              <span className="sf-settings-tactician-card__status">切换中…</span>
                            ) : active ? (
                              <span className="sf-settings-pill sf-settings-pill--gold">出战中</span>
                            ) : (
                              <span className="sf-settings-tactician-card__status">点击出战</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'learning' ? (
              <div className="sf-settings-section-stack">
                <div className="sf-settings-card" data-testid="learning-start-selector">
                  <div className="sf-settings-card__head">
                    <h3>起始章节</h3>
                  </div>

                  <div className="sf-settings-learning-grid">
                    <label className="blc-field">
                      <span className="blc-field__label">英语</span>
                      <select
                        className="blc-select"
                        value={englishNode}
                        onChange={(e) => setEnglishNode(e.target.value)}
                        data-testid="settings-english-start-select"
                      >
                        {englishManifest.knowledgeGraph.map((node, idx) => (
                          <option key={node.nodeId} value={node.nodeId}>
                            第 {idx + 1} 节 · {node.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="blc-field">
                      <span className="blc-field__label">数学</span>
                      <select
                        className="blc-select"
                        value={mathNode}
                        onChange={(e) => setMathNode(e.target.value)}
                        data-testid="settings-math-start-select"
                      >
                        {mathManifest.knowledgeGraph.map((node, idx) => (
                          <option key={node.nodeId} value={node.nodeId}>
                            第 {idx + 1} 节 · {node.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="sf-settings-inline-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary blc-btn--sm"
                      disabled={savingLearning}
                      onClick={() => void handleSaveLearningStart()}
                      data-testid="save-learning-start-btn"
                    >
                      {savingLearning ? '保存中…' : '保存章节'}
                    </button>
                  </div>
                  {learningSaveError ? (
                    <div
                      className="blc-alert blc-alert--error"
                      role="alert"
                      style={{ marginTop: 10 }}
                      data-testid="learning-start-save-error"
                    >
                      {learningSaveError}
                    </div>
                  ) : null}
                </div>

                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>新手引导</h3>
                    {inActiveMatch ? <span className="blc-chip">对局后可用</span> : null}
                  </div>
                  <div className="sf-settings-inline-actions">
                    <button
                      type="button"
                      className="blc-btn blc-btn--metal blc-btn--sm"
                      disabled={inActiveMatch}
                      onClick={() => {
                        closeSettings();
                        openOnboarding('cards');
                      }}
                      data-testid="replay-onboarding-choice-btn"
                    >
                      重看核心图解
                    </button>
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary blc-btn--sm"
                      disabled={inActiveMatch}
                      onClick={() => {
                        closeSettings();
                        openOnboarding('micro_match');
                      }}
                      data-testid="replay-micro-scenario-btn"
                    >
                      重玩实机演练
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'account' ? (
              <div className="sf-settings-section-stack">
                <div className="sf-settings-card">
                  <div className="sf-settings-card__head">
                    <h3>账号信息</h3>
                    <span className="blc-chip blc-chip--gold">
                      {isOffline ? '单机模式' : profile?.username ?? '—'}
                    </span>
                  </div>
                  <form className="sf-settings-nickname-form" onSubmit={(e) => void handleSaveNickname(e)}>
                    <label className="blc-field" style={{ flex: 1 }}>
                      <span className="blc-field__label">昵称</span>
                      <input
                        type="text"
                        className="blc-input"
                        maxLength={24}
                        required
                        disabled={savingNickname}
                        value={nicknameDraft}
                        onChange={(e) => setNicknameDraft(e.target.value)}
                        data-testid="settings-nickname-input"
                      />
                    </label>
                    <button
                      type="submit"
                      className="blc-btn blc-btn--primary blc-btn--sm"
                      disabled={savingNickname || !nicknameDraft.trim()}
                      data-testid="settings-save-nickname-btn"
                    >
                      {savingNickname ? '保存中…' : '保存'}
                    </button>
                  </form>
                </div>

                {isStaff ? (
                  <div className="sf-settings-card sf-settings-card--accent">
                    <div className="sf-settings-card__head">
                      <h3>题库工作台</h3>
                      <span className="blc-chip blc-chip--gold">
                        {profile?.role === 'admin' ? '管理员' : '编辑'}
                      </span>
                    </div>
                    <div className="sf-settings-inline-actions">
                      <button
                        type="button"
                        className="blc-btn blc-btn--metal blc-btn--sm"
                        disabled={inActiveMatch}
                        onClick={handleJumpWorkbench}
                        data-testid="settings-goto-workbench-btn"
                      >
                        打开题库工作台
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="sf-settings-card sf-settings-card--danger">
                  <div className="sf-settings-card__head">
                    <h3>退出登录</h3>
                  </div>
                  <div className="sf-settings-inline-actions">
                    <button
                      type="button"
                      className="blc-btn blc-btn--ghost blc-btn--sm sf-settings-logout-btn"
                      onClick={handleLogout}
                      data-testid="explicit-logout-btn"
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
