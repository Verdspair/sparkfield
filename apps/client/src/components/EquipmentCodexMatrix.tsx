import React, { useEffect, useMemo, useState } from 'react';
import {
  SEASON1_ITEMS,
  SEASON1_UNITS,
  lookupCraftRecipe,
  type UnitDef,
} from '@pkg/contracts';
import { GameItemIcon, RichGameText } from '@pkg/learning-ui';
import { UnitPortrait } from './UnitPortrait.js';
import './equipmentCodex.css';

export interface EquipmentCodexMatrixProps {
  readonly compact?: boolean;
  readonly searchQuery?: string;
  readonly ownedComponentIds?: readonly string[];
  readonly initialItemId?: string | null;
  readonly onSelectUnit?: (unitId: string) => void;
}

type CodexViewMode = 'matrix' | 'grid';
type GridCategoryFilter = 'all' | 'component' | 'completed' | 'emblem' | 'tool';

interface CodexItemRecord {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly kind: 'component' | 'completed' | 'emblem' | 'flag' | 'tool';
  readonly categoryLabel: string;
  readonly desc: string;
  readonly formula?: string;
  readonly components?: readonly string[];
}

interface MatrixFocus {
  readonly itemId: string;
  readonly rowComp?: string;
  readonly colComp?: string;
}

const BASE_COMPONENT_ORDER: readonly string[] = [
  'C_SWORD',
  'C_BOW',
  'C_ROD',
  'C_TEAR',
  'C_VEST',
  'C_CLOAK',
  'C_BELT',
  'C_GLOVE',
  'C_RUBBING',
];

const BASE_COMPONENT_SET = new Set<string>(BASE_COMPONENT_ORDER);

const COMPONENT_MICRO_STAT: Readonly<Record<string, string>> = {
  C_SWORD: '攻击',
  C_BOW: '攻速',
  C_ROD: '法强',
  C_TEAR: '法力',
  C_VEST: '护甲',
  C_CLOAK: '魔抗',
  C_BELT: '生命',
  C_GLOVE: '暴击',
  C_RUBBING: '拓片',
};

const COMPONENT_SHORT_LABEL: Readonly<Record<string, string>> = {
  C_SWORD: '钨芯刃',
  C_BOW: '加速轨',
  C_ROD: '谐振腔',
  C_TEAR: '聚变芯',
  C_VEST: '镀层甲',
  C_CLOAK: '偏折膜',
  C_BELT: '维生舱',
  C_GLOVE: '干涉仪',
  C_RUBBING: '星环拓片',
};

const ALL_CODEX_ITEMS: readonly CodexItemRecord[] = [
  ...SEASON1_ITEMS.components.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: COMPONENT_SHORT_LABEL[c.id] ?? c.name,
    kind: 'component' as const,
    categoryLabel: '基础散件',
    desc: c.desc,
  })),
  {
    id: SEASON1_ITEMS.special.spatulaComponent.id,
    name: SEASON1_ITEMS.special.spatulaComponent.name,
    shortName: COMPONENT_SHORT_LABEL[SEASON1_ITEMS.special.spatulaComponent.id] ?? '星环拓片',
    kind: 'component' as const,
    categoryLabel: '特殊散件',
    desc: SEASON1_ITEMS.special.spatulaComponent.desc,
  },
  ...SEASON1_ITEMS.completedItems.map((it) => ({
    id: it.id,
    name: it.name,
    shortName: it.name,
    kind: 'completed' as const,
    categoryLabel: '成装',
    desc: it.desc,
    formula: it.formula,
    components: [...it.components],
  })),
  ...SEASON1_ITEMS.emblems.map((em) => ({
    id: em.id,
    name: em.name,
    shortName: em.name,
    kind: 'emblem' as const,
    categoryLabel: `派系纹章 · ${em.faction}`,
    desc: em.desc,
    components: [...em.components],
  })),
  {
    id: SEASON1_ITEMS.special.mothershipFlag.id,
    name: SEASON1_ITEMS.special.mothershipFlag.name,
    shortName: SEASON1_ITEMS.special.mothershipFlag.name,
    kind: 'flag' as const,
    categoryLabel: '特殊道具',
    desc: SEASON1_ITEMS.special.mothershipFlag.desc,
    components: [...SEASON1_ITEMS.special.mothershipFlag.components],
  },
  ...SEASON1_ITEMS.special.consumables.map((tl) => ({
    id: tl.id,
    name: tl.name,
    shortName: tl.name,
    kind: 'tool' as const,
    categoryLabel: '消耗工具',
    desc: tl.desc,
  })),
];

const ITEM_BY_ID: ReadonlyMap<string, CodexItemRecord> = new Map(
  ALL_CODEX_ITEMS.map((item) => [item.id, item]),
);

const TOOL_ITEMS: readonly CodexItemRecord[] = ALL_CODEX_ITEMS.filter((it) => it.kind === 'tool');

const GRID_CATEGORY_FILTERS: ReadonlyArray<{
  readonly id: GridCategoryFilter;
  readonly label: string;
}> = [
  { id: 'all', label: '全部' },
  { id: 'component', label: '散件' },
  { id: 'completed', label: '成装' },
  { id: 'emblem', label: '纹章' },
  { id: 'tool', label: '工具' },
];

function normalizeComponentId(itemId: string): string {
  return itemId === 'C_SPATULA' ? 'C_RUBBING' : itemId;
}

function itemMatchesQuery(item: CodexItemRecord, query: string): boolean {
  if (!query) return true;
  if (
    item.name.toLowerCase().includes(query) ||
    item.desc.toLowerCase().includes(query) ||
    item.categoryLabel.toLowerCase().includes(query) ||
    (item.formula && item.formula.toLowerCase().includes(query))
  ) {
    return true;
  }
  if (item.components) {
    for (const cid of item.components) {
      const comp = ITEM_BY_ID.get(cid);
      if (
        comp &&
        (comp.name.toLowerCase().includes(query) ||
          comp.shortName.toLowerCase().includes(query) ||
          (COMPONENT_MICRO_STAT[cid]?.toLowerCase().includes(query) ?? false))
      ) {
        return true;
      }
    }
  }
  const micro = COMPONENT_MICRO_STAT[item.id];
  return Boolean(micro && micro.toLowerCase().includes(query));
}

function getRecommendedUnitsForItem(item: CodexItemRecord): readonly UnitDef[] {
  if (item.kind === 'component') {
    const craftedIds = new Set<string>();
    for (const partner of BASE_COMPONENT_ORDER) {
      const res = lookupCraftRecipe(item.id, partner);
      if (res) craftedIds.add(res.id);
    }
    return SEASON1_UNITS.filter((u) =>
      u.recommendedItems.some((rid) => craftedIds.has(rid)),
    ).slice(0, 6);
  }
  return SEASON1_UNITS.filter((u) => u.recommendedItems.includes(item.id)).slice(0, 6);
}

export function EquipmentCodexMatrix({
  compact = false,
  searchQuery = '',
  ownedComponentIds,
  initialItemId = null,
  onSelectUnit,
}: EquipmentCodexMatrixProps): React.JSX.Element {
  const ownedCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!ownedComponentIds) return map;
    for (const rawId of ownedComponentIds) {
      const nid = normalizeComponentId(rawId);
      if (BASE_COMPONENT_SET.has(nid)) {
        map.set(nid, (map.get(nid) ?? 0) + 1);
      }
    }
    return map;
  }, [ownedComponentIds]);

  const ownedBagComponents = useMemo(() => {
    if (!ownedComponentIds) return [];
    const list: string[] = [];
    for (const rawId of ownedComponentIds) {
      const nid = normalizeComponentId(rawId);
      if (BASE_COMPONENT_SET.has(nid)) list.push(nid);
    }
    return list;
  }, [ownedComponentIds]);

  const canCraftPair = (c1: string, c2: string): boolean => {
    if (c1 === c2) {
      return (ownedCounts.get(c1) ?? 0) >= 2;
    }
    return (ownedCounts.get(c1) ?? 0) >= 1 && (ownedCounts.get(c2) ?? 0) >= 1;
  };

  const defaultSelectedId = useMemo(() => {
    if (initialItemId && ITEM_BY_ID.has(initialItemId)) {
      return initialItemId;
    }
    for (const r of BASE_COMPONENT_ORDER) {
      for (const c of BASE_COMPONENT_ORDER) {
        if (canCraftPair(r, c)) {
          const crafted = lookupCraftRecipe(r, c);
          if (crafted) return crafted.id;
        }
      }
    }
    return SEASON1_ITEMS.completedItems[0]?.id ?? 'C_SWORD';
  }, [initialItemId, ownedCounts]);

  const [viewMode, setViewMode] = useState<CodexViewMode>('matrix');
  const [gridFilter, setGridFilter] = useState<GridCategoryFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultSelectedId);
  const [pinnedFocus, setPinnedFocus] = useState<MatrixFocus | null>(null);
  const [hoveredFocus, setHoveredFocus] = useState<MatrixFocus | null>(null);

  useEffect(() => {
    if (initialItemId && ITEM_BY_ID.has(initialItemId)) {
      setSelectedItemId(initialItemId);
      const entry = ITEM_BY_ID.get(initialItemId);
      if (entry?.components && entry.components.length === 2) {
        setPinnedFocus({
          itemId: entry.id,
          rowComp: entry.components[0],
          colComp: entry.components[1],
        });
      } else if (entry?.kind === 'component') {
        setPinnedFocus({ itemId: entry.id, rowComp: entry.id });
      } else {
        setPinnedFocus(null);
      }
    }
  }, [initialItemId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!normalizedQuery) return;
    const firstMatch = ALL_CODEX_ITEMS.find((it) => itemMatchesQuery(it, normalizedQuery));
    if (!firstMatch) return;
    setSelectedItemId(firstMatch.id);
    if (firstMatch.components && firstMatch.components.length === 2) {
      setPinnedFocus({
        itemId: firstMatch.id,
        rowComp: firstMatch.components[0],
        colComp: firstMatch.components[1],
      });
    } else if (firstMatch.kind === 'component') {
      setPinnedFocus({ itemId: firstMatch.id, rowComp: firstMatch.id });
    } else {
      setPinnedFocus(null);
    }
  }, [normalizedQuery]);

  const activeFocus: MatrixFocus = useMemo(() => {
    if (hoveredFocus) return hoveredFocus;
    if (pinnedFocus && pinnedFocus.itemId === selectedItemId) return pinnedFocus;
    const selected = ITEM_BY_ID.get(selectedItemId);
    if (selected?.components && selected.components.length === 2) {
      return {
        itemId: selected.id,
        rowComp: selected.components[0],
        colComp: selected.components[1],
      };
    }
    if (selected?.kind === 'component') {
      return { itemId: selected.id, rowComp: selected.id };
    }
    return { itemId: selectedItemId };
  }, [hoveredFocus, pinnedFocus, selectedItemId]);

  const activeItem = ITEM_BY_ID.get(activeFocus.itemId) ?? ALL_CODEX_ITEMS[0]!;
  const recommendedUnits = useMemo(() => getRecommendedUnitsForItem(activeItem), [activeItem]);

  const filteredGridItems = useMemo(() => {
    return ALL_CODEX_ITEMS.filter((it) => {
      if (gridFilter === 'component' && it.kind !== 'component') return false;
      if (gridFilter === 'completed' && it.kind !== 'completed') return false;
      if (gridFilter === 'emblem' && it.kind !== 'emblem' && it.kind !== 'flag') return false;
      if (gridFilter === 'tool' && it.kind !== 'tool') return false;
      return itemMatchesQuery(it, normalizedQuery);
    });
  }, [gridFilter, normalizedQuery]);

  const selectItem = (itemId: string, rowComp?: string, colComp?: string) => {
    setSelectedItemId(itemId);
    setPinnedFocus(rowComp || colComp ? { itemId, rowComp, colComp } : { itemId });
  };

  const iconSize = compact ? 'sm' : 'md';
  const hasBagProp = Boolean(ownedComponentIds && ownedComponentIds.length > 0);

  return (
    <div
      className={`sf-equip-codex ${compact ? 'sf-equip-codex--compact' : ''}`.trim()}
      data-testid="equipment-codex-matrix"
    >
      <div className="sf-equip-toolbar">
        <div className="sf-equip-toolbar__left">
          <div className="sf-equip-view-switch" role="tablist" aria-label="装备图鉴视图">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'matrix'}
              className={`sf-equip-view-btn ${viewMode === 'matrix' ? 'sf-equip-view-btn--active' : ''}`.trim()}
              onClick={() => setViewMode('matrix')}
              data-testid="equip-view-matrix"
            >
              合成矩阵
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              className={`sf-equip-view-btn ${viewMode === 'grid' ? 'sf-equip-view-btn--active' : ''}`.trim()}
              onClick={() => setViewMode('grid')}
              data-testid="equip-view-grid"
            >
              图标墙
            </button>
          </div>

          {viewMode === 'grid' ? (
            <div className="sf-equip-filter-pills" role="group" aria-label="装备分类">
              {GRID_CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`sf-equip-filter-pill ${
                    gridFilter === cat.id ? 'sf-equip-filter-pill--active' : ''
                  }`.trim()}
                  onClick={() => setGridFilter(cat.id)}
                  data-testid={`equip-grid-filter-${cat.id}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {hasBagProp ? (
          <div className="sf-equip-bag-bar" data-testid="equip-owned-bag-bar">
            <span className="sf-equip-bag-bar__label">当前背包散件</span>
            <div className="sf-equip-bag-bar__items">
              {ownedBagComponents.length > 0 ? (
                ownedBagComponents.map((cid, idx) => {
                  const comp = ITEM_BY_ID.get(cid);
                  return (
                    <button
                      key={`${cid}-${idx}`}
                      type="button"
                      className="sf-equip-bag-chip"
                      title={comp?.name ?? cid}
                      onClick={() => selectItem(cid, cid)}
                    >
                      <GameItemIcon itemId={cid} size="xs" />
                    </button>
                  );
                })
              ) : (
                <span className="sf-equip-bag-bar__hint">暂无散件</span>
              )}
            </div>
            <span className="sf-equip-bag-bar__hint">金色边框可直接合成</span>
          </div>
        ) : null}
      </div>

      <div className={`sf-equip-body ${viewMode === 'matrix' ? 'sf-equip-body--matrix' : ''}`.trim()}>
        <div className="sf-equip-left-pane">
          {viewMode === 'matrix' ? (
            <div
              className="sf-equip-matrix-frame"
              onMouseLeave={() => setHoveredFocus(null)}
            >
              <div className="sf-equip-matrix-grid" role="grid" aria-label="9×9 装备合成矩阵">
                <div className="sf-equip-corner" title="星环合成图鉴">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 2" />
                    <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>

                {BASE_COMPONENT_ORDER.map((colComp) => {
                  const item = ITEM_BY_ID.get(colComp)!;
                  const owned = (ownedCounts.get(colComp) ?? 0) >= 1;
                  const isActiveCol = activeFocus.colComp === colComp;
                  const dimmed = Boolean(normalizedQuery) && !itemMatchesQuery(item, normalizedQuery);
                  return (
                    <button
                      key={`col-${colComp}`}
                      type="button"
                      className={`sf-equip-header-cell ${
                        isActiveCol ? 'sf-equip-header-cell--active' : ''
                      } ${owned ? 'sf-equip-header-cell--owned' : ''} ${
                        dimmed ? 'sf-equip-header-cell--dimmed' : ''
                      }`.trim()}
                      title={`${item.name}（${item.desc}）`}
                      onMouseEnter={() => setHoveredFocus({ itemId: colComp, colComp })}
                      onClick={() => selectItem(colComp, undefined, colComp)}
                      data-testid={`equip-col-head-${colComp}`}
                    >
                      <GameItemIcon itemId={colComp} size={iconSize} />
                      <span className="sf-equip-header-stat">{COMPONENT_MICRO_STAT[colComp]}</span>
                    </button>
                  );
                })}

                {BASE_COMPONENT_ORDER.map((rowComp, rIdx) => {
                  const rowItem = ITEM_BY_ID.get(rowComp)!;
                  const rowOwned = (ownedCounts.get(rowComp) ?? 0) >= 1;
                  const isActiveRow = activeFocus.rowComp === rowComp;
                  const rowDimmed =
                    Boolean(normalizedQuery) && !itemMatchesQuery(rowItem, normalizedQuery);
                  return (
                    <React.Fragment key={`row-${rowComp}`}>
                      <button
                        type="button"
                        className={`sf-equip-header-cell sf-equip-header-cell--row ${
                          isActiveRow ? 'sf-equip-header-cell--active' : ''
                        } ${rowOwned ? 'sf-equip-header-cell--owned' : ''} ${
                          rowDimmed ? 'sf-equip-header-cell--dimmed' : ''
                        }`.trim()}
                        title={`${rowItem.name}（${rowItem.desc}）`}
                        onMouseEnter={() => setHoveredFocus({ itemId: rowComp, rowComp })}
                        onClick={() => selectItem(rowComp, rowComp)}
                        data-testid={`equip-row-head-${rowComp}`}
                      >
                        <GameItemIcon itemId={rowComp} size={iconSize} />
                        <span className="sf-equip-header-stat">
                          {COMPONENT_MICRO_STAT[rowComp]}
                        </span>
                      </button>

                      {BASE_COMPONENT_ORDER.map((colComp, cIdx) => {
                        const crafted = lookupCraftRecipe(rowComp, colComp);
                        if (!crafted) {
                          return <div key={`${rowComp}-${colComp}`} className="sf-equip-cell" />;
                        }
                        const craftedRecord = ITEM_BY_ID.get(crafted.id);
                        const craftable = canCraftPair(rowComp, colComp);
                        const isCross =
                          activeFocus.rowComp === rowComp || activeFocus.colComp === colComp;
                        const isFocus =
                          activeFocus.itemId === crafted.id &&
                          ((activeFocus.rowComp === rowComp && activeFocus.colComp === colComp) ||
                            (!activeFocus.rowComp && !activeFocus.colComp));
                        const isQueryMatch =
                          Boolean(normalizedQuery) &&
                          Boolean(craftedRecord && itemMatchesQuery(craftedRecord, normalizedQuery));
                        const isDimmed = Boolean(normalizedQuery) && !isQueryMatch;

                        return (
                          <button
                            key={`${rowComp}-${colComp}`}
                            type="button"
                            className={`sf-equip-cell ${
                              rIdx === cIdx ? 'sf-equip-cell--diagonal' : ''
                            } ${isCross ? 'sf-equip-cell--cross' : ''} ${
                              craftable ? 'sf-equip-cell--craftable' : ''
                            } ${isQueryMatch ? 'sf-equip-cell--match' : ''} ${
                              isFocus ? 'sf-equip-cell--focus' : ''
                            } ${isDimmed ? 'sf-equip-cell--dimmed' : ''}`.trim()}
                            title={crafted.name}
                            onMouseEnter={() =>
                              setHoveredFocus({ itemId: crafted.id, rowComp, colComp })
                            }
                            onClick={() => selectItem(crafted.id, rowComp, colComp)}
                            data-testid={`equip-cell-${rowComp}-${colComp}`}
                          >
                            <GameItemIcon itemId={crafted.id} size={iconSize} />
                            {craftable ? <span className="sf-equip-craft-dot" /> : null}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="sf-equip-tools-bar" aria-label="特殊消耗工具">
                <span className="sf-equip-tools-label">特殊工具</span>
                {TOOL_ITEMS.map((tool) => {
                  const isActive = activeItem.id === tool.id;
                  const isDimmed =
                    Boolean(normalizedQuery) && !itemMatchesQuery(tool, normalizedQuery);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`sf-equip-tool-chip ${
                        isActive ? 'sf-equip-tool-chip--active' : ''
                      } ${isDimmed ? 'sf-equip-tool-chip--dimmed' : ''}`.trim()}
                      onMouseEnter={() => setHoveredFocus({ itemId: tool.id })}
                      onClick={() => selectItem(tool.id)}
                      data-testid={`enc-item-${tool.id}`}
                    >
                      <GameItemIcon itemId={tool.id} size="xs" />
                      <span>{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : filteredGridItems.length > 0 ? (
            <div className="sf-equip-wall" onMouseLeave={() => setHoveredFocus(null)}>
              {filteredGridItems.map((it) => {
                const craftable =
                  it.components && it.components.length === 2
                    ? canCraftPair(it.components[0]!, it.components[1]!)
                    : false;
                const isActive = activeItem.id === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`sf-equip-wall-tile ${
                      isActive ? 'sf-equip-wall-tile--active' : ''
                    } ${craftable ? 'sf-equip-wall-tile--craftable' : ''}`.trim()}
                    title={it.name}
                    onMouseEnter={() => setHoveredFocus({ itemId: it.id })}
                    onClick={() => selectItem(it.id)}
                    data-testid={`enc-item-${it.id}`}
                  >
                    <GameItemIcon itemId={it.id} size="md" />
                    <span className="sf-equip-wall-tile__name">{it.name}</span>
                    {craftable ? <span className="sf-equip-craft-dot" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="sf-equip-empty">未找到匹配「{searchQuery}」的装备。</div>
          )}
        </div>

        <aside className="sf-equip-detail" data-testid="equip-detail-panel">
          <div className="sf-equip-detail__head">
            <GameItemIcon itemId={activeItem.id} size="lg" />
            <div className="sf-equip-detail__title-wrap">
              <span className="sf-equip-detail__badge">{activeItem.categoryLabel}</span>
              <h3 className="sf-equip-detail__name">{activeItem.name}</h3>
            </div>
          </div>

          {activeItem.components && activeItem.components.length === 2 ? (
            <div className="sf-equip-recipe-box">
              <div className="sf-equip-section-label">合成配方（点击散件切换）</div>
              <div className="sf-equip-recipe-bar">
                {activeItem.components.map((cid, idx) => {
                  const comp = ITEM_BY_ID.get(cid);
                  const ownedThis =
                    activeItem.components![0] === activeItem.components![1]
                      ? (ownedCounts.get(cid) ?? 0) > idx
                      : (ownedCounts.get(cid) ?? 0) >= 1;
                  return (
                    <React.Fragment key={`${cid}-${idx}`}>
                      {idx > 0 ? <span className="sf-equip-recipe-op">+</span> : null}
                      <button
                        type="button"
                        className={`sf-equip-recipe-node ${
                          ownedThis ? 'sf-equip-recipe-node--owned' : ''
                        }`.trim()}
                        onClick={() => selectItem(cid, cid)}
                      >
                        <GameItemIcon itemId={cid} size="xs" />
                        <span>{comp?.shortName ?? cid}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
                <span className="sf-equip-recipe-op">→</span>
                <span className="sf-equip-recipe-node">
                  <GameItemIcon itemId={activeItem.id} size="xs" />
                </span>
              </div>
            </div>
          ) : activeItem.kind === 'component' ? (
            <div className="sf-equip-recipe-box">
              <div className="sf-equip-section-label">可合成全部 9 件成装（点击查看）</div>
              <div className="sf-equip-subcrafts-grid">
                {BASE_COMPONENT_ORDER.map((partnerId) => {
                  const crafted = lookupCraftRecipe(activeItem.id, partnerId);
                  if (!crafted) return null;
                  const craftable = canCraftPair(activeItem.id, partnerId);
                  return (
                    <button
                      key={`sub-${activeItem.id}-${partnerId}`}
                      type="button"
                      className={`sf-equip-subcraft-btn ${
                        craftable ? 'sf-equip-subcraft-btn--craftable' : ''
                      }`.trim()}
                      title={`${crafted.name}（+ ${ITEM_BY_ID.get(partnerId)?.shortName ?? partnerId}）`}
                      onClick={() => selectItem(crafted.id, activeItem.id, partnerId)}
                    >
                      <span className="sf-equip-subcraft-plus">+</span>
                      <GameItemIcon itemId={partnerId} size="xs" />
                      <GameItemIcon itemId={crafted.id} size="sm" />
                      {craftable ? <span className="sf-equip-craft-dot" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <div className="sf-equip-section-label">装备效果</div>
            <div className="sf-equip-desc-box">
              <RichGameText text={activeItem.desc} />
            </div>
          </div>

          <div>
            <div className="sf-equip-section-label">推荐佩戴棋子</div>
            {recommendedUnits.length > 0 ? (
              <div className="sf-equip-units-grid">
                {recommendedUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="sf-equip-unit-chip"
                    onClick={() => onSelectUnit?.(u.id)}
                    data-testid={`equip-rec-unit-${u.id}`}
                  >
                    <UnitPortrait
                      unitId={u.id}
                      size="sm"
                      className="sf-equip-unit-chip__portrait"
                    />
                    <span>{u.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sf-equip-desc-box" style={{ color: 'var(--text-muted)' }}>
                通用功能装备，全阵容弈子均可按战局需要灵活佩戴。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
