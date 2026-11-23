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
    audioBus,
    setActiveTab,
    setViewingPrepRoom,
    closeRedemption,
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
    if (redemptionOpen) {
      closeRedemption();
    }
    setActiveTab('lobby');
    setViewingPrepRoom(true);
  };

  return (
    <header
      className="blc-top-room-bar"
      data-testid="top-room-bar"
      aria-label="房间状态"
    >
      <div className="blc-top-room-bar__info" role="status">
        <span
          className={`blc-top-room-bar__dot ${
            room.status === 'queuing' || room.status === 'accept_check'
              ? 'blc-top-room-bar__status--active'
              : ''
          }`.trim()}
          aria-hidden="true"
        />
        <span className="blc-top-room-bar__lead">正在房间</span>
        <span className="blc-chip blc-chip--gold">
          {DURATION_MODE_SHORT_LABELS[room.durationMode]} · {QUEUE_TYPE_LABELS[room.queueType]}
        </span>
        <span className="blc-top-room-bar__meta">
          {activeSubject === 'english' ? '英语' : '数学'}
        </span>
        {room.queueType !== 'solo' ? (
          <span className="blc-top-room-bar__code">{room.roomCode}</span>
        ) : null}
        <span
          className={`blc-top-room-bar__status ${
            room.status === 'queuing' ? 'blc-top-room-bar__status--active' : ''
          }`.trim()}
        >
          {statusText}
        </span>
      </div>

      <div className="blc-top-room-bar__actions">
        <button
          type="button"
          className="blc-btn blc-btn--primary blc-btn--xs"
          onClick={handleReturnToRoom}
          data-testid="top-bar-return-prep-btn"
        >
          返回备战房
        </button>
        <button
          type="button"
          className="blc-btn blc-btn--ghost blc-btn--xs"
          onClick={() => {
            audioBus.emit('onUiFeedback', { kind: 'click' });
            void leavePrepRoom();
          }}
          data-testid="top-bar-leave-room-btn"
        >
          退出
        </button>
      </div>
    </header>
  );
}
