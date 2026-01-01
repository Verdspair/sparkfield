import React, { useMemo, useState } from 'react';
import {
  SEASON1_AUGMENTS,
  SEASON1_ITEMS,
  SEASON1_LORE,
  SEASON1_TRAITS,
  SEASON1_UNITS,
  lookupItemById,
  type AugmentDef,
  type UnitDef,
} from '@pkg/contracts';
import { LoreArchiveReader, UnitLoreDrawer } from '@pkg/learning-ui';
import { useAppStore } from '../store/appStore.js';

type EncyclopediaTab = 'units' | 'traits' | 'items' | 'augments' | 'lore';

interface NormalizedTraitEntry {
  id: string;
  name: string;
  kindLabel: '派系' | '职能' | '专属';
  thresholds: number[];
  desc: string;
  emblemId?: string;
}

interface NormalizedItemEntry {
  id: string;
  name: string;
  categoryLabel: string;
  desc: string;
  formula?: string;
  components?: string[];
}

export function EncyclopediaPage(): React.JSX.Element {
  const { audioBus } = useAppStore();

  const [activeCategory, setActiveCategory] = useState<EncyclopediaTab>('units');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<NormalizedTraitEntry | null>(null);
  const [selectedItem, setSelectedItem] = useState<NormalizedItemEntry | null>(null);
  const [selectedAugment, setSelectedAugment] = useState<AugmentDef | null>(null);

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

  const allItems: NormalizedItemEntry[] = useMemo(
    () => [
      ...SEASON1_ITEMS.components.map((c) => ({
        id: c.id,
        name: c.name,
        categoryLabel: '基础散件',
        desc: c.desc,
      })),
      {
        id: SEASON1_ITEMS.special.spatulaComponent.id,
        name: SEASON1_ITEMS.special.spatulaComponent.name,
        categoryLabel: '特殊散件',
        desc: SEASON1_ITEMS.special.spatulaComponent.desc,
      },
      ...SEASON1_ITEMS.completedItems.map((it) => ({
        id: it.id,
        name: it.name,
        categoryLabel: '成装',
        desc: it.desc,
        formula: it.formula,
        components: [...it.components],
      })),
      ...SEASON1_ITEMS.emblems.map((em) => ({
        id: em.id,
        name: em.name,
        categoryLabel: `纹章 · ${em.faction}`,
        desc: em.desc,
        components: [...em.components],
      })),
      {
        id: SEASON1_ITEMS.special.mothershipFlag.id,
        name: SEASON1_ITEMS.special.mothershipFlag.name,
        categoryLabel: '母舰奇物',
        desc: SEASON1_ITEMS.special.mothershipFlag.desc,
        components: [...SEASON1_ITEMS.special.mothershipFlag.components],
      },
      ...SEASON1_ITEMS.special.consumables.map((tl) => ({
        id: tl.id,
        name: tl.name,
        categoryLabel: '消耗工具',
        desc: tl.desc,
      })),
    ],
    [],
  );

  const filteredUnits = useMemo(() => {
    if (!q) return SEASON1_UNITS;
    return SEASON1_UNITS.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.faction.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.uniqueTrait && u.uniqueTrait.toLowerCase().includes(q)) ||
        u.skillSummary.toLowerCase().includes(q),
    );
  }, [q]);

  const filteredTraits = useMemo(() => {
    if (!q) return allTraits;
    return allTraits.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.kindLabel.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q),
    );
  }, [allTraits, q]);

  const filteredItems = useMemo(() => {
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.categoryLabel.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q) ||
        (it.formula && it.formula.toLowerCase().includes(q)),
    );
  }, [allItems, q]);

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
    setSelectedItem(null);
    setSelectedAugment(null);
  };

  const openUnit = (unit: UnitDef | string) => {
    closeAllDrawers();
    setSelectedUnitId(typeof unit === 'string' ? unit : unit.id);
  };

  const formatAugmentTier = (tier: AugmentDef['tier']) =>
    tier === 'prismatic' ? '棱彩' : tier === 'gold' ? '黄金' : '白银';

  return (
    <div className="blc-page-shell blc-encyclopedia-shell" data-testid="encyclopedia-page">
      <header
        className="ui-frosted-panel blc-enc-header"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.22)',
          background: 'rgba(13, 17, 26, 0.78)',
        }}
      >
        <div className="blc-enc-header__top">
          <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 600 }}>图鉴</h2>

          <div className="blc-search-box">
            <input
              type="search"
              className="blc-input"
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
        </div>

        <nav className="blc-enc-tabs" role="tablist" aria-label="图鉴分类">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'units'}
            className={`blc-seg-tab ${activeCategory === 'units' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setActiveCategory('units')}
            data-testid="enc-tab-units"
          >
            棋子 ({SEASON1_UNITS.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'traits'}
            className={`blc-seg-tab ${activeCategory === 'traits' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setActiveCategory('traits')}
            data-testid="enc-tab-traits"
          >
            羁绊 ({allTraits.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'items'}
            className={`blc-seg-tab ${activeCategory === 'items' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setActiveCategory('items')}
            data-testid="enc-tab-items"
          >
            装备 ({allItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'augments'}
            className={`blc-seg-tab ${activeCategory === 'augments' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setActiveCategory('augments')}
            data-testid="enc-tab-augments"
          >
            符文 ({SEASON1_AUGMENTS.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'lore'}
            className={`blc-seg-tab ${activeCategory === 'lore' ? 'blc-seg-tab--active' : ''}`}
            onClick={() => setActiveCategory('lore')}
            data-testid="enc-tab-lore"
          >
            纪元
          </button>
        </nav>
      </header>

      <div className="blc-enc-body">
        <div className="blc-enc-scroll" data-testid="encyclopedia-scroll-list">
          {activeCategory === 'units' ? (
            <div className="blc-unit-grid">
              {filteredUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`shop-card shop-card--cost-${u.cost} blc-enc-unit-card ${
                    selectedUnitId === u.id ? 'blc-enc-unit-card--selected' : ''
                  }`.trim()}
                  onClick={() => openUnit(u)}
                  data-testid={`enc-unit-${u.id}`}
                >
                  <div className="blc-shop-card__top">
                    <strong style={{ fontSize: 15 }}>{u.name}</strong>
                    <span className="blc-gold-text">{u.cost} 费</span>
                  </div>
                  <div className="blc-shop-card__traits">
                    <span>{u.faction}</span> · <span>{u.role}</span>
                    {u.uniqueTrait ? <span> · {u.uniqueTrait}</span> : null}
                  </div>
                  <p className="blc-enc-unit-card__desc">{u.skillSummary}</p>
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
                  style={{ border: '1px solid rgba(240, 220, 170, 0.2)' }}
                  onClick={() => {
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
                  <p className="blc-enc-entry-card__desc">{tr.desc}</p>
                </button>
              ))}
            </div>
          ) : null}

          {activeCategory === 'items' ? (
            <div className="blc-card-grid">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="ui-frosted-panel blc-enc-entry-card"
                  style={{ border: '1px solid rgba(240, 220, 170, 0.2)' }}
                  onClick={() => {
                    closeAllDrawers();
                    setSelectedItem(it);
                  }}
                  data-testid={`enc-item-${it.id}`}
                >
                  <div className="blc-enc-entry-card__head">
                    <span className="blc-item-glyph">◆</span>
                    <div>
                      <strong>{it.name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--gold-light)' }}>
                        {it.categoryLabel}
                        {it.formula ? ` · ${it.formula}` : ''}
                      </div>
                    </div>
                  </div>
                  <p className="blc-enc-entry-card__desc">{it.desc}</p>
                </button>
              ))}
            </div>
          ) : null}

          {activeCategory === 'augments' ? (
            <div className="blc-card-grid">
              {filteredAugments.map((aug) => (
                <button
                  key={aug.id}
                  type="button"
                  className="ui-frosted-panel blc-enc-entry-card"
                  style={{ border: '1px solid rgba(240, 220, 170, 0.2)' }}
                  onClick={() => {
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
                  <p className="blc-enc-entry-card__desc">{aug.desc}</p>
                </button>
              ))}
            </div>
          ) : null}

          {activeCategory === 'lore' ? (
            <LoreArchiveReader
              loreData={SEASON1_LORE}
              searchQuery={searchQuery}
              selectedUnitId={selectedUnitId}
              onSelectUnitId={(uid) => setSelectedUnitId(uid)}
            />
          ) : null}
        </div>

        {activeCategory !== 'lore' &&
        (selectedUnitId || selectedTrait || selectedItem || selectedAugment) ? (
          <aside className="blc-enc-drawer" data-testid="encyclopedia-detail-drawer">
            {selectedUnitId ? (
              <UnitLoreDrawer
                unitId={selectedUnitId}
                loreData={SEASON1_LORE}
                initialTab="overview"
                audioBus={audioBus}
                onClose={closeAllDrawers}
              />
            ) : null}

            {selectedTrait ? (
              <div
                className="ui-frosted-panel blc-drawer-dark"
                style={{ border: '1px solid rgba(240, 220, 170, 0.24)' }}
              >
                <div className="blc-col-head">
                  <div>
                    <span className="blc-chip blc-chip--gold">{selectedTrait.kindLabel}</span>
                    <h3 style={{ margin: '6px 0 0' }}>{selectedTrait.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={closeAllDrawers}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ lineHeight: 1.65, color: 'var(--text-primary)' }}>{selectedTrait.desc}</p>
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

            {selectedItem ? (
              <div
                className="ui-frosted-panel blc-drawer-dark"
                style={{ border: '1px solid rgba(240, 220, 170, 0.24)' }}
              >
                <div className="blc-col-head">
                  <div>
                    <span className="blc-chip blc-chip--gold">{selectedItem.categoryLabel}</span>
                    <h3 style={{ margin: '6px 0 0' }}>{selectedItem.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={closeAllDrawers}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ lineHeight: 1.65 }}>{selectedItem.desc}</p>
                {selectedItem.components && selectedItem.components.length > 0 ? (
                  <div className="ui-frosted-panel" style={{ padding: 12 }}>
                    <div className="blc-field__label" style={{ marginBottom: 8 }}>
                      合成配方
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedItem.components.map((cid, idx) => {
                        const c = lookupItemById(cid);
                        return (
                          <React.Fragment key={`${cid}-${idx}`}>
                            {idx > 0 ? <span>＋</span> : null}
                            <span className="item-recipe-node item-recipe-node--owned">
                              {c?.item.name ?? cid}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <div className="blc-field__label" style={{ marginBottom: 8 }}>
                    适配棋子
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SEASON1_UNITS.filter((u) =>
                      u.recommendedItems.includes(selectedItem.id),
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
                style={{ border: '1px solid rgba(240, 220, 170, 0.24)' }}
              >
                <div className="blc-col-head">
                  <div>
                    <span className="blc-chip blc-chip--gold">
                      {formatAugmentTier(selectedAugment.tier)} · {selectedAugment.category}
                    </span>
                    <h3 style={{ margin: '6px 0 0' }}>{selectedAugment.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={closeAllDrawers}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ lineHeight: 1.65 }}>{selectedAugment.desc}</p>
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
    </div>
  );
}
