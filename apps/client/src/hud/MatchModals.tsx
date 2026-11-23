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
import { GameItemIcon, RichGameText, UnitLoreDrawer } from '@pkg/learning-ui';
import { EquipmentCodexMatrix } from '../components/EquipmentCodexMatrix.js';
import { GameUiIcon } from '../components/GameUiIcons.js';
import { UnitPortrait } from '../components/UnitPortrait.js';

function formatMMSS(sec: number): string {
  const safe = Math.max(0, Math.ceil(sec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function ThreeRingEnergyEmblem({
  tier,
  variant = 'augment',
  itemId,
}: {
  readonly tier: 'silver' | 'gold' | 'prismatic';
  readonly variant?: 'augment' | 'anvil';
  readonly itemId?: string;
}): React.JSX.Element {
  const strokePrimary =
    tier === 'prismatic' ? '#e879f9' : tier === 'gold' ? '#f2c97d' : '#cbd5e1';
  const strokeSecondary =
    tier === 'prismatic' ? '#4fd1ff' : tier === 'gold' ? '#fff0c4' : '#94a3b8';

  return (
    <div className="sf-tri-ring-emblem" aria-hidden="true">
      <svg className="sf-tri-ring-emblem__outer" viewBox="0 0 96 96" fill="none">
        <circle
          cx="48"
          cy="48"
          r="45"
          stroke={strokePrimary}
          strokeWidth="1.5"
          strokeDasharray="10 6 2 6"
          opacity="0.88"
        />
        <circle cx="48" cy="3" r="2.5" fill={strokeSecondary} />
        <circle cx="48" cy="93" r="2.5" fill={strokeSecondary} />
        <circle cx="3" cy="48" r="2" fill={strokePrimary} />
        <circle cx="93" cy="48" r="2" fill={strokePrimary} />
      </svg>
      <svg className="sf-tri-ring-emblem__mid" viewBox="0 0 74 74" fill="none">
        <circle
          cx="37"
          cy="37"
          r="34"
          stroke={strokeSecondary}
          strokeWidth="1.5"
          strokeDasharray="18 8"
          opacity="0.78"
        />
        <polygon
          points="37,5 41,11 33,11"
          fill={strokePrimary}
          opacity="0.9"
        />
      </svg>
      <div className="sf-tri-ring-emblem__core">
        {variant === 'anvil' && itemId ? (
          <GameItemIcon itemId={itemId} size="lg" />
        ) : variant === 'anvil' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 9h16l-2 4h-3l2 6H7l2-6H6L4 9Z"
              stroke={strokeSecondary}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="5.5" r="2" fill={strokePrimary} />
          </svg>
        ) : tier === 'prismatic' ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"
              fill={strokePrimary}
              stroke={strokeSecondary}
              strokeWidth="1.4"
            />
          </svg>
        ) : tier === 'gold' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon
              points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"
              stroke={strokeSecondary}
              strokeWidth="1.7"
              fill="rgba(242,201,125,0.18)"
            />
            <circle cx="12" cy="12" r="3.4" fill={strokePrimary} />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon
              points="12,3 20,12 12,21 4,12"
              stroke={strokeSecondary}
              strokeWidth="1.7"
              fill="rgba(203,213,225,0.16)"
            />
            <circle cx="12" cy="12" r="2.6" fill={strokePrimary} />
          </svg>
        )}
      </div>
    </div>
  );
}

export function MatchChoiceModal({
  showAugmentChoice,
  self,
  liveRemainingSec,
  serverCommandsLocked,
  onPeekBattlefield,
  onSendCommand,
}: {
  readonly showAugmentChoice: boolean;
  readonly self: SeatState;
  readonly liveRemainingSec: number;
  readonly serverCommandsLocked: boolean;
  readonly onPeekBattlefield: () => void;
  readonly onSendCommand: (cmd: GameCommand) => void;
}): React.JSX.Element | null {
  const activeAnvil = self.anvils[0] ?? null;

  return (
    <div
      className="sf-choice-backdrop sf-hud-modal"
      role="dialog"
      aria-modal="true"
      aria-label="战术抉择时刻"
      data-testid="choice-event-modal"
    >
      <div className="sf-choice-stage">
        <div className="sf-choice-header">
          <h2 className="sf-choice-title">
            {showAugmentChoice
              ? '星海强化抉择'
              : activeAnvil?.kind === 'completed'
                ? '成装星核锻炉'
                : '散件补给锻炉'}
          </h2>
          <span className="blc-clock-pill">{formatMMSS(liveRemainingSec)}</span>
        </div>

        <fieldset
          disabled={serverCommandsLocked}
          style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
        >
          {showAugmentChoice && self.augmentOffer ? (
            <div className="sf-augment-row">
              {self.augmentOffer.options.map((augId, slotIdx) => {
                const aug = SEASON1_AUGMENTS.find((a) => a.id === augId);
                const tier: 'silver' | 'gold' | 'prismatic' =
                  aug?.tier === 'prismatic'
                    ? 'prismatic'
                    : aug?.tier === 'gold'
                      ? 'gold'
                      : 'silver';
                const canReroll = Boolean(self.augmentOffer?.rerolls[slotIdx]);
                return (
                  <div key={`${augId}-${slotIdx}`} className="sf-augment-col">
                    <div
                      className={`sf-augment-card sf-augment-card--${tier}`}
                      data-testid={`augment-slot-${slotIdx}`}
                      data-augment-id={augId}
                    >
                      <ThreeRingEnergyEmblem tier={tier} variant="augment" />
                      <span className={`sf-augment-tier-tag sf-augment-tier-tag--${tier}`}>
                        {tier === 'prismatic'
                          ? '棱彩阶强化'
                          : tier === 'gold'
                            ? '黄金阶强化'
                            : '白银阶强化'}
                      </span>
                      <h3 className="sf-augment-name">{aug?.name ?? '星海强化'}</h3>
                      <div className="sf-augment-desc-box">
                        {aug?.desc ? <RichGameText text={aug.desc} /> : ''}
                      </div>
                      <button
                        type="button"
                        className="sf-augment-pick-btn"
                        onClick={() => onSendCommand({ type: 'PICK_AUGMENT', slotIndex: slotIdx })}
                        data-testid={`pick-augment-${slotIdx}`}
                      >
                        选定强化
                      </button>
                    </div>
                    <button
                      type="button"
                      className="sf-augment-reroll-btn"
                      disabled={!canReroll}
                      onClick={() =>
                        onSendCommand({ type: 'REROLL_AUGMENT_SLOT', slotIndex: slotIdx })
                      }
                      data-testid={`reroll-augment-${slotIdx}`}
                    >
                      ↻ 刷新 {canReroll ? '(1)' : '(0)'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activeAnvil ? (
            <div
              className="sf-anvil-grid"
              style={{
                gridTemplateColumns: `repeat(${activeAnvil.options.length}, minmax(0, 224px))`,
              }}
            >
              {activeAnvil.options.map((itemId, optIdx) => {
                const entry = lookupItemById(itemId);
                const tier = activeAnvil.kind === 'completed' ? 'gold' : 'silver';
                const matchingUnits = self.units
                  .filter((u) =>
                    getUnitRecommendedBuilds(u.unitId, [
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
                    className={`sf-augment-card sf-anvil-card sf-augment-card--${tier}`}
                    data-testid={`anvil-option-${optIdx}`}
                    data-item-id={itemId}
                  >
                    <ThreeRingEnergyEmblem tier={tier} variant="anvil" itemId={itemId} />
                    <span className={`sf-augment-tier-tag sf-augment-tier-tag--${tier}`}>
                      {activeAnvil.kind === 'completed' ? '成装补给' : '散件补给'}
                    </span>
                    <h3 className="sf-augment-name">{entry?.item.name ?? '装备'}</h3>
                    <div className="sf-augment-desc-box">
                      {entry?.item.desc ? <RichGameText text={entry.item.desc} /> : ''}
                    </div>
                    {matchingUnits.length > 0 ? (
                      <div className="sf-anvil-fits" aria-label="推荐佩戴棋子">
                        {matchingUnits.map((u) => (
                          <UnitPortrait
                            key={u.instanceId}
                            unitId={u.unitId}
                            size="sm"
                            star={u.star}
                          />
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="sf-augment-pick-btn"
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
          className="sf-choice-peek-btn"
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
      <div className="ui-metal-frame ui-corner-ornaments blc-workbench-modal">
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
            style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
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
      <div className="ui-metal-frame ui-corner-ornaments blc-workbench-modal">
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
