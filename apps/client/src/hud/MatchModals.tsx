import React, { useEffect, useState } from 'react';
import {
  LINEUP_PLANNER_MAX_SLOTS,
  SEASON1_AUGMENTS,
  SEASON1_LORE,
  SEASON1_UNITS,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
  type AudioEventBus,
  type GameCommand,
} from '@pkg/contracts';
import { getUnitRecommendedBuilds, type ActiveTrait, type SeatState } from '@pkg/game-core';
import { DescriptionModeToggle, GameEffectText, GameItemIcon, UnitLoreDrawer } from '@pkg/learning-ui';
import { EquipmentCodexMatrix } from '../components/EquipmentCodexMatrix.js';
import { GameUiIcon } from '../components/GameUiIcons.js';
import { UnitPortrait } from '../components/UnitPortrait.js';

type AugmentTier = 'silver' | 'gold' | 'prismatic';

const AUGMENT_TIER_LABELS: Readonly<Record<AugmentTier, string>> = {
  silver: '白银',
  gold: '黄金',
  prismatic: '棱彩',
};

const AUGMENT_TIER_GLYPHS: Readonly<Record<AugmentTier, string>> = {
  silver: 'M12 3 21 12 12 21 3 12Z',
  gold: 'M12 3 20 7.5v9L12 21l-8-4.5v-9Z',
  prismatic: 'M12 2.5 14.7 9.3 21.5 12 14.7 14.7 12 21.5 9.3 14.7 2.5 12 9.3 9.3Z',
};

function AugmentMark({ tier }: { readonly tier: AugmentTier }): React.JSX.Element {
  return (
    <span className="sf-choice-mark" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d={AUGMENT_TIER_GLYPHS[tier]} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function MatchChoiceModal({
  showAugmentChoice,
  self,
  serverCommandsLocked,
  onPeekBattlefield,
  onSendCommand,
}: {
  readonly showAugmentChoice: boolean;
  readonly self: SeatState;
  readonly serverCommandsLocked: boolean;
  readonly onPeekBattlefield: () => void;
  readonly onSendCommand: (cmd: GameCommand) => void;
}): React.JSX.Element | null {
  const offer = self.augmentOffer;
  const activeAnvil = self.anvils[0] ?? null;
  const title = showAugmentChoice ? '选择强化符文' : activeAnvil?.kind === 'completed' ? '成装铁砧' : '散件铁砧';

  return (
    <div
      className="sf-choice-backdrop sf-hud-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="choice-event-modal"
    >
      <div className="sf-choice-stage">
        <div className="sf-choice-header">
          <h2 className="sf-choice-title">{title}</h2>
          <DescriptionModeToggle size="sm" />
        </div>

        <fieldset
          disabled={serverCommandsLocked}
          className="sf-choice-options"
        >
          {showAugmentChoice && offer ? (
            <div className="sf-augment-row">
              {offer.options.map((augId, slotIdx) => {
                const aug = SEASON1_AUGMENTS.find((a) => a.id === augId);
                const tier = aug?.tier ?? 'silver';
                const canReroll = Boolean(offer.rerolls[slotIdx]);
                return (
                  <div key={`${augId}-${slotIdx}`} className="sf-augment-col">
                    <div
                      className={`sf-augment-card sf-augment-card--${tier}`}
                      data-testid={`augment-slot-${slotIdx}`}
                      data-augment-id={augId}
                    >
                      <div className="sf-choice-card-heading">
                        <AugmentMark tier={tier} />
                        <div>
                          <span className="sf-augment-tier-tag">{AUGMENT_TIER_LABELS[tier]}</span>
                          <h3 className="sf-augment-name">{aug?.name ?? '强化符文'}</h3>
                        </div>
                      </div>
                      <div className="sf-augment-desc-box">
                        {aug?.desc ? <GameEffectText augmentId={augId} fullText={aug.desc} /> : ''}
                      </div>
                      <button
                        type="button"
                        className="blc-btn blc-btn--primary blc-btn--sm sf-augment-pick-btn"
                        onClick={() => onSendCommand({ type: 'PICK_AUGMENT', slotIndex: slotIdx })}
                        data-testid={`pick-augment-${slotIdx}`}
                      >
                        选定强化
                      </button>
                    </div>
                    <button
                      type="button"
                      className="blc-btn blc-btn--ghost blc-btn--sm sf-augment-reroll-btn"
                      disabled={!canReroll}
                      onClick={() =>
                        onSendCommand({ type: 'REROLL_AUGMENT_SLOT', slotIndex: slotIdx })
                      }
                      data-testid={`reroll-augment-${slotIdx}`}
                    >
                      {canReroll ? '刷新此符文' : '已刷新'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activeAnvil ? (
            <div
              className="sf-anvil-grid"
              style={{
                '--choice-count': activeAnvil.options.length,
              } as React.CSSProperties}
            >
              {activeAnvil.options.map((itemId, optIdx) => {
                const entry = lookupItemById(itemId);
                const matchingUnitIds = [...new Set(self.units.map((unit) => unit.unitId))]
                  .filter((unitId) =>
                    getUnitRecommendedBuilds(unitId, [
                      ...self.inventoryItems,
                      itemId,
                    ]).some(
                      (b) =>
                        b.itemId === itemId || b.components.some((c) => c.itemId === itemId),
                    ),
                  )
                  .slice(0, 3);

                return (
                  <div
                    key={`${itemId}-${optIdx}`}
                    className="sf-augment-card"
                    data-testid={`anvil-option-${optIdx}`}
                    data-item-id={itemId}
                  >
                    <div className="sf-choice-card-heading">
                      <GameItemIcon itemId={itemId} size="lg" />
                      <h3 className="sf-augment-name">{entry?.item.name ?? '装备'}</h3>
                    </div>
                    <div className="sf-augment-desc-box">
                      {entry?.item.desc ? (
                        <GameEffectText itemId={itemId} fullText={entry.item.desc} />
                      ) : (
                        ''
                      )}
                    </div>
                    {matchingUnitIds.length > 0 ? (
                      <div className="sf-anvil-fits" aria-label="推荐佩戴棋子">
                        <span>适合</span>
                        {matchingUnitIds.map((unitId) => (
                          <UnitPortrait key={unitId} unitId={unitId} size="sm" />
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary blc-btn--sm sf-augment-pick-btn"
                      onClick={() =>
                        onSendCommand({
                          type: 'PICK_ANVIL_OPTION',
                          anvilInstanceId: activeAnvil.instanceId,
                          optionIndex: optIdx,
                        })
                      }
                      data-testid={`pick-anvil-${optIdx}`}
                    >
                      收入背包
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </fieldset>

        <button
          type="button"
          className="blc-btn blc-btn--ghost blc-btn--sm"
          onClick={onPeekBattlefield}
          data-testid="peek-battlefield-btn"
        >
          <GameUiIcon name="eye" size={15} />
          <span>查看战场</span>
        </button>
      </div>
    </div>
  );
}

export function MatchLineupPlannerModal({
  lineupPlan,
  plannedTraits,
  serverCommandsLocked,
  onClearPlan,
  onToggleUnit,
  onClose,
}: {
  readonly lineupPlan: readonly string[];
  readonly plannedTraits: readonly ActiveTrait[];
  readonly serverCommandsLocked: boolean;
  readonly onClearPlan: () => void;
  readonly onToggleUnit: (unitId: string) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="blc-modal-backdrop sf-hud-modal"
      role="dialog"
      aria-modal="true"
      aria-label="10槽阵容规划器"
      data-testid="lineup-planner-modal"
    >
      <div className="ui-metal-frame blc-workbench-modal">
        <div className="blc-col-head">
          <div>
            <h3 style={{ margin: 0 }}>
              阵容规划 {lineupPlan.length}/{LINEUP_PLANNER_MAX_SLOTS}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {lineupPlan.length > 0 ? (
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                disabled={serverCommandsLocked}
                onClick={onClearPlan}
              >
                清空规划
              </button>
            ) : null}
            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="sf-planner-selected-strip" style={{ margin: '8px 0 4px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>
            目标阵容
          </span>
          {lineupPlan.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              点击下方棋子加入规划，商店刷新将自动标星提醒。
            </span>
          ) : (
            lineupPlan.map((uid) => {
              const def = SEASON1_UNITS_BY_ID.get(uid);
              return (
                <button
                  key={uid}
                  type="button"
                  disabled={serverCommandsLocked}
                  onClick={() => onToggleUnit(uid)}
                  title={`移出 ${def?.name ?? uid}`}
                  style={{
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <UnitPortrait unitId={uid} size="sm" />
                </button>
              );
            })
          )}
        </div>

        <div className="ui-frosted-panel" style={{ padding: 8, margin: '4px 0 8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>羁绊预览</span>
            {plannedTraits.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>选择棋子加入规划。</span>
            ) : (
              plannedTraits.map((pt) => (
                <span
                  key={pt.traitName}
                  className={`blc-chip ${pt.activeTier > 0 ? 'blc-chip--gold' : ''}`}
                >
                  {pt.traitName} ({pt.count})
                </span>
              ))
            )}
          </div>
        </div>

        <div className="blc-workbench-scroll">
          <fieldset
            disabled={serverCommandsLocked}
            className="sf-choice-options"
          >
            <div className="blc-unit-grid">
              {SEASON1_UNITS.map((u) => {
                const chosen = lineupPlan.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`shop-card shop-card--cost-${u.cost} sf-planner-unit-card ${
                      chosen ? 'shop-card--merge-3star' : ''
                    }`.trim()}
                    onClick={() => onToggleUnit(u.id)}
                    data-testid={`planner-unit-${u.id}`}
                  >
                    {chosen ? <span className="shop-card__planner-bookmark" /> : null}
                    <UnitPortrait unitId={u.id} size="sm" />
                    <div className="sf-planner-unit-meta">
                      <div className="blc-shop-card__top">
                        <strong>{u.name}</strong>
                        <span className="blc-gold-text">{u.cost}费</span>
                      </div>
                      <div className="blc-shop-card__traits">
                        {u.faction} · {u.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

export function MatchCodexModal({
  codexUnitId,
  ownedComponentIds,
  audioBus,
  onSelectUnit,
  onClose,
  initialTab = 'units',
  initialItemId = null,
}: {
  readonly codexUnitId: string;
  readonly ownedComponentIds: readonly string[];
  readonly audioBus: AudioEventBus;
  readonly onSelectUnit: (unitId: string) => void;
  readonly onClose: () => void;
  readonly initialTab?: 'items' | 'units';
  readonly initialItemId?: string | null;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'items' | 'units'>(initialTab);
  const [itemSearch, setItemSearch] = useState<string>('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div
      className="blc-modal-backdrop sf-hud-modal"
      role="dialog"
      aria-modal="true"
      aria-label="局内图鉴"
      data-testid="inmatch-codex-modal"
    >
      <div className="ui-metal-frame blc-workbench-modal">
        <div className="blc-col-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="sf-equip-view-switch" role="tablist" aria-label="局内图鉴切换">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'items'}
                className={`sf-equip-view-btn ${activeTab === 'items' ? 'sf-equip-view-btn--active' : ''}`.trim()}
                onClick={() => setActiveTab('items')}
                data-testid="codex-tab-items"
              >
                装备合成图鉴
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'units'}
                className={`sf-equip-view-btn ${activeTab === 'units' ? 'sf-equip-view-btn--active' : ''}`.trim()}
                onClick={() => setActiveTab('units')}
                data-testid="codex-tab-units"
              >
                棋子图鉴
              </button>
            </div>
            {activeTab === 'units' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UnitPortrait unitId={codexUnitId} size="sm" />
                <select
                  className="blc-select"
                  style={{ width: 220 }}
                  value={codexUnitId}
                  onChange={(e) => onSelectUnit(e.target.value)}
                >
                  {SEASON1_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.cost}费 · {u.name} ({u.faction}/{u.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="search"
                className="sf-equip-search-input"
                placeholder="搜装备、散件、效果…"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                data-testid="codex-item-search"
              />
            )}
          </div>
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--xs"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="blc-workbench-scroll">
          {activeTab === 'items' ? (
            <EquipmentCodexMatrix
              compact
              searchQuery={itemSearch}
              ownedComponentIds={ownedComponentIds}
              initialItemId={initialItemId}
              onSelectUnit={(uid) => {
                onSelectUnit(uid);
                setActiveTab('units');
              }}
            />
          ) : (
            <UnitLoreDrawer
              unitId={codexUnitId}
              loreData={SEASON1_LORE}
              initialTab="overview"
              ownedComponentIds={ownedComponentIds}
              audioBus={audioBus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const InMatchCodexModal = MatchCodexModal;
