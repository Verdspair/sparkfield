import React from 'react';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  QUEUE_TYPE_LABELS,
} from '../utils/antiFakeZero.js';

export function TopRoomBar(): React.JSX.Element | null {
  const {
    authMode,
    inActiveMatch,
    activeTab,
    viewingPrepRoom,
    redemptionOpen,
    lobbyState,
    setActiveTab,
    setViewingPrepRoom,
    leavePrepRoom,
  } = useAppStore();

  const room = lobbyState.prepRoom;
  const currentlyOnPrepView =
    !redemptionOpen && activeTab === 'lobby' && viewingPrepRoom;

  if (
    authMode === 'booting' ||
    authMode === 'unauthenticated' ||
    inActiveMatch ||
    !room ||
    currentlyOnPrepView
  ) {
    return null;
  }

  const activeSubject =
    room.queueType === 'ranked'
      ? room.sharedSubject
      : (lobbyState.selfPrefs?.subject ?? room.sharedSubject);

  const statusText =
    room.status === 'queuing'
      ? '匹配中'
      : room.status === 'accept_check'
        ? '待确认'
        : `${room.members.length}/8`;

  const handleReturnToRoom = () => {
    setActiveTab('lobby');
    setViewingPrepRoom(true);
  };

  return (
    <header
      className="ui-frosted-panel blc-top-room-bar"
      style={{
        border: '1px solid rgba(240, 220, 170, 0.24)',
        background: 'rgba(12, 16, 24, 0.8)',
      }}
      data-testid="top-room-bar"
      role="status"
    >
      <div className="blc-top-room-bar__info">
        <span className="blc-chip blc-chip--gold">
          {DURATION_MODE_SHORT_LABELS[room.durationMode]}
        </span>
        <span className="blc-chip">{QUEUE_TYPE_LABELS[room.queueType]}</span>
        <span className="blc-chip">{activeSubject === 'english' ? '英语' : '数学'}</span>
        {room.queueType !== 'solo' ? (
          <span className="blc-top-room-bar__code">{room.roomCode}</span>
        ) : null}
        <span
          className={`blc-top-room-bar__status ${
            room.status === 'queuing' ? 'blc-top-room-bar__status--pulse' : ''
          }`.trim()}
        >
          ● {statusText}
        </span>
      </div>

      <div className="blc-top-room-bar__actions">
        <button
          type="button"
          className="blc-btn blc-btn--primary blc-btn--xs"
          onClick={handleReturnToRoom}
          data-testid="top-bar-return-prep-btn"
        >
          返回房间
        </button>
        <button
          type="button"
          className="blc-btn blc-btn--ghost blc-btn--xs"
          onClick={() => void leavePrepRoom()}
          data-testid="top-bar-leave-room-btn"
        >
          退出
        </button>
      </div>
    </header>
  );
}
