import React from 'react';
import { useAppStore, type BottomNavTab } from '../store/appStore.js';

const BOTTOM_DOCK_TABS: readonly { id: BottomNavTab; label: string; glyph: string }[] = [
  { id: 'lobby', label: '大厅', glyph: '◈' },
  { id: 'learning', label: '学习', glyph: '✦' },
  { id: 'encyclopedia', label: '图鉴', glyph: '❖' },
  { id: 'ranking', label: '排行', glyph: '▲' },
  { id: 'profile', label: '我的', glyph: '◎' },
];

export function BottomDockNav(): React.JSX.Element | null {
  const {
    authMode,
    inActiveMatch,
    activeTab,
    setActiveTab,
    redemptionOpen,
    lobbyState,
  } = useAppStore();

  if (authMode === 'booting' || authMode === 'unauthenticated' || inActiveMatch) {
    return null;
  }

  return (
    <nav
      className="ui-frosted-panel blc-bottom-dock"
      style={{
        borderRadius: 999,
        padding: '4px 8px',
        border: '1px solid rgba(240, 220, 170, 0.24)',
        background: 'rgba(12, 16, 24, 0.82)',
        gap: 4,
      }}
      aria-label="主导航"
      data-testid="bottom-dock-nav"
    >
      {BOTTOM_DOCK_TABS.map((tab) => {
        const isCurrent = !redemptionOpen && activeTab === tab.id;
        const hasLiveRoomBadge = tab.id === 'lobby' && Boolean(lobbyState.prepRoom);
        return (
          <button
            key={tab.id}
            type="button"
            className={`blc-dock-item ${isCurrent ? 'blc-dock-item--active' : ''}`.trim()}
            style={{
              minWidth: 78,
              minHeight: 38,
              padding: '5px 14px',
              borderRadius: 999,
            }}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`dock-tab-${tab.id}`}
          >
            <span className="blc-dock-item__glyph" aria-hidden="true">
              {tab.glyph}
            </span>
            <span className="blc-dock-item__label">{tab.label}</span>
            {hasLiveRoomBadge ? (
              <span
                className="blc-dock-item__dot"
                title={lobbyState.prepRoom?.status === 'queuing' ? '匹配中' : '房间在线'}
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
