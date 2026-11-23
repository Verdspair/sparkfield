import React from 'react';
import { GameUiIcon } from './GameUiIcons.js';
import { useAppStore } from '../store/appStore.js';
import { formatPointsBalanceDisplay } from '../utils/antiFakeZero.js';
import { StatusValueText } from './StatusValueText.js';

export interface SubpageShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly headerActions?: React.ReactNode;
  readonly sidebar?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly testId?: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function SubpageShell({
  title,
  subtitle,
  onBack,
  backLabel = '返回大厅',
  headerActions,
  sidebar,
  footer,
  testId,
  className = '',
  children,
}: SubpageShellProps): React.JSX.Element {
  const {
    authMode,
    rewardPointsBalance,
    dataLoading,
    setActiveTab,
    setViewingPrepRoom,
    openRedemption,
    openSettings,
  } = useAppStore();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    setViewingPrepRoom(false);
    setActiveTab('lobby');
  };

  return (
    <div className={`sf-subpage-shell ${className}`.trim()} data-testid={testId}>
      <header className="sf-subpage-header">
        <div className="sf-subpage-header-left">
          <button
            type="button"
            className="sf-back-btn"
            onClick={handleBack}
            data-testid="subpage-back-btn"
          >
            <span aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </button>
          <div className="sf-subpage-title-group">
            <h1 className="sf-subpage-title">{title}</h1>
            {subtitle ? <span className="sf-subpage-subtitle">{subtitle}</span> : null}
          </div>
        </div>

        <div className="sf-subpage-header-right">
          {headerActions}
          {authMode === 'authenticated' ? (
            <button
              type="button"
              className="sf-points-pill"
              onClick={() => openRedemption('lobby')}
              title="查看积分商城"
            >
              <span className="sf-points-dot" aria-hidden="true" />
              <StatusValueText
                value={formatPointsBalanceDisplay(rewardPointsBalance, { loading: dataLoading })}
              />
              <span>积分</span>
            </button>
          ) : null}
          <button
            type="button"
            className="sf-icon-gear-btn"
            onClick={() => openSettings('display')}
            aria-label="打开设置"
            data-testid="open-settings-btn"
          >
            <GameUiIcon name="gear" size={16} />
          </button>
        </div>
      </header>

      <div className={`sf-subpage-body ${sidebar ? 'sf-subpage-body--with-sidebar' : ''}`}>
        {sidebar ? <aside className="sf-subpage-sidebar">{sidebar}</aside> : null}
        <main className="sf-subpage-content">{children}</main>
      </div>

      {footer ? <footer className="sf-subpage-footer">{footer}</footer> : null}
    </div>
  );
}
