import React from 'react';
import {
  LINEUP_PLANNER_MAX_SLOTS,
  SEASON1_AUGMENTS,
  SEASON1_LORE,
  SEASON1_UNITS,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
  type ArenaThemeId,
  type AudioEventBus,
  type GameCommand,
} from '@pkg/contracts';
import { getUnitRecommendedBuilds, type ActiveTrait, type SeatState } from '@pkg/game-core';
import { UnitLoreDrawer } from '@pkg/learning-ui';
import { ArenaThemeSwitcher } from '../components/PersistentStageCanvas.js';
import type { BoardStageEngine } from '../stage/index.js';

function formatMMSS(sec: number): string {
  const safe = Math.max(0, Math.ceil(sec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="战术抉择时刻"
      data-testid="choice-event-modal"
    >
      <div className="ui-metal-frame ui-corner-ornaments blc-choice-modal">
        <div className="blc-col-head">
          <div>
            <h2 style={{ margin: 0 }}>
              {showAugmentChoice
                ? '选择强化'
                : activeAnvil?.kind === 'completed'
                  ? '选择成装'
                  : '选择散件'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="blc-clock-pill">{formatMMSS(liveRemainingSec)}</span>
            <button
              type="button"
              className="blc-btn blc-btn--metal blc-btn--sm"
              onClick={onPeekBattlefield}
              data-testid="peek-battlefield-btn"
            >
              查看战场
            </button>
          </div>
        </div>

        <fieldset
          disabled={serverCommandsLocked}
          style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}
        >
          {showAugmentChoice && self.augmentOffer ? (
            <div className="blc-three-choices">
              {self.augmentOffer.options.map((augId, slotIdx) => {
                const aug = SEASON1_AUGMENTS.find((a) => a.id === augId);
                const canReroll = Boolean(self.augmentOffer?.rerolls[slotIdx]);
                return (
                  <div
                    key={`${augId}-${slotIdx}`}
                    className="ui-frosted-panel blc-choice-card"
                    data-testid={`augment-slot-${slotIdx}`}
                    data-augment-id={augId}
                  >
                    <div className="blc-chip blc-chip--gold">
                      {aug?.tier === 'prismatic'
                        ? '棱彩阶符文'
                        : aug?.tier === 'gold'
                          ? '黄金阶符文'
                          : '白银阶符文'}
                    </div>
                    <h3>{aug?.name ?? '强化'}</h3>
                    <p style={{ flex: 1 }}>{aug?.desc ?? ''}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="blc-btn blc-btn--primary"
                        style={{ flex: 1 }}
                        onClick={() => onSendCommand({ type: 'PICK_AUGMENT', slotIndex: slotIdx })}
                        data-testid={`pick-augment-${slotIdx}`}
                      >
                        选择
                      </button>
                      <button
                        type="button"
                        className="blc-btn blc-btn--ghost blc-btn--sm"
                        disabled={!canReroll}
                        onClick={() =>
                          onSendCommand({ type: 'REROLL_AUGMENT_SLOT', slotIndex: slotIdx })
                        }
                        data-testid={`reroll-augment-${slotIdx}`}
                      >
                        重选 {canReroll ? '1/1' : '0/1'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeAnvil ? (
            <div
              className="blc-anvil-grid"
              style={{
                gridTemplateColumns: `repeat(${activeAnvil.options.length}, minmax(0, 1fr))`,
              }}
            >
              {activeAnvil.options.map((itemId, optIdx) => {
                const entry = lookupItemById(itemId);
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
                  .map((u) => SEASON1_UNITS_BY_ID.get(u.unitId)?.name ?? '棋子');

                return (
                  <div
                    key={`${itemId}-${optIdx}`}
                    className="ui-frosted-panel blc-choice-card"
                    data-testid={`anvil-option-${optIdx}`}
                    data-item-id={itemId}
                  >
                    <span className="blc-chip blc-chip--gold">装备补给</span>
                    <h3>{entry?.item.name ?? '装备'}</h3>
                    <p style={{ flex: 1 }}>{entry?.item.desc ?? ''}</p>
                    {matchingUnits.length > 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--gold-light)' }}>
                        适合：{[...new Set(matchingUnits)].slice(0, 3).join(' / ')}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary"
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
      className="blc-modal-backdrop"
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

        <div className="ui-frosted-panel" style={{ padding: 10, margin: '8px 0' }}>
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
                    className={`shop-card shop-card--cost-${u.cost} ${
                      chosen ? 'shop-card--merge-3star' : ''
                    }`.trim()}
                    onClick={() => onToggleUnit(u.id)}
                    data-testid={`planner-unit-${u.id}`}
                  >
                    {chosen ? <span className="shop-card__planner-bookmark" /> : null}
                    <div className="blc-shop-card__top">
                      <strong>{u.name}</strong>
                      <span className="blc-gold-text">{u.cost}费</span>
                    </div>
                    <div className="blc-shop-card__traits">
                      {u.faction} · {u.role}
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
}: {
  readonly codexUnitId: string;
  readonly ownedComponentIds: readonly string[];
  readonly audioBus: AudioEventBus;
  readonly onSelectUnit: (unitId: string) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="局内图鉴"
      data-testid="inmatch-codex-modal"
    >
      <div className="ui-metal-frame ui-corner-ornaments blc-workbench-modal">
        <div className="blc-col-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong>棋子图鉴</strong>
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
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--xs"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="blc-workbench-scroll">
          <UnitLoreDrawer
            unitId={codexUnitId}
            loreData={SEASON1_LORE}
            initialTab="overview"
            ownedComponentIds={ownedComponentIds}
            audioBus={audioBus}
          />
        </div>
      </div>
    </div>
  );
}

export function MatchSettingsModal({
  isOfflineSandboxMatch,
  stageEngine,
  onSetFullscreen,
  onQuitOfflineMatch,
  onClose,
}: {
  readonly isOfflineSandboxMatch: boolean;
  readonly stageEngine: BoardStageEngine | null;
  readonly onSetFullscreen: (fullscreen: boolean) => void;
  readonly onQuitOfflineMatch: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const stats = stageEngine?.getPerfStats() ?? null;

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="局内显示与舞台设置"
      data-testid="inmatch-settings-modal"
    >
      <div className="ui-metal-frame ui-corner-ornaments blc-dialog-sm">
        <div className="blc-dialog-sm__head">
          <h3>战场设置</h3>
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--xs"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="blc-form-stack">
          <div>
            <div className="blc-field__label" style={{ marginBottom: 6 }}>
              舞台
            </div>
            <ArenaThemeSwitcher compact />
          </div>

          <div>
            <div className="blc-field__label" style={{ marginBottom: 6 }}>
              横屏显示模式
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--sm"
                onClick={() => onSetFullscreen(true)}
              >
                横屏全屏
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--sm"
                onClick={() => onSetFullscreen(false)}
              >
                横屏窗口
              </button>
            </div>
          </div>

          {stats ? (
            <div className="ui-frosted-panel" style={{ padding: 10, fontSize: 12 }}>
              <div>
                绘制 <strong>{stats.drawCalls}</strong> · 面数 <strong>{stats.triangles}</strong> ·
                帧率 <strong>{stats.fpsEstimate}</strong>
              </div>
            </div>
          ) : null}

          {isOfflineSandboxMatch ? (
            <button
              type="button"
              className="blc-btn blc-btn--ghost"
              onClick={onQuitOfflineMatch}
              data-testid="quit-offline-match-btn"
            >
              结束演练
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              断线后可重连。电脑仅托管棋盘，不代答学习题。已确认的学习记录会保留。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type MatchHudModalTheme = ArenaThemeId;
