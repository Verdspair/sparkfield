import React, { useEffect, useMemo, useState } from 'react';
import {
  SEASON1_AUGMENTS,
  SEASON1_ITEMS,
  SEASON1_LORE,
  SEASON1_TRAITS,
  SEASON1_UNITS,
  type ArenaThemeId,
  type AugmentDef,
  type UnitDef,
} from '@pkg/contracts';
import { DescriptionModeToggle, GameEffectText, LoreArchiveReader, UnitLoreDrawer } from '@pkg/learning-ui';
import { EquipmentCodexMatrix } from '../components/EquipmentCodexMatrix.js';
import { ARENA_THEME_OPTIONS } from '../components/PersistentStageCanvas.js';
import { SubpageShell } from '../components/SubpageShell.js';
import { TacticianPortrait, UnitPortrait } from '../components/UnitPortrait.js';
import {
  TACTICIAN_CATALOG,
  bakePortraitNow,
  getArenaPreviewUrl,
  type TacticianId,
} from '../stage/index.js';
import { useAppStore } from '../store/appStore.js';
import './subpages.css';

type EncyclopediaTab =
  | 'tacticians'
  | 'arenas'
  | 'units'
  | 'traits'
  | 'items'
  | 'augments'
  | 'lore';

interface NormalizedTraitEntry {
  id: string;
  name: string;
  kindLabel: '派系' | '职能' | '专属';
  thresholds: number[];
  desc: string;
  emblemId?: string;
}



const ARENA_LORE_DESCRIPTIONS: Readonly<Record<ArenaThemeId, string>> = {
  orbital_elevator_port: '晨曦天青穹顶与近地轨道天梯，适合清晰辨识棋子站位与法球动线。',
  mercury_dyson_forge: '恒星琥珀日冕与戴森聚光镜阵，炽金光影衬托高费核心弈子。',
  event_horizon_observatory: '深空紫晶星雾与悬浮吸积环，展现星际观测站的冷月金属质感。',
};

const COST_FILTERS: readonly (0 | 1 | 2 | 3 | 4 | 5)[] = [0, 1, 2, 3, 4, 5];

function readInitialEncyclopediaTab(): EncyclopediaTab {
  try {
    const requested = window.sessionStorage.getItem('sf_enc_open_tab');
    if (requested) {
      window.sessionStorage.removeItem('sf_enc_open_tab');
      if (requested === 'tacticians' || requested === 'arenas') {
        return requested;
      }
    }
  } catch {
  }
  return 'units';
}

export function EncyclopediaPage(): React.JSX.Element {
  const {
    audioBus,
    preferredTacticianId,
    setPreferredTacticianId,
    arenaTheme,
    setArenaThemeLive,
    getStageEngine,
    pushToast,
  } = useAppStore();

  const [activeCategory, setActiveCategory] = useState<EncyclopediaTab>(readInitialEncyclopediaTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [costFilter, setCostFilter] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [previewTacticianId, setPreviewTacticianId] = useState<TacticianId>(preferredTacticianId);
  const [previewArenaId, setPreviewArenaId] = useState<ArenaThemeId>(arenaTheme);
  const [equippingTactician, setEquippingTactician] = useState<boolean>(false);
  const [equippingArena, setEquippingArena] = useState<boolean>(false);
  const [arenaBakeTick, setArenaBakeTick] = useState<number>(0);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<NormalizedTraitEntry | null>(null);
  const [selectedAugment, setSelectedAugment] = useState<AugmentDef | null>(null);

  useEffect(() => {
    setPreviewTacticianId(preferredTacticianId);
  }, [preferredTacticianId]);

  useEffect(() => {
    setPreviewArenaId(arenaTheme);
  }, [arenaTheme]);

  useEffect(() => {
    if (activeCategory !== 'arenas') return;
    const renderer = getStageEngine()?.getRenderer() ?? null;
    if (!renderer) return;

    const pendingThumbs = ARENA_THEME_OPTIONS.filter((opt) =>
      getArenaPreviewUrl(opt.id, { size: 256 }).startsWith('data:image/svg'),
    );
    const needHero = getArenaPreviewUrl(previewArenaId, { size: 512 }).startsWith('data:image/svg');
    if (pendingThumbs.length === 0 && !needHero) return;

    let cancelled = false;
    let rafId = 0;
    let idx = 0;

    const runNext = () => {
      if (cancelled) return;
      if (idx < pendingThumbs.length) {
        const opt = pendingThumbs[idx]!;
        idx += 1;
        bakePortraitNow('arena', opt.id, { size: 256, renderer });
        setArenaBakeTick((v) => v + 1);
        rafId = window.requestAnimationFrame(runNext);
        return;
      }
      if (needHero) {
        bakePortraitNow('arena', previewArenaId, { size: 512, renderer });
        setArenaBakeTick((v) => v + 1);
      }
    };

    rafId = window.requestAnimationFrame(runNext);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [activeCategory, getStageEngine, previewArenaId]);

  const q = searchQuery.trim().toLowerCase();

  const allTraits: NormalizedTraitEntry[] = useMemo(
    () => [
      ...SEASON1_TRAITS.factions.map((f) => ({
        id: f.id,
        name: f.name,
        kindLabel: '派系' as const,
        thresholds: [...f.thresholds],
        desc: f.desc,
        emblemId: f.emblemId,
      })),
      ...SEASON1_TRAITS.roles.map((r) => ({
        id: r.id,
        name: r.name,
        kindLabel: '职能' as const,
        thresholds: [...r.thresholds],
        desc: r.desc,
      })),
      ...SEASON1_TRAITS.uniques.map((u) => ({
        id: u.id,
        name: u.name,
        kindLabel: '专属' as const,
        thresholds: [...u.thresholds],
        desc: u.desc,
      })),
    ],
    [],
  );

  const totalItemCount =
    SEASON1_ITEMS.components.length +
    1 +
    SEASON1_ITEMS.completedItems.length +
    SEASON1_ITEMS.emblems.length +
    1 +
    SEASON1_ITEMS.special.consumables.length;

  const filteredUnits = useMemo(() => {
    return SEASON1_UNITS.filter((u) => {
      if (costFilter !== 0 && u.cost !== costFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.faction.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.uniqueTrait && u.uniqueTrait.toLowerCase().includes(q)) ||
        u.skillSummary.toLowerCase().includes(q)
      );
    });
  }, [costFilter, q]);

  const filteredTraits = useMemo(() => {
    if (!q) return allTraits;
    return allTraits.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.kindLabel.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q),
    );
  }, [allTraits, q]);



  const filteredAugments = useMemo(() => {
    if (!q) return SEASON1_AUGMENTS;
    return SEASON1_AUGMENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tailorTraits.some((t) => t.toLowerCase().includes(q)),
    );
  }, [q]);

  const closeAllDrawers = () => {
    setSelectedUnitId(null);
    setSelectedTrait(null);
    setSelectedAugment(null);
  };

  const handleCloseDrawer = () => {
    audioBus.emit('onUiFeedback', { kind: 'close' });
    closeAllDrawers();
  };

  const selectCategory = (cat: EncyclopediaTab) => {
    if (activeCategory !== cat) {
      audioBus.emit('onUiFeedback', { kind: 'toggle' });
      setActiveCategory(cat);
    }
  };

  const openUnit = (unit: UnitDef | string) => {
    audioBus.emit('onUiFeedback', { kind: 'open' });
    closeAllDrawers();
    setActiveCategory('units');
    setSelectedUnitId(typeof unit === 'string' ? unit : unit.id);
  };

  const formatAugmentTier = (tier: AugmentDef['tier']) =>
    tier === 'prismatic' ? '棱彩' : tier === 'gold' ? '黄金' : '白银';

  const previewTactician =
    TACTICIAN_CATALOG.find((t) => t.id === previewTacticianId) ?? TACTICIAN_CATALOG[0]!;
  const previewArena =
    ARENA_THEME_OPTIONS.find((a) => a.id === previewArenaId) ?? ARENA_THEME_OPTIONS[0]!;

  const handleEquipTactician = async () => {
    if (equippingTactician || preferredTacticianId === previewTactician.id) return;
    audioBus.emit('onUiFeedback', { kind: 'click' });
    setEquippingTactician(true);
    try {
      await setPreferredTacticianId(previewTactician.id);
      pushToast(`已装备小小领航员：${previewTactician.name}`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '装备领航员失败', 'error');
    } finally {
      setEquippingTactician(false);
    }
  };

  const handleEquipArena = async () => {
    if (equippingArena || arenaTheme === previewArena.id) return;
    audioBus.emit('onUiFeedback', { kind: 'click' });
    setEquippingArena(true);
    try {
      await setArenaThemeLive(previewArena.id);
      pushToast(`已设为默认舞台：${previewArena.name}`, 'success');
    } finally {
      setEquippingArena(false);
    }
  };

  const sidebarNav = (
    <nav aria-label="藏品与图鉴分类" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="sf-sidebar-group-label">藏品装备</div>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'tacticians' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('tacticians')}
        data-testid="enc-tab-tacticians"
      >
        <span>小小领航员</span>
        <span>({TACTICIAN_CATALOG.length})</span>
      </button>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'arenas' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('arenas')}
        data-testid="enc-tab-arenas"
      >
        <span>竞技场舞台</span>
        <span>({ARENA_THEME_OPTIONS.length})</span>
      </button>

      <div className="sf-sidebar-group-label" style={{ marginTop: 8 }}>
        赛季图鉴
      </div>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'units' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('units')}
        data-testid="enc-tab-units"
      >
        <span>棋子 ({SEASON1_UNITS.length})</span>
      </button>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'traits' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('traits')}
        data-testid="enc-tab-traits"
      >
        <span>羁绊 ({allTraits.length})</span>
      </button>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'items' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('items')}
        data-testid="enc-tab-items"
      >
        <span>装备 ({totalItemCount})</span>
      </button>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'augments' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('augments')}
        data-testid="enc-tab-augments"
      >
        <span>符文 ({SEASON1_AUGMENTS.length})</span>
      </button>
      <button
        type="button"
        className={`sf-rail-btn ${activeCategory === 'lore' ? 'sf-rail-btn--active' : ''}`.trim()}
        onClick={() => selectCategory('lore')}
        data-testid="enc-tab-lore"
      >
        <span>编年史</span>
      </button>
    </nav>
  );

  const searchActions = (
    <div className="sf-enc-search-wrap">
      <DescriptionModeToggle size="sm" />
      <input
        type="search"
        className="sf-enc-search-input"
        placeholder="搜索棋子、羁绊、装备、符文…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="encyclopedia-search-input"
      />
      {searchQuery ? (
        <button
          type="button"
          className="blc-btn blc-btn--ghost blc-btn--xs"
          onClick={() => setSearchQuery('')}
        >
          清空
        </button>
      ) : null}
    </div>
  );

  const hasDetailDrawer =
    activeCategory !== 'lore' &&
    activeCategory !== 'tacticians' &&
    activeCategory !== 'arenas' &&
    activeCategory !== 'items' &&
    Boolean(selectedUnitId || selectedTrait || selectedAugment);

  return (
    <SubpageShell
      title="藏品与图鉴"
      testId="encyclopedia-page"
      headerActions={searchActions}
      sidebar={sidebarNav}
    >
      {activeCategory === 'tacticians' ? (
        <div className="sf-collection-split" data-testid="tactician-collection-panel">
          <div className="sf-collection-list">
            {TACTICIAN_CATALOG.map((tac) => {
              const selected = previewTactician.id === tac.id;
              const equipped = preferredTacticianId === tac.id;
              return (
                <button
                  key={tac.id}
                  type="button"
                  className={`sf-collection-card ${selected ? 'sf-collection-card--selected' : ''}`.trim()}
                  onClick={() => {
                    if (previewTacticianId !== tac.id) {
                      audioBus.emit('onUiFeedback', { kind: 'click' });
                      setPreviewTacticianId(tac.id);
                    }
                  }}
                  data-testid={`tactician-card-${tac.id}`}
                >
                  <TacticianPortrait tacticianId={tac.id} size="md" alt={tac.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15 }}>{tac.name}</strong>
                      {equipped ? (
                        <span className="blc-chip blc-chip--gold" style={{ fontSize: 11 }}>
                          出战中
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {tac.factionLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="sf-showcase-pedestal" data-testid="tactician-showcase-stage">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="blc-chip">{previewTactician.factionLabel}</span>
              {preferredTacticianId === previewTactician.id ? (
                <span className="blc-chip blc-chip--gold">出战中</span>
              ) : null}
            </div>

            <div className="sf-showcase-stage-ring">
              <TacticianPortrait
                tacticianId={previewTactician.id}
                size="lg"
                alt={previewTactician.name}
              />
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: 22, color: 'var(--gold-light)' }}>
                {previewTactician.name}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {previewTactician.subtitle}
              </div>
              <p
                style={{
                  margin: '10px auto 0',
                  maxWidth: 440,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                {previewTactician.description}
              </p>
            </div>

            <button
              type="button"
              className="sf-gold-cta"
              disabled={equippingTactician || preferredTacticianId === previewTactician.id}
              onClick={() => void handleEquipTactician()}
              data-testid={`equip-tactician-${previewTactician.id}`}
            >
              {preferredTacticianId === previewTactician.id
                ? '当前出战中'
                : equippingTactician
                  ? '装备中…'
                  : '装备出战'}
            </button>
          </section>
        </div>
      ) : activeCategory === 'arenas' ? (
        <div className="sf-collection-split" data-testid="arena-collection-panel">
          <div className="sf-collection-list">
            {ARENA_THEME_OPTIONS.map((opt) => {
              const selected = previewArena.id === opt.id;
              const equipped = arenaTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`sf-collection-card ${selected ? 'sf-collection-card--selected' : ''}`.trim()}
                  onClick={() => {
                    if (previewArenaId !== opt.id) {
                      audioBus.emit('onUiFeedback', { kind: 'click' });
                      setPreviewArenaId(opt.id);
                    }
                  }}
                  data-testid={`arena-card-${opt.id}`}
                >
                  <img
                    className="sf-arena-thumb"
                    src={getArenaPreviewUrl(opt.id, { size: 256 })}
                    data-bake-tick={arenaBakeTick}
                    alt={opt.name}
                    draggable={false}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15 }}>{opt.name}</strong>
                      {equipped ? (
                        <span className="blc-chip blc-chip--gold" style={{ fontSize: 11 }}>
                          当前舞台
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="sf-showcase-pedestal" data-testid="arena-showcase-stage">
            <img
              className="sf-arena-hero-img"
              src={getArenaPreviewUrl(previewArena.id, { size: 512 })}
              data-bake-tick={arenaBakeTick}
              alt={previewArena.name}
              draggable={false}
            />

            <div>
              {arenaTheme === previewArena.id ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="blc-chip blc-chip--gold">默认舞台</span>
                </div>
              ) : null}
              <h2 style={{ margin: 0, fontSize: 22, color: 'var(--gold-light)' }}>
                {previewArena.name}
              </h2>
              <p
                style={{
                  margin: '10px auto 0',
                  maxWidth: 460,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                {ARENA_LORE_DESCRIPTIONS[previewArena.id]}
              </p>
            </div>

            <button
              type="button"
              className="sf-gold-cta"
              disabled={equippingArena || arenaTheme === previewArena.id}
              onClick={() => void handleEquipArena()}
              data-testid={`equip-arena-${previewArena.id}`}
            >
              {arenaTheme === previewArena.id
                ? '已设为默认舞台'
                : equippingArena
                  ? '切换中…'
                  : '设为默认舞台'}
            </button>
          </section>
        </div>
      ) : (
        <div className="sf-enc-workspace">
          <div className="sf-enc-main">
            {activeCategory === 'units' ? (
              <div className="sf-filter-pills" role="group" aria-label="费级筛选">
                {COST_FILTERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sf-filter-pill ${costFilter === c ? 'sf-filter-pill--active' : ''}`.trim()}
                    onClick={() => {
                      if (costFilter !== c) {
                        audioBus.emit('onUiFeedback', { kind: 'toggle' });
                        setCostFilter(c);
                      }
                    }}
                    data-testid={`enc-cost-filter-${c}`}
                  >
                    {c === 0 ? `全部 (${SEASON1_UNITS.length})` : `${c} 费`}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="blc-enc-scroll" data-testid="encyclopedia-scroll-list">
              {activeCategory === 'units' ? (
                <div className="sf-enc-unit-wall">
                  {filteredUnits.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`sf-enc-unit-tile ${
                        selectedUnitId === u.id ? 'sf-enc-unit-tile--selected' : ''
                      }`.trim()}
                      onClick={() => openUnit(u)}
                      data-testid={`enc-unit-${u.id}`}
                    >
                      <div className="sf-enc-unit-tile__row">
                        <UnitPortrait unitId={u.id} size="md" />
                        <div className="sf-enc-unit-tile__meta">
                          <div className="sf-enc-unit-tile__name">{u.name}</div>
                          <div className="sf-enc-unit-tile__cost">{u.cost} 费</div>
                          <div className="sf-enc-unit-tile__tags">
                            {u.faction} · {u.role}
                            {u.uniqueTrait ? ` · ${u.uniqueTrait}` : ''}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeCategory === 'traits' ? (
                <div className="blc-card-grid">
                  {filteredTraits.map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      className="ui-frosted-panel blc-enc-entry-card"
                      style={{ border: '1px solid rgba(240, 220, 170, 0.22)' }}
                      onClick={() => {
                        audioBus.emit('onUiFeedback', { kind: 'open' });
                        closeAllDrawers();
                        setSelectedTrait(tr);
                      }}
                      data-testid={`enc-trait-${tr.id}`}
                    >
                      <div className="blc-enc-entry-card__head">
                        <span className="trait-hex-badge trait-hex-badge--gold">
                          {tr.thresholds[0]}
                        </span>
                        <div>
                          <strong>{tr.name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--gold-light)' }}>
                            {tr.kindLabel} · {tr.thresholds.join(' / ')}
                          </div>
                        </div>
                      </div>
                      <p className="blc-enc-entry-card__desc">
                        <GameEffectText traitName={tr.name} fullText={tr.desc} />
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeCategory === 'items' ? (
                <EquipmentCodexMatrix
                  searchQuery={searchQuery}
                  onSelectUnit={(uid) => openUnit(uid)}
                />
              ) : null}

              {activeCategory === 'augments' ? (
                <div className="blc-card-grid">
                  {filteredAugments.map((aug) => (
                    <button
                      key={aug.id}
                      type="button"
                      className="ui-frosted-panel blc-enc-entry-card"
                      style={{ border: '1px solid rgba(240, 220, 170, 0.22)' }}
                      onClick={() => {
                        audioBus.emit('onUiFeedback', { kind: 'open' });
                        closeAllDrawers();
                        setSelectedAugment(aug);
                      }}
                      data-testid={`enc-augment-${aug.id}`}
                    >
                      <div className="blc-enc-entry-card__head">
                        <span
                          className={`trait-hex-badge trait-hex-badge--${
                            aug.tier === 'prismatic'
                              ? 'prismatic'
                              : aug.tier === 'gold'
                                ? 'gold'
                                : 'silver'
                          }`}
                        >
                          {aug.tier === 'prismatic' ? '棱' : aug.tier === 'gold' ? '金' : '银'}
                        </span>
                        <div>
                          <strong>{aug.name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--gold-light)' }}>
                            {formatAugmentTier(aug.tier)} · {aug.category}
                          </div>
                        </div>
                      </div>
                      <p className="blc-enc-entry-card__desc">
                        <GameEffectText augmentId={aug.id} fullText={aug.desc} />
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeCategory === 'lore' ? (
                <LoreArchiveReader
                  loreData={SEASON1_LORE}
                  searchQuery={searchQuery}
                  selectedUnitId={selectedUnitId}
                  onSelectUnitId={(uid) => {
                    audioBus.emit('onUiFeedback', { kind: uid ? 'open' : 'close' });
                    setSelectedUnitId(uid);
                  }}
                />
              ) : null}
            </div>
          </div>

          {hasDetailDrawer ? (
            <aside className="sf-enc-drawer-col" data-testid="encyclopedia-detail-drawer">
              {selectedUnitId ? (
                <UnitLoreDrawer
                  unitId={selectedUnitId}
                  loreData={SEASON1_LORE}
                  initialTab="overview"
                  audioBus={audioBus}
                  onClose={handleCloseDrawer}
                />
              ) : null}

              {selectedTrait ? (
                <div
                  className="ui-frosted-panel blc-drawer-dark"
                  style={{ border: '1px solid rgba(240, 220, 170, 0.26)' }}
                >
                  <div className="blc-col-head">
                    <div>
                      <span className="blc-chip blc-chip--gold">{selectedTrait.kindLabel}</span>
                      <h3 style={{ margin: '6px 0 0' }}>{selectedTrait.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DescriptionModeToggle size="xs" />
                      <button
                        type="button"
                        className="blc-btn blc-btn--ghost blc-btn--xs"
                        onClick={handleCloseDrawer}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p style={{ lineHeight: 1.65, color: 'var(--text-primary)' }}>
                    <GameEffectText traitName={selectedTrait.name} fullText={selectedTrait.desc} />
                  </p>
                  <div className="blc-chip" style={{ alignSelf: 'flex-start' }}>
                    档位 {selectedTrait.thresholds.join(' / ')}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="blc-field__label" style={{ marginBottom: 8 }}>
                      关联棋子
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SEASON1_UNITS.filter(
                        (u) =>
                          u.faction === selectedTrait.name ||
                          u.role === selectedTrait.name ||
                          u.uniqueTrait === selectedTrait.name,
                      ).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="blc-btn blc-btn--metal blc-btn--xs"
                          onClick={() => openUnit(u)}
                        >
                          {u.cost}费 · {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}



              {selectedAugment ? (
                <div
                  className="ui-frosted-panel blc-drawer-dark"
                  style={{ border: '1px solid rgba(240, 220, 170, 0.26)' }}
                >
                  <div className="blc-col-head">
                    <div>
                      <span className="blc-chip blc-chip--gold">
                        {formatAugmentTier(selectedAugment.tier)} · {selectedAugment.category}
                      </span>
                      <h3 style={{ margin: '6px 0 0' }}>{selectedAugment.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DescriptionModeToggle size="xs" />
                      <button
                        type="button"
                        className="blc-btn blc-btn--ghost blc-btn--xs"
                        onClick={handleCloseDrawer}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p style={{ lineHeight: 1.65 }}>
                    <GameEffectText augmentId={selectedAugment.id} fullText={selectedAugment.desc} />
                  </p>
                  {selectedAugment.tailorTraits.length > 0 ? (
                    <div className="blc-chip">
                      关联羁绊：{selectedAugment.tailorTraits.join(' / ')}
                    </div>
                  ) : (
                    <div className="blc-chip">通用符文</div>
                  )}
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      )}
    </SubpageShell>
  );
}
