import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEASON1_LORE,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
  type AudioEventBus,
  type UnitDef,
} from '@pkg/contracts';
import { GameItemIcon, RichGameText } from './GameRichIcons.js';
import { MarkdownKatexBlock } from './MarkdownKatexBlock.js';
import { ensureLearningUiStyles } from './learningUiStyles.js';

export type Season1LoreData = typeof SEASON1_LORE;
export type Season1UnitLoreEntry = Season1LoreData['units'][number];

const VOICE_TRIGGER_LABELS: Readonly<Record<string, string>> = {
  summon: '召唤入列',
  deploy: '披挂上阵',
  skill: '终极施法',
  defeat: '折戟阵亡',
  victory: '凯旋胜利',
  extra_5: '三星升阶',
};

function cleanBookTitle(rawTitle: string): string {
  const stripped = rawTitle.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
  return stripped || rawTitle;
}

function clampCostTier(cost: number): 1 | 2 | 3 | 4 | 5 {
  if (cost <= 1) return 1;
  if (cost === 2) return 2;
  if (cost === 3) return 3;
  if (cost === 4) return 4;
  return 5;
}

function DrawerCornerSvg({ pos }: { readonly pos: 'tl' | 'tr' | 'bl' | 'br' }): React.JSX.Element {
  return (
    <svg
      className={`lui-corner-ornament lui-corner-ornament--${pos}`}
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M1.2 12.8V4.2L4.2 1.2H12.8"
        fill="none"
        stroke="#f2c97d"
        strokeWidth="1.25"
      />
      <polygon points="1.2,1.2 4.6,1.2 1.2,4.6" fill="#f2c97d" />
      <circle cx="5.4" cy="5.4" r="1.05" fill="#4fd1ff" />
    </svg>
  );
}

export interface RecommendedItemsTreeProps {
  readonly recommendedItemIds: readonly string[];
  readonly ownedComponentIds?: readonly string[];
  readonly className?: string;
}

export function RecommendedItemsTree({
  recommendedItemIds,
  ownedComponentIds = [],
  className = '',
}: RecommendedItemsTreeProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const [expandedItemId, setExpandedItemId] = useState<string | null>(
    recommendedItemIds[0] ?? null,
  );
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setExpandedItemId(recommendedItemIds[0] ?? null);
  }, [recommendedItemIds]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handlePointerEnter = (itemId: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setExpandedItemId(itemId);
    }, 120);
  };

  const handlePointerLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const activeCompleted = useMemo(() => {
    if (!expandedItemId) return null;
    const found = lookupItemById(expandedItemId);
    if (!found || found.kind !== 'completed') return null;
    return found.item;
  }, [expandedItemId]);

  const ownedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const cid of ownedComponentIds) {
      map.set(cid, (map.get(cid) ?? 0) + 1);
    }
    return map;
  }, [ownedComponentIds]);

  return (
    <div
      className={`lui-recipe-tree ${className}`.trim()}
      data-testid="recommended-items-tree"
    >
      <div className="lui-recipe-head">
        <span className="lui-briefing-diamond" aria-hidden="true" />
        <span>推荐成装</span>
      </div>
      <div className="lui-recipe-row">
        {recommendedItemIds.map((itemId) => {
          const entry = lookupItemById(itemId);
          const itemName = entry ? entry.item.name : itemId;
          const isSelected = expandedItemId === itemId;
          return (
            <button
              key={itemId}
              type="button"
              className={`lui-recipe-chip ${isSelected ? 'lui-recipe-chip--active' : ''}`.trim()}
              onPointerEnter={() => handlePointerEnter(itemId)}
              onPointerLeave={handlePointerLeave}
              onClick={() => setExpandedItemId(itemId)}
              data-testid={`rec-item-${itemId}`}
            >
              <GameItemIcon itemId={itemId} size="xs" />
              <span>{itemName}</span>
            </button>
          );
        })}
      </div>

      {activeCompleted ? (
        <div
          key={activeCompleted.id}
          className="lui-recipe-formula-card"
          data-testid="active-recipe-formula"
        >
          <div className="lui-recipe-formula-top">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <GameItemIcon itemId={activeCompleted.id} size="sm" />
              <strong className="lui-recipe-formula-name">{activeCompleted.name}</strong>
            </span>
            {activeCompleted.formula ? (
              <span className="lui-subtle-pill">{activeCompleted.formula}</span>
            ) : null}
          </div>
          <div className="lui-recipe-formula-desc">
            <RichGameText text={activeCompleted.desc} />
          </div>
          <div className="lui-recipe-chain">
            {(() => {
              const remaining = new Map(ownedCounts);
              return activeCompleted.components.map((compId, idx) => {
                const compEntry = lookupItemById(compId);
                const compLabel = compEntry ? compEntry.item.name : compId;
                const compTitle =
                  compEntry && 'desc' in compEntry.item ? compEntry.item.desc : undefined;
                const avail = remaining.get(compId) ?? 0;
                const isOwned = avail > 0;
                if (isOwned) remaining.set(compId, avail - 1);
                return (
                  <React.Fragment key={`${compId}-${idx}`}>
                    {idx > 0 ? <span className="lui-recipe-plus">+</span> : null}
                    <span
                      className={`lui-recipe-comp ${isOwned ? 'lui-recipe-comp--owned' : ''}`.trim()}
                      data-owned={isOwned ? 'true' : 'false'}
                      title={compTitle}
                    >
                      <GameItemIcon itemId={compId} size="xs" className="lui-recipe-glyph" />
                      <span>{compLabel}</span>
                      {isOwned ? <span className="lui-owned-tag">背包已有</span> : null}
                    </span>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type UnitDrawerTab = 'overview' | 'lore' | 'voices';

export interface UnitLoreDrawerProps {
  readonly unitId: string;
  readonly loreData?: Season1LoreData;
  readonly unitDef?: UnitDef | null;
  readonly initialTab?: UnitDrawerTab;
  readonly modelPreviewSlot?: React.ReactNode;
  readonly ownedComponentIds?: readonly string[];
  readonly highestStarUnlocked?: 1 | 2 | 3 | null;
  readonly audioBus?: AudioEventBus | null;
  readonly onClose?: () => void;
}

export function UnitLoreDrawer({
  unitId,
  loreData = SEASON1_LORE,
  unitDef,
  initialTab = 'lore',
  modelPreviewSlot,
  ownedComponentIds = [],
  highestStarUnlocked = null,
  onClose,
}: UnitLoreDrawerProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const [activeTab, setActiveTab] = useState<UnitDrawerTab>(initialTab);

  const resolvedUnitDef = useMemo(
    () => unitDef ?? SEASON1_UNITS_BY_ID.get(unitId) ?? null,
    [unitDef, unitId],
  );

  const unitLore = useMemo(
    () => loreData.units.find((u) => u.unitId === unitId) ?? null,
    [loreData, unitId],
  );

  const factionEntry = useMemo(() => {
    const fName = unitLore?.faction ?? resolvedUnitDef?.faction;
    if (!fName) return null;
    return loreData.factions.find((f) => f.faction === fName) ?? null;
  }, [loreData, unitLore, resolvedUnitDef]);

  const displayName = unitLore?.name ?? resolvedUnitDef?.name ?? unitId;
  const displayCost = unitLore?.cost ?? resolvedUnitDef?.cost ?? 1;
  const costTier = clampCostTier(displayCost);
  const displayFaction = unitLore?.faction ?? resolvedUnitDef?.faction ?? '未知派系';
  const displayRole = unitLore?.role ?? resolvedUnitDef?.role ?? '未知职能';

  return (
    <aside
      className="lui-paper-shell lui-paper-shell--compact"
      data-testid="unit-lore-drawer"
      data-cost-tier={costTier}
      aria-label={`${displayName} 图鉴详情`}
    >
      <DrawerCornerSvg pos="tl" />
      <DrawerCornerSvg pos="tr" />
      <DrawerCornerSvg pos="bl" />
      <DrawerCornerSvg pos="br" />

      <header className="lui-header">
        <div className="lui-badge-group">
          <span className={`lui-cost-badge lui-cost-badge--${costTier}`}>{displayCost} 费</span>
          <strong className="lui-unit-name">{displayName}</strong>
          <span className="lui-badge">{displayFaction}</span>
          <span className="lui-badge">{displayRole}</span>
          {resolvedUnitDef?.uniqueTrait ? (
            <span className="lui-badge lui-badge--locked">{resolvedUnitDef.uniqueTrait}</span>
          ) : null}
          {highestStarUnlocked ? (
            <span className="lui-badge lui-badge--stars">{'★'.repeat(highestStarUnlocked)}</span>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            className="lui-ref-btn"
            onClick={onClose}
            data-testid="close-unit-drawer-btn"
          >
            关闭
          </button>
        ) : null}
      </header>

      <div className="lui-body">
        <nav className="lui-tabs" aria-label="棋子档案">
          <button
            type="button"
            className={`lui-btn ${activeTab === 'overview' ? 'lui-btn--primary' : 'lui-btn--ghost'}`}
            onClick={() => setActiveTab('overview')}
            data-testid="unit-tab-overview"
          >
            技能与属性
          </button>
          <button
            type="button"
            className={`lui-btn ${activeTab === 'lore' ? 'lui-btn--primary' : 'lui-btn--ghost'}`}
            onClick={() => setActiveTab('lore')}
            data-testid="unit-tab-lore"
          >
            列传
          </button>
          <button
            type="button"
            className={`lui-btn ${activeTab === 'voices' ? 'lui-btn--primary' : 'lui-btn--ghost'}`}
            onClick={() => setActiveTab('voices')}
            data-testid="unit-tab-voices"
          >
            台词
          </button>
        </nav>

        {activeTab === 'overview' ? (
          <div key="overview" className="lui-stage-anim">
            {modelPreviewSlot ? <div>{modelPreviewSlot}</div> : null}
            {resolvedUnitDef ? (
              <>
                <div className="lui-stem-card">
                  <div className="lui-unit-silhouette">
                    {resolvedUnitDef.modelProfile.silhouetteDesc}
                  </div>
                  <div className="lui-unit-skill-label">
                    <span className="lui-briefing-diamond" aria-hidden="true" />
                    <span>技能</span>
                  </div>
                  <div className="lui-unit-skill-desc">
                    <RichGameText text={resolvedUnitDef.skillSummary} />
                  </div>
                  <hr className="lui-metal-divider" style={{ marginTop: 12 }} />
                  <div className="lui-stat-grid">
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">生命</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.hp}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">攻击</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.atk}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">护甲</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.armor}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">魔抗</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.mr}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">攻速</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.atkSpeed}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">射程</span>
                      <span className="lui-stat-value">{resolvedUnitDef.stats.range}</span>
                    </div>
                    <div className="lui-stat-cell">
                      <span className="lui-stat-label">法力</span>
                      <span className="lui-stat-value">
                        {resolvedUnitDef.stats.initialMana}/{resolvedUnitDef.stats.maxMana}
                      </span>
                    </div>
                  </div>
                </div>

                <RecommendedItemsTree
                  recommendedItemIds={resolvedUnitDef.recommendedItems}
                  ownedComponentIds={ownedComponentIds}
                />
              </>
            ) : (
              <p>未找到该棋子定义。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'lore' ? (
          <article key="lore" className="lui-stage-anim" data-testid="unit-story-panel">
            {factionEntry ? (
              <div className="lui-faction-card">
                <div className="lui-unit-skill-label" style={{ marginBottom: 0 }}>
                  {factionEntry.faction}
                </div>
                <div className="lui-faction-motto">“{factionEntry.motto}”</div>
              </div>
            ) : null}

            <div className="lui-stem-card">
              <h3 className="lui-briefing-title" style={{ marginBottom: 10 }}>
                <span className="lui-briefing-diamond" aria-hidden="true" />
                <span>{displayName}</span>
              </h3>
              <MarkdownKatexBlock content={unitLore?.story ?? '暂无列传记录。'} />
            </div>

            {unitLore && unitLore.milestoneNotes.length > 0 ? (
              <div className="lui-hint-box">
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>星级手记</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {unitLore.milestoneNotes.map((note, idx) => (
                    <li key={idx}>{String(note)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ) : null}

        {activeTab === 'voices' ? (
          <div key="voices" className="lui-voice-list lui-stage-anim" data-testid="unit-voices-panel">
            {(unitLore?.voiceLines ?? []).map((line, idx) => (
              <div
                key={`${line.trigger}-${idx}`}
                className="lui-voice-card"
                data-trigger={line.trigger}
              >
                <div className="lui-voice-trigger">
                  {VOICE_TRIGGER_LABELS[line.trigger] ?? line.trigger}
                </div>
                <div className="lui-voice-text">{line.text}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export interface LoreArchiveReaderProps {
  readonly loreData?: Season1LoreData;
  readonly searchQuery?: string;
  readonly selectedUnitId?: string | null;
  readonly onSelectUnitId?: (unitId: string | null) => void;
  readonly ownedComponentIds?: readonly string[];
}

export function LoreArchiveReader({
  loreData = SEASON1_LORE,
  searchQuery = '',
  selectedUnitId = null,
  onSelectUnitId,
  ownedComponentIds = [],
}: LoreArchiveReaderProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEras = useMemo(() => {
    const sorted = [...loreData.eras].sort((a, b) => a.order - b.order);
    if (!normalizedQuery) return sorted;
    return sorted.filter(
      (e) =>
        e.title.toLowerCase().includes(normalizedQuery) ||
        e.scaleLabel.toLowerCase().includes(normalizedQuery) ||
        e.body.toLowerCase().includes(normalizedQuery),
    );
  }, [loreData.eras, normalizedQuery]);

  const filteredFactions = useMemo(() => {
    if (!normalizedQuery) return loreData.factions;
    return loreData.factions.filter(
      (f) =>
        f.faction.toLowerCase().includes(normalizedQuery) ||
        f.motto.toLowerCase().includes(normalizedQuery) ||
        f.summary.toLowerCase().includes(normalizedQuery),
    );
  }, [loreData.factions, normalizedQuery]);

  const [activeEraId, setActiveEraId] = useState<string>(
    loreData.eras[0]?.id ?? 'ERA_0_ASH_SNOW',
  );
  const [viewSection, setViewSection] = useState<'chronicle' | 'factions'>('chronicle');
  const [internalUnitId, setInternalUnitId] = useState<string | null>(selectedUnitId);

  const effectiveSelectedUnitId =
    selectedUnitId !== undefined && onSelectUnitId ? selectedUnitId : internalUnitId;

  const handleChooseUnit = (uid: string | null) => {
    if (onSelectUnitId) onSelectUnitId(uid);
    else setInternalUnitId(uid);
  };

  const currentEra = useMemo(
    () =>
      filteredEras.find((e) => e.id === activeEraId) ??
      filteredEras[0] ??
      loreData.eras[0] ??
      null,
    [filteredEras, activeEraId, loreData.eras],
  );

  return (
    <section
      className="lui-paper-shell lui-paper-shell--standalone"
      data-testid="lore-archive-reader"
    >
      <DrawerCornerSvg pos="tl" />
      <DrawerCornerSvg pos="tr" />
      <DrawerCornerSvg pos="bl" />
      <DrawerCornerSvg pos="br" />

      <header className="lui-header">
        <div>
          <div className="lui-lore-title">{cleanBookTitle(loreData.title)}</div>
          <div className="lui-lore-subtitle">{loreData.subtitle}</div>
        </div>

        <div className="lui-btn-row">
          <button
            type="button"
            className={`lui-btn ${viewSection === 'chronicle' ? 'lui-btn--primary' : 'lui-btn--ghost'}`}
            onClick={() => setViewSection('chronicle')}
            data-testid="lore-section-chronicle"
          >
            纪元编年
          </button>
          <button
            type="button"
            className={`lui-btn ${viewSection === 'factions' ? 'lui-btn--primary' : 'lui-btn--ghost'}`}
            onClick={() => setViewSection('factions')}
            data-testid="lore-section-factions"
          >
            派系志
          </button>
        </div>
      </header>

      <div className="lui-body">
        {viewSection === 'chronicle' ? (
          <div className="lui-lore-layout">
            <nav className="lui-era-nav" aria-label="纪元时间轴">
              {filteredEras.map((era) => {
                const isActive = currentEra?.id === era.id;
                return (
                  <button
                    key={era.id}
                    type="button"
                    className={`lui-era-btn ${isActive ? 'lui-era-btn--active' : ''}`.trim()}
                    onClick={() => setActiveEraId(era.id)}
                    data-testid={`era-nav-${era.id}`}
                  >
                    <span className="lui-era-scale">{era.scaleLabel}</span>
                    <span className="lui-era-name">{era.title}</span>
                  </button>
                );
              })}
            </nav>

            <article
              key={currentEra?.id ?? 'empty'}
              className="lui-stem-card lui-stage-anim"
              data-testid="active-era-article"
            >
              {currentEra ? (
                <>
                  <div className="lui-badge lui-badge--role" style={{ marginBottom: 10 }}>
                    {currentEra.scaleLabel}
                  </div>
                  <h2 className="lui-era-heading">{currentEra.title}</h2>
                  <hr className="lui-metal-divider" style={{ marginBottom: 12 }} />
                  <MarkdownKatexBlock content={currentEra.body} />
                </>
              ) : (
                <p>未找到匹配的纪元记录。</p>
              )}
            </article>
          </div>
        ) : (
          <div key="factions" className="lui-stage-anim">
            <div className="lui-factions-grid" data-testid="factions-motto-grid">
              {filteredFactions.map((fac) => {
                const factionUnits = loreData.units.filter((u) => u.faction === fac.faction);
                return (
                  <div key={fac.faction} className="lui-faction-card">
                    <strong className="lui-faction-title">{fac.faction}</strong>
                    <div className="lui-faction-motto">“{fac.motto}”</div>
                    <p className="lui-faction-summary">{fac.summary}</p>
                    <div className="lui-faction-units">
                      {factionUnits.map((u) => (
                        <button
                          key={u.unitId}
                          type="button"
                          className="lui-ref-btn"
                          onClick={() => handleChooseUnit(u.unitId)}
                          data-testid={`open-unit-lore-${u.unitId}`}
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {effectiveSelectedUnitId ? (
          <UnitLoreDrawer
            unitId={effectiveSelectedUnitId}
            loreData={loreData}
            ownedComponentIds={ownedComponentIds}
            onClose={() => handleChooseUnit(null)}
          />
        ) : null}
      </div>
    </section>
  );
}
