import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEASON1_LORE,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
  type AudioEventBus,
  type UnitDef,
} from '@pkg/contracts';
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
    <div className={className} data-testid="recommended-items-tree">
      <div className="lui-recipe-head">推荐成装</div>
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
              <span style={{ color: '#9A783B', fontSize: 11 }}>◆</span>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 14 }}>{activeCompleted.name}</strong>
            {activeCompleted.formula ? (
              <span className="lui-subtle-pill">{activeCompleted.formula}</span>
            ) : null}
          </div>
          <div style={{ fontSize: 13, margin: '4px 0 8px', color: '#4A5362' }}>
            {activeCompleted.desc}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {(() => {
              const remaining = new Map(ownedCounts);
              return activeCompleted.components.map((compId, idx) => {
                const compEntry = lookupItemById(compId);
                const compLabel = compEntry ? compEntry.item.name : compId;
                const avail = remaining.get(compId) ?? 0;
                const isOwned = avail > 0;
                if (isOwned) remaining.set(compId, avail - 1);
                return (
                  <React.Fragment key={`${compId}-${idx}`}>
                    {idx > 0 ? <span style={{ fontWeight: 700, color: '#9A783B' }}>+</span> : null}
                    <span
                      className={`lui-recipe-comp ${isOwned ? 'lui-recipe-comp--owned' : ''}`.trim()}
                      data-owned={isOwned ? 'true' : 'false'}
                    >
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
  const displayFaction = unitLore?.faction ?? resolvedUnitDef?.faction ?? '未知派系';
  const displayRole = unitLore?.role ?? resolvedUnitDef?.role ?? '未知职能';

  return (
    <aside
      className="lui-paper-shell lui-paper-shell--compact"
      data-testid="unit-lore-drawer"
      aria-label={`${displayName} 图鉴详情`}
    >
      <header className="lui-header">
        <div className="lui-badge-group">
          <span className="lui-badge lui-badge--role">{displayCost} 费</span>
          <strong style={{ fontSize: 17 }}>{displayName}</strong>
          <span className="lui-badge">{displayFaction}</span>
          <span className="lui-badge">{displayRole}</span>
          {resolvedUnitDef?.uniqueTrait ? (
            <span className="lui-badge lui-badge--locked">{resolvedUnitDef.uniqueTrait}</span>
          ) : null}
          {highestStarUnlocked ? (
            <span className="lui-badge">{'★'.repeat(highestStarUnlocked)}</span>
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
                  <div style={{ fontSize: 13.5, color: '#4A5362', marginBottom: 10 }}>
                    {resolvedUnitDef.modelProfile.silhouetteDesc}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>技能</div>
                  <MarkdownKatexBlock content={resolvedUnitDef.skillSummary} />
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 12,
                      fontSize: 12.5,
                    }}
                  >
                    <span className="lui-badge">生命 {resolvedUnitDef.stats.hp}</span>
                    <span className="lui-badge">攻击 {resolvedUnitDef.stats.atk}</span>
                    <span className="lui-badge">护甲 {resolvedUnitDef.stats.armor}</span>
                    <span className="lui-badge">魔抗 {resolvedUnitDef.stats.mr}</span>
                    <span className="lui-badge">攻速 {resolvedUnitDef.stats.atkSpeed}</span>
                    <span className="lui-badge">射程 {resolvedUnitDef.stats.range}</span>
                    <span className="lui-badge">
                      法力 {resolvedUnitDef.stats.initialMana}/{resolvedUnitDef.stats.maxMana}
                    </span>
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
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#5C441B' }}>
                  {factionEntry.faction}
                </div>
                <div className="lui-faction-motto">“{factionEntry.motto}”</div>
              </div>
            ) : null}

            <div className="lui-stem-card">
              <h3 style={{ margin: '0 0 10px', fontSize: 16.5 }}>{displayName}</h3>
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
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#8C6B2F',
                    marginBottom: 3,
                    letterSpacing: '0.03em',
                  }}
                >
                  {VOICE_TRIGGER_LABELS[line.trigger] ?? line.trigger}
                </div>
                <div style={{ fontSize: 15, color: '#1C2129' }}>{line.text}</div>
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
      <header className="lui-header">
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1C2129', letterSpacing: '0.04em' }}>
            {cleanBookTitle(loreData.title)}
          </div>
          <div style={{ fontSize: 12.5, color: '#6B5226', marginTop: 1 }}>
            {loreData.subtitle}
          </div>
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
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{era.title}</span>
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
                  <h2 style={{ margin: '0 0 14px', fontSize: 19, color: '#151921', letterSpacing: '0.02em' }}>
                    {currentEra.title}
                  </h2>
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
                    <strong style={{ fontSize: 16, letterSpacing: '0.02em' }}>
                      {fac.faction}
                    </strong>
                    <div className="lui-faction-motto">“{fac.motto}”</div>
                    <p style={{ margin: '2px 0 4px', fontSize: 13.5, color: '#4A5362' }}>
                      {fac.summary}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
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
