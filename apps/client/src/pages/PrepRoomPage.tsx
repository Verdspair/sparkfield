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
import { ArenaThemeSwitcher } from '../components/PersistentStageCanvas.js';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  QUEUE_TYPE_LABELS,
} from '../utils/antiFakeZero.js';

const SHORT_SUBJECT_LABELS: Readonly<Record<SubjectId, string>> = {
  english: '英语',
  math: '数学',
};

export function PrepRoomPage(): React.JSX.Element | null {
  const {
    authMode,
    profile,
    lobbyState,
    setViewingPrepRoom,
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

  if (!room) return null;

  const isOffline = authMode === 'offline_practice';
  const isHost = room.hostUserId === profile?.userId;
  const isIdle = room.status === 'idle';
  const selfMember = room.members.find((m) => m.userId === profile?.userId);
  const allNonHostReady = room.members.every((m) => m.isHost || m.ready);

  const estimatedEndHHMM = computeEstimatedEndTimeHHMM(clockNow, room.plannedTotalSeconds);
  const modeSpec = MODE_BUDGETS.modes[room.durationMode];
  const plannedMinutes = Math.round(room.plannedTotalSeconds / 60);

  const selectedStartNode =
    selfPrefs?.learningStartSelections?.[activeSubject] ??
    profile?.learningStartSelections?.[activeSubject] ??
    subjectManifest.knowledgeGraph[0]!.nodeId;

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

  const handleChangeSharedSubject = async (subj: SubjectId) => {
    if (!isHost || !isIdle || busy) return;
    setBusy(true);
    try {
      await updateRoomSettings({ sharedSubject: subj });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '切换学科失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePersonalSubject = async (subj: SubjectId) => {
    if (!isIdle || room.queueType === 'ranked' || busy) return;
    setBusy(true);
    try {
      await updateSelfRoomPrefs({ subject: subj });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '切换学科失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeStartNode = async (nodeId: string) => {
    if (!isIdle || busy) return;
    setBusy(true);
    try {
      const nextMap = {
        ...(profile?.learningStartSelections ?? {}),
        ...(selfPrefs?.learningStartSelections ?? {}),
        [activeSubject]: nodeId,
      };
      await updateSelfRoomPrefs({ learningStartSelections: nextMap });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '更新章节失败', 'error');
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

  return (
    <div className="blc-page-shell blc-prep-shell" data-testid="prep-room-page">
      <header
        className="ui-frosted-panel blc-prep-header"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.22)',
          background: 'rgba(13, 17, 26, 0.78)',
        }}
      >
        <div className="blc-prep-header__left">
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--sm"
            onClick={() => setViewingPrepRoom(false)}
            data-testid="prep-back-to-lobby-view-btn"
          >
            ← 大厅
          </button>
          <strong style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>
            {DURATION_MODE_SHORT_LABELS[room.durationMode]} · {plannedMinutes} 分钟
          </strong>
        </div>

        <div className="blc-prep-header__right">
          <ArenaThemeSwitcher compact />
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--sm"
            onClick={() => void leavePrepRoom()}
            data-testid="prep-leave-room-btn"
          >
            退出房间
          </button>
        </div>
      </header>

      <div className="blc-prep-grid">
        <section
          className="ui-frosted-panel blc-prep-col"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          aria-label="席位"
          data-testid="prep-left-roster"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>席位 ({room.members.length}/8)</h3>
          </div>

          {room.queueType !== 'solo' && !isOffline ? (
            <div
              className="ui-frosted-panel blc-room-code-box"
              style={{
                padding: '8px 12px',
                border: '1px solid rgba(240, 220, 170, 0.2)',
                background: 'rgba(11, 14, 21, 0.56)',
              }}
              data-testid="prep-room-code-box"
            >
              <strong className="blc-room-code-text" style={{ fontSize: 16 }}>
                {room.roomCode}
              </strong>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--xs"
                onClick={() => void handleCopyCode()}
                data-testid="copy-room-code-btn"
              >
                复制
              </button>
            </div>
          ) : (
            <div className="blc-subtle-banner" data-testid="solo-invite-hidden-note">
              单人模式 · 其余席位由 AI 补齐
            </div>
          )}

          <ul className="blc-member-list">
            {room.members.map((m, idx) => (
              <li
                key={m.userId}
                className={`blc-member-row ${
                  m.userId === profile?.userId ? 'blc-member-row--self' : ''
                }`.trim()}
              >
                <div className="blc-member-avatar" style={{ width: 30, height: 30, fontSize: 13 }}>
                  {idx + 1}
                </div>
                <div className="blc-member-meta">
                  <div className="blc-member-name">
                    <strong>{m.nickname}</strong>
                    {m.isHost ? <span className="blc-tag-mini blc-tag-mini--gold">房主</span> : null}
                  </div>
                </div>
                <span
                  className={`blc-ready-pill ${
                    m.isHost || m.ready ? 'blc-ready-pill--ok' : ''
                  }`.trim()}
                >
                  {m.isHost ? '房主' : m.ready ? '已准备' : '未准备'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="ui-frosted-panel blc-prep-col"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          aria-label="起始章节"
          data-testid="prep-center-self-learning"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>起始章节</h3>
            <div className="blc-seg-tabs">
              {(['english', 'math'] as const).map((subj) => {
                const selected = activeSubject === subj;
                const locked = room.queueType === 'ranked' || !isIdle;
                return (
                  <button
                    key={subj}
                    type="button"
                    disabled={locked}
                    className={`blc-seg-tab ${selected ? 'blc-seg-tab--active' : ''}`.trim()}
                    style={{ minHeight: 30, padding: '3px 10px' }}
                    onClick={() => void handleChangePersonalSubject(subj)}
                    data-testid={`self-subject-${subj}`}
                  >
                    {SHORT_SUBJECT_LABELS[subj]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="blc-form-group">
            <select
              id="prep-start-node-select"
              aria-label="起始章节"
              className="blc-select"
              disabled={!isIdle || busy}
              value={selectedStartNode}
              onChange={(e) => void handleChangeStartNode(e.target.value)}
              data-testid="prep-start-node-select"
            >
              {subjectManifest.knowledgeGraph.map((node, idx) => (
                <option key={node.nodeId} value={node.nodeId}>
                  {idx + 1}. {node.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            <span className="blc-field__label">节奏</span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                padding: '12px',
                borderRadius: 6,
                background: 'rgba(11, 14, 21, 0.52)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {modeSpec.learning_detail.map((nd, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }} aria-hidden="true">
                      ›
                    </span>
                  ) : null}
                  <span
                    className="blc-chip"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontVariantNumeric: 'tabular-nums',
                      borderColor: 'rgba(240, 220, 170, 0.26)',
                      color: 'var(--text-primary)',
                      background: 'rgba(200, 170, 110, 0.1)',
                    }}
                  >
                    N{idx + 1} {modeSpec.learning[idx]}s → R{nd.battle_rounds_after.join('/')}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section
          className="ui-frosted-panel blc-prep-col blc-prep-col--right"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          aria-label="对局设置"
          data-testid="prep-right-controls"
        >
          <div className="blc-form-group">
            <div className="blc-field__label">时长</div>
            <div className="blc-seg-tabs">
              {(['quick', 'standard', 'deep'] as const).map((dm) => (
                <button
                  key={dm}
                  type="button"
                  disabled={!isHost || !isIdle || busy}
                  className={`blc-seg-tab ${
                    room.durationMode === dm ? 'blc-seg-tab--active' : ''
                  }`.trim()}
                  onClick={() => void handleChangeDurationMode(dm)}
                  data-testid={`prep-duration-${dm}`}
                >
                  {dm === 'quick' ? '15 分钟' : dm === 'standard' ? '30 分钟' : '60 分钟'}
                </button>
              ))}
            </div>
          </div>

          <div className="blc-form-group">
            <div className="blc-field__label">模式</div>
            <div className="blc-seg-tabs">
              {(['ranked', 'casual', 'solo'] as const).map((qt) => {
                const disabledByParty = qt === 'solo' && room.members.length > 1;
                const disabledByOffline = isOffline && qt !== 'solo';
                return (
                  <button
                    key={qt}
                    type="button"
                    disabled={!isHost || !isIdle || busy || disabledByParty || disabledByOffline}
                    className={`blc-seg-tab ${
                      room.queueType === qt ? 'blc-seg-tab--active' : ''
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

          {room.queueType === 'ranked' ? (
            <div className="blc-form-group">
              <div className="blc-field__label">学科</div>
              <div className="blc-seg-tabs">
                {(['english', 'math'] as const).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    disabled={!isHost || !isIdle || busy}
                    className={`blc-seg-tab ${
                      room.sharedSubject === subj ? 'blc-seg-tab--active' : ''
                    }`.trim()}
                    onClick={() => void handleChangeSharedSubject(subj)}
                    data-testid={`prep-shared-subject-${subj}`}
                  >
                    {SHORT_SUBJECT_LABELS[subj]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ flex: 1 }} />

          <div
            className="ui-frosted-panel blc-est-end-box"
            style={{
              padding: '10px 14px',
              border: '1px solid rgba(240, 220, 170, 0.18)',
              background: 'rgba(11, 14, 21, 0.5)',
            }}
            data-testid="estimated-end-time-box"
          >
            <strong
              className="blc-est-end-time"
              style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              预计 {estimatedEndHHMM} 结束
            </strong>
          </div>

          <button
            type="button"
            className={`blc-btn blc-btn--block blc-btn--lg ${
              room.status === 'queuing' ? 'blc-btn--ghost' : 'blc-btn--primary'
            }`.trim()}
            disabled={busy || (isHost && isIdle && !allNonHostReady)}
            onClick={() => void handlePrimaryAction()}
            data-testid="prep-primary-action-btn"
          >
            {isHost
              ? room.status === 'queuing'
                ? '取消匹配'
                : room.queueType === 'solo'
                  ? '开始对局'
                  : !allNonHostReady
                    ? '等待准备'
                    : '开始匹配'
              : selfMember?.ready
                ? '取消准备'
                : '准备'}
          </button>
        </section>
      </div>
    </div>
  );
}
