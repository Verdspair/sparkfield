import React, { useEffect, useMemo, useState } from 'react';
import {
  MODE_BUDGETS,
  computeEstimatedEndTimeHHMM,
  type CoursePackManifest,
  type DurationMode,
  type QueueType,
  type SubjectId,
} from '@pkg/contracts';
import { httpClient } from '../api/httpClient.js';
import { TacticianPortrait } from '../components/UnitPortrait.js';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import { TACTICIAN_CATALOG } from '../stage/index.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  QUEUE_TYPE_LABELS,
} from '../utils/antiFakeZero.js';
import './lobbyPrep.css';

const SHORT_SUBJECT_LABELS: Readonly<Record<SubjectId, string>> = {
  english: '英语',
  math: '数学',
};

const TOTAL_SEATS = 8;

export function PrepRoomPage(): React.JSX.Element | null {
  const {
    authMode,
    profile,
    preferredTacticianId,
    lobbyState,
    setActiveTab,
    setViewingPrepRoom,
    openSettings,
    updateRoomSettings,
    updateSelfRoomPrefs,
    startMatchOrQueue,
    cancelMatchQueue,
    leavePrepRoom,
    pushToast,
  } = useAppStore();

  const room = lobbyState.prepRoom;
  const selfPrefs = lobbyState.selfPrefs;
  const [packs, setPacks] = useState<CoursePackManifest[]>(() =>
    STARTER_COURSE_PACKS.map((p) => p.manifest),
  );
  const [clockNow, setClockNow] = useState<Date>(() => new Date());
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (authMode === 'authenticated') {
      void httpClient
        .getCoursePacks()
        .then((rows) => {
          if (rows.length > 0) setPacks(rows.map((r) => r.manifest));
        })
        .catch(() => undefined);
    }
  }, [authMode]);

  const activeSubject: SubjectId = useMemo(() => {
    if (!room) return 'english';
    if (room.queueType === 'ranked') return room.sharedSubject;
    return selfPrefs?.subject ?? room.sharedSubject;
  }, [room, selfPrefs?.subject]);

  const subjectManifest = useMemo(
    () =>
      packs.find((p) => p.subject === activeSubject) ??
      STARTER_COURSE_PACKS.find((p) => p.manifest.subject === activeSubject)!.manifest,
    [activeSubject, packs],
  );

  const activeTacticianEntry = useMemo(
    () =>
      TACTICIAN_CATALOG.find((t) => t.id === preferredTacticianId) ?? TACTICIAN_CATALOG[0]!,
    [preferredTacticianId],
  );

  if (!room) return null;

  const isOffline = authMode === 'offline_practice';
  const isSoloView = room.queueType === 'solo' || isOffline;
  const isHost = room.hostUserId === profile?.userId;
  const isIdle = room.status === 'idle';
  const selfMember = room.members.find((m) => m.userId === profile?.userId);
  const allNonHostReady = room.members.every((m) => m.isHost || m.ready);

  const estimatedEndHHMM = computeEstimatedEndTimeHHMM(clockNow, room.plannedTotalSeconds);
  const modeSpec = MODE_BUDGETS.modes[room.durationMode];
  const plannedMinutes = Math.round(room.plannedTotalSeconds / 60);

  const selectedStartNodeId =
    selfPrefs?.learningStartSelections?.[activeSubject] ??
    profile?.learningStartSelections?.[activeSubject] ??
    subjectManifest.knowledgeGraph[0]!.nodeId;

  const selectedNodeIndex = Math.max(
    0,
    subjectManifest.knowledgeGraph.findIndex((n) => n.nodeId === selectedStartNodeId),
  );
  const selectedNode =
    subjectManifest.knowledgeGraph[selectedNodeIndex] ?? subjectManifest.knowledgeGraph[0]!;
  const resolvedNodeTitle =
    selectedNode.nodeId === 'ENG_N1_VOCAB_DIALOGUE'
      ? '情景交际与日常沟通'
      : selectedNode.title;

  const emptySeatCount = Math.max(0, TOTAL_SEATS - room.members.length);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      pushToast(`已复制房间码 ${room.roomCode}`, 'success');
    } catch {
      pushToast(`房间码 ${room.roomCode}`, 'info');
    }
  };

  const handleChangeQueueType = async (qt: QueueType) => {
    if (!isHost || !isIdle || busy) return;
    setBusy(true);
    try {
      await updateRoomSettings({ queueType: qt });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '切换模式失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeDurationMode = async (dm: DurationMode) => {
    if (!isHost || !isIdle || busy) return;
    setBusy(true);
    try {
      await updateRoomSettings({ durationMode: dm });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '切换时长失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeSubject = async (subj: SubjectId) => {
    if (!isIdle || busy) return;
    if (room.queueType === 'ranked') {
      if (!isHost) return;
      setBusy(true);
      try {
        await updateRoomSettings({ sharedSubject: subj });
      } catch (err) {
        pushToast(err instanceof Error ? err.message : '切换学科失败', 'error');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await updateSelfRoomPrefs({ subject: subj });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '切换学科失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isHost) {
        if (room.status === 'queuing') {
          await cancelMatchQueue();
        } else {
          await startMatchOrQueue();
        }
      } else if (selfMember) {
        await updateSelfRoomPrefs({ ready: !selfMember.ready });
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '操作未完成', 'error');
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = isHost
    ? room.status === 'queuing'
      ? '取消排队'
      : room.queueType === 'solo'
        ? '开始对局'
        : !allNonHostReady
          ? '等待准备'
          : '开始匹配'
    : selfMember?.ready
      ? '取消准备'
      : '准备';

  return (
    <div className="sf-prep-viewport" data-testid="prep-room-page">
      <div className="sf-lobby-vignette-bottom" aria-hidden="true" />

      <header className="sf-prep-topbar">
        <div className="sf-prep-topbar__left">
          <button
            type="button"
            className="sf-ghost-pill-btn"
            onClick={() => setViewingPrepRoom(false)}
            data-testid="prep-back-to-lobby-view-btn"
          >
            <span aria-hidden="true">←</span>
            <span>返回大厅</span>
          </button>

          <div className="sf-prep-mode-title">
            <strong>
              {DURATION_MODE_SHORT_LABELS[room.durationMode]} · {plannedMinutes} 分钟
            </strong>
            <span>
              {QUEUE_TYPE_LABELS[room.queueType]} · {modeSpec.learning.length} 节学习 ·{' '}
              {modeSpec.rounds} 场战斗
            </span>
          </div>

          <button
            type="button"
            className="sf-ghost-pill-btn"
            onClick={() => void leavePrepRoom()}
            data-testid="prep-leave-room-btn"
          >
            离开房间
          </button>
        </div>

        <div className="sf-prep-topbar__right">
          <button
            type="button"
            className="sf-gear-btn"
            onClick={() => openSettings('display')}
            aria-label="打开设置"
            title="系统与舞台设置"
            data-testid="open-settings-btn"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 1 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14.08 20.83V21A2 2 0 1 1 10.08 21V20.91A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.18 19.73L7.12 19.79A2 2 0 1 1 4.29 16.96L4.35 16.9A1.65 1.65 0 0 0 4.68 15.08A1.65 1.65 0 0 0 3.17 14.08H3A2 2 0 1 1 3 10.08H3.09A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L4.21 7.12A2 2 0 1 1 7.04 4.29L7.1 4.35A1.65 1.65 0 0 0 8.92 4.68H9A1.65 1.65 0 0 0 10 3.17V3A2 2 0 1 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 1 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.83 10H21A2 2 0 1 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="sf-prep-middle">
        <div className="sf-prep-left-wing">
          <div className="sf-prep-host-plate">
            <TacticianPortrait
              tacticianId={preferredTacticianId}
              size="sm"
              alt={activeTacticianEntry.name}
            />
            <div className="sf-prep-host-meta">
              <span className="sf-prep-host-name">{profile?.nickname ?? '星港领航员'}</span>
              <span className="sf-prep-host-sub">{activeTacticianEntry.name}</span>
            </div>
            <div className="sf-prep-host-actions">
              <button
                type="button"
                className="sf-prep-mini-link"
                onClick={() => openSettings('display')}
                data-testid="prep-switch-tactician-btn"
              >
                切换领航员
              </button>
              <button
                type="button"
                className="sf-prep-mini-link"
                onClick={() => {
                  setViewingPrepRoom(false);
                  setActiveTab('encyclopedia');
                }}
                data-testid="prep-open-collection-btn"
              >
                藏品
              </button>
            </div>
          </div>
        </div>

        <section
          className="sf-prep-roster-panel ui-corner-ornaments"
          aria-label="8 席星环席位"
          data-testid="prep-left-roster"
        >
          <div className="sf-prep-roster-head">
            <div className="sf-prep-roster-title">
              <span>星港备战席</span>
              <span>({room.members.length} / {TOTAL_SEATS})</span>
            </div>

            {!isSoloView ? (
              <div className="sf-prep-room-code" data-testid="prep-room-code-box">
                <span className="sf-prep-room-code__label">房间码</span>
                <strong className="sf-prep-room-code__val">{room.roomCode}</strong>
                <button
                  type="button"
                  className="sf-ghost-pill-btn"
                  style={{ minHeight: 28, padding: '0 11px', fontSize: 12 }}
                  onClick={() => void handleCopyCode()}
                  data-testid="copy-room-code-btn"
                >
                  复制
                </button>
              </div>
            ) : (
              <div className="sf-prep-solo-note" data-testid="solo-invite-hidden-note">
                单人模式 · AI 补齐席位
              </div>
            )}
          </div>

          <div className="sf-seat-grid">
            {room.members.map((member, idx) => {
              const isSelf = member.userId === profile?.userId;
              const isReady = member.isHost || member.ready;
              return (
                <div
                  key={member.userId}
                  className="sf-seat-card"
                  style={{ animationDelay: `${idx * 35}ms` }}
                  data-testid={`prep-seat-member-${idx}`}
                >
                  <div
                    className={`sf-seat-ring ${isReady ? 'sf-seat-ring--ready' : ''} ${
                      isSelf ? 'sf-seat-ring--self' : ''
                    }`.trim()}
                  >
                    <TacticianPortrait
                      tacticianId={member.tacticianId}
                      size="sm"
                      alt={member.nickname}
                      className="sf-seat-portrait"
                    />
                    {member.isHost ? <span className="sf-seat-crown">房主</span> : null}
                    <span
                      className={`sf-seat-status-dot ${
                        isReady ? 'sf-seat-status-dot--ok' : ''
                      }`.trim()}
                      title={member.isHost ? '房主已就绪' : member.ready ? '已就绪' : '未准备'}
                    >
                      {isReady ? '✓' : '·'}
                    </span>
                  </div>
                  <span className="sf-seat-name">{member.nickname}</span>
                  <span className={`sf-seat-sub ${isReady ? 'sf-seat-sub--ok' : ''}`.trim()}>
                    {member.isHost ? '房主' : member.ready ? '已就绪' : '待准备'}
                  </span>
                </div>
              );
            })}

            {Array.from({ length: emptySeatCount }, (_, emptyIdx) => {
              const slotNum = room.members.length + emptyIdx;
              if (isSoloView) {
                return (
                  <div
                    key={`ai-${slotNum}`}
                    className="sf-seat-card"
                    style={{ animationDelay: `${slotNum * 35}ms` }}
                  >
                    <div className="sf-seat-ai-ghost">AI</div>
                    <span className="sf-seat-name" style={{ color: 'var(--text-muted)' }}>
                      AI 席位
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={`invite-${slotNum}`}
                  className="sf-seat-card"
                  style={{ animationDelay: `${slotNum * 35}ms` }}
                >
                  <button
                    type="button"
                    className="sf-seat-invite-btn"
                    onClick={() => void handleCopyCode()}
                    title="复制房间码"
                    aria-label="邀请好友加入空席"
                    data-testid={`prep-invite-slot-${slotNum}`}
                  >
                    +
                  </button>
                  <span className="sf-seat-name" style={{ color: 'var(--text-secondary)' }}>
                    邀请好友
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer
        className="sf-prep-bottom-dock"
        aria-label="备战控制栏"
        data-testid="prep-right-controls"
      >
        <div className="sf-prep-controls-row">
          <div className="sf-prep-control-cluster">
            <span className="sf-prep-cluster-label">时长</span>
            <div className="sf-seg-group">
              {(['quick', 'standard', 'deep'] as const).map((dm) => (
                <button
                  key={dm}
                  type="button"
                  disabled={!isHost || !isIdle || busy}
                  className={`sf-seg-btn ${
                    room.durationMode === dm ? 'sf-seg-btn--active' : ''
                  }`.trim()}
                  onClick={() => void handleChangeDurationMode(dm)}
                  data-testid={`prep-duration-${dm}`}
                >
                  {dm === 'quick' ? '15分' : dm === 'standard' ? '30分' : '60分'}
                </button>
              ))}
            </div>
          </div>

          <div className="sf-prep-control-cluster">
            <span className="sf-prep-cluster-label">队列</span>
            <div className="sf-seg-group">
              {(['ranked', 'casual', 'solo'] as const).map((qt) => {
                const disabledByParty = qt === 'solo' && room.members.length > 1;
                const disabledByOffline = isOffline && qt !== 'solo';
                return (
                  <button
                    key={qt}
                    type="button"
                    disabled={!isHost || !isIdle || busy || disabledByParty || disabledByOffline}
                    className={`sf-seg-btn ${
                      room.queueType === qt ? 'sf-seg-btn--active' : ''
                    }`.trim()}
                    onClick={() => void handleChangeQueueType(qt)}
                    data-testid={`prep-queue-${qt}`}
                  >
                    {QUEUE_TYPE_LABELS[qt]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sf-prep-control-cluster">
            <span className="sf-prep-cluster-label">学科</span>
            <div className="sf-seg-group">
              {(['english', 'math'] as const).map((subj) => {
                const locked = !isIdle || busy || (room.queueType === 'ranked' && !isHost);
                return (
                  <button
                    key={subj}
                    type="button"
                    disabled={locked}
                    className={`sf-seg-btn ${
                      activeSubject === subj ? 'sf-seg-btn--active' : ''
                    }`.trim()}
                    onClick={() => void handleChangeSubject(subj)}
                    data-testid={`prep-shared-subject-${subj}`}
                  >
                    {SHORT_SUBJECT_LABELS[subj]}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="sf-prep-chapter-chip"
            onClick={() => openSettings('learning')}
            title="前往设置调整起始章节"
            data-testid="prep-chapter-summary-btn"
          >
            <span style={{ color: 'var(--accent-gold)' }}>起点</span>
            <span className="sf-prep-chapter-chip__text">
              第 {selectedNodeIndex + 1} 节 · {resolvedNodeTitle}
            </span>
            <span style={{ color: 'var(--accent-azure-bright)' }} aria-hidden="true">
              ✎
            </span>
          </button>
        </div>

        <div className="sf-prep-action-cluster">
          <div className="sf-prep-eta" data-testid="estimated-end-time-box">
            <strong>预计 {estimatedEndHHMM} 结束</strong>
            <span>
              {modeSpec.learning.length} 节学习 · {modeSpec.rounds} 场战斗
            </span>
          </div>

          <button
            type="button"
            className={`sf-gold-btn sf-prep-primary-btn ${
              room.status === 'queuing' ? 'sf-prep-primary-btn--cancel' : ''
            }`.trim()}
            disabled={busy || (isHost && isIdle && !allNonHostReady)}
            onClick={() => void handlePrimaryAction()}
            data-testid="prep-primary-action-btn"
          >
            {primaryLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
