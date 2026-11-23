import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CoursePackManifest,
  LessonStepKind,
  SubjectId,
} from '@pkg/contracts';
import {
  QuestionStepCard,
  type LessonStepProgressItem,
  type QuestionAnswerSubmission,
  type QuestionFeedbackView,
} from '@pkg/learning-ui';
import {
  httpClient,
  type DirectLearningSessionView,
  type LearningDashboardResponse,
} from '../api/httpClient.js';
import { SubpageShell } from '../components/SubpageShell.js';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import {
  OfflineDirectLearningSession,
  buildOfflineLearningDashboard,
  getUnsyncedOfflineAttemptCount,
  syncPendingOfflineAttemptsToServer,
} from '../offline/offlinePracticeController.js';
import { useAppStore } from '../store/appStore.js';
import './subpages.css';

const STEP_LABELS: Readonly<Record<LessonStepKind, string>> = {
  material: '例题',
  practice: '练习',
  resource_check: '检验',
  remediation: '纠错',
  verification: '巩固',
};

const SHORT_SUBJECT: Readonly<Record<SubjectId, string>> = {
  english: '英语',
  math: '数学',
};

function resolveChapterTitle(
  packs: readonly CoursePackManifest[],
  subject: SubjectId,
  nodeId: string,
): string {
  const pack = packs.find((p) => p.subject === subject);
  const found = pack?.knowledgeGraph.find((n) => n.nodeId === nodeId);
  if (found) return found.title;
  return pack?.knowledgeGraph[0]?.title ?? '基础章节';
}

export function LearningHomePage(): React.JSX.Element {
  const {
    authMode,
    profile,
    lobbyState,
    audioBus,
    enterModePrepRoom,
    updateRoomSettings,
    updateSelfRoomPrefs,
    patchUserProfile,
    refreshMeAndLobby,
    setActiveTab,
    setViewingPrepRoom,
    setExternalLearningOverlay,
    pushToast,
  } = useAppStore();

  const isOffline = authMode === 'offline_practice';

  const [dashboard, setDashboard] = useState<LearningDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [focusSubject, setFocusSubject] = useState<SubjectId>('english');
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

  const [directSession, setDirectSession] = useState<DirectLearningSessionView | null>(null);
  const [questionCursor, setQuestionCursor] = useState<number>(0);
  const [latestFeedback, setLatestFeedback] = useState<QuestionFeedbackView | null>(null);
  const [startingDirect, setStartingDirect] = useState<boolean>(false);
  const [directActionBusy, setDirectActionBusy] = useState<boolean>(false);
  const directEpochRef = useRef(0);
  const directInFlightRef = useRef(false);
  const offlineSessionRef = useRef<OfflineDirectLearningSession | null>(null);

  useEffect(() => () => {
    directEpochRef.current += 1;
  }, [authMode, profile?.userId, profile?.sessionEpoch]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (isOffline) {
        const localDash = await buildOfflineLearningDashboard();
        setDashboard(localDash);
        if (localDash.nextRecommendation) {
          setFocusSubject(localDash.nextRecommendation.subject);
        }
      } else {
        const [dash, pendingCnt] = await Promise.all([
          httpClient.getLearningDashboard(),
          getUnsyncedOfflineAttemptCount(profile?.userId ?? ''),
        ]);
        setDashboard(dash);
        setUnsyncedCount(pendingCnt);
        if (dash.nextRecommendation) {
          setFocusSubject(dash.nextRecommendation.subject);
        }
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '读取学习记录失败', 'warning');
      const fallback = await buildOfflineLearningDashboard(isOffline ? undefined : profile?.userId);
      setDashboard(fallback);
    } finally {
      setLoading(false);
    }
  }, [isOffline, profile?.userId, pushToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setExternalLearningOverlay('standalone-direct-learning', Boolean(directSession));
    return () => setExternalLearningOverlay('standalone-direct-learning', false);
  }, [directSession, setExternalLearningOverlay]);

  const packs: CoursePackManifest[] = useMemo(() => {
    if (dashboard && dashboard.coursePacks.length > 0) {
      return dashboard.coursePacks.map((c) => c.manifest);
    }
    return STARTER_COURSE_PACKS.map((p) => p.manifest);
  }, [dashboard]);

  const focusPack = useMemo(
    () => packs.find((p) => p.subject === focusSubject) ?? packs[0] ?? null,
    [focusSubject, packs],
  );

  const activeChapterInfo = useMemo(() => {
    if (!focusPack) {
      return { title: '基础章节', index: 0, total: 1 };
    }
    const rec = dashboard?.nextRecommendation;
    const targetNodeId =
      rec && rec.subject === focusSubject
        ? rec.knowledgeNode
        : (profile?.learningStartSelections?.[focusSubject] ??
          focusPack.knowledgeGraph[0]?.nodeId ??
          '');
    const idx = Math.max(
      0,
      focusPack.knowledgeGraph.findIndex((n) => n.nodeId === targetNodeId),
    );
    return {
      title: resolveChapterTitle(packs, focusSubject, targetNodeId),
      index: idx,
      total: Math.max(1, focusPack.knowledgeGraph.length),
    };
  }, [dashboard?.nextRecommendation, focusPack, focusSubject, packs, profile?.learningStartSelections]);

  const handleStartStandalone = async (subjectOverride?: SubjectId) => {
    if (directInFlightRef.current) return;
    audioBus.emit('onUiFeedback', { kind: 'open' });
    const epoch = ++directEpochRef.current;
    directInFlightRef.current = true;
    const subj = subjectOverride ?? focusSubject;
    setStartingDirect(true);
    try {
      setLatestFeedback(null);
      setQuestionCursor(0);
      if (isOffline) {
        const local = await OfflineDirectLearningSession.create({
          mode: 'standard',
          subject: subj,
          learningStartSelections: profile?.learningStartSelections,
        });
        if (epoch !== directEpochRef.current) return;
        offlineSessionRef.current = local;
        setDirectSession(local.toView());
      } else {
        const session = await httpClient.startStandaloneLearning({
          mode: 'standard',
          nodeIndex: 0,
          selectedSubjects: [subj],
        });
        if (epoch !== directEpochRef.current) return;
        offlineSessionRef.current = null;
        setDirectSession(session);
      }
    } catch (err) {
      if (epoch === directEpochRef.current) {
        pushToast(err instanceof Error ? err.message : '启动练习失败', 'error');
      }
    } finally {
      if (epoch === directEpochRef.current) {
        directInFlightRef.current = false;
        setStartingDirect(false);
      }
    }
  };

  const handleBringIntoGame = async (subjectOverride?: SubjectId, startNodeId?: string) => {
    audioBus.emit('onUiFeedback', { kind: 'click' });
    const subj = subjectOverride ?? focusSubject;
    try {
      if (startNodeId) {
        const nextStarts = {
          ...(profile?.learningStartSelections ?? {}),
          [subj]: startNodeId,
        };
        await patchUserProfile({ learningStartSelections: nextStarts });
      }

      const room = lobbyState.prepRoom;
      if (!room) {
        await enterModePrepRoom('standard', subj);
        return;
      }

      const isHost = room.hostUserId === profile?.userId;
      if (room.status !== 'idle') {
        setActiveTab('lobby');
        setViewingPrepRoom(true);
        pushToast('房间正在匹配中，已返回备战房', 'info');
        return;
      }

      if (room.queueType === 'ranked') {
        if (isHost && room.sharedSubject !== subj) {
          await updateRoomSettings({ sharedSubject: subj });
        } else if (!isHost && room.sharedSubject !== subj) {
          pushToast(`排位房已锁定为${SHORT_SUBJECT[room.sharedSubject]}`, 'info');
        }
      } else {
        await updateSelfRoomPrefs({
          subject: subj,
          ...(startNodeId
            ? {
                learningStartSelections: {
                  ...(lobbyState.selfPrefs?.learningStartSelections ?? {}),
                  [subj]: startNodeId,
                },
              }
            : {}),
        });
      }

      setActiveTab('lobby');
      setViewingPrepRoom(true);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '进入备战房失败', 'error');
    }
  };

  const handleSelectStartNode = async (subj: SubjectId, nodeId: string, nodeTitle: string) => {
    audioBus.emit('onUiFeedback', { kind: 'click' });
    try {
      const next = {
        ...(profile?.learningStartSelections ?? {}),
        [subj]: nodeId,
      };
      if (lobbyState.prepRoom && lobbyState.prepRoom.status === 'idle') {
        await updateSelfRoomPrefs({ learningStartSelections: next });
      } else {
        await patchUserProfile({ learningStartSelections: next });
      }
      pushToast(`起点已设为：${nodeTitle}`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '更新起点失败', 'error');
    }
  };

  const handleSyncOffline = async () => {
    if (syncingOffline) return;
    audioBus.emit('onUiFeedback', { kind: 'click' });
    setSyncingOffline(true);
    try {
      const res = await syncPendingOfflineAttemptsToServer(profile?.userId ?? '');
      pushToast(
        res.legacyCount > 0
          ? `已同步 ${res.syncedCount} 条；${res.legacyCount} 条旧记录缺原始答案，已保留`
          : `已同步 ${res.syncedCount} 条本地记录`,
        res.legacyCount > 0 ? 'warning' : 'success',
      );
      await loadDashboard();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '同步失败', 'error');
    } finally {
      setSyncingOffline(false);
    }
  };

  const handleCloseDirect = () => {
    audioBus.emit('onUiFeedback', { kind: 'close' });
    directEpochRef.current += 1;
    directInFlightRef.current = false;
    offlineSessionRef.current = null;
    setDirectActionBusy(false);
    setDirectSession(null);
    setLatestFeedback(null);
    setQuestionCursor(0);
    void loadDashboard();
    if (!isOffline) {
      void refreshMeAndLobby().catch((err) =>
        pushToast(err instanceof Error ? err.message : '刷新学习记录失败', 'warning'),
      );
    }
  };

  const handleDirectSubmit = async (sub: QuestionAnswerSubmission) => {
    if (!directSession || directInFlightRef.current) return;
    const epoch = directEpochRef.current;
    directInFlightRef.current = true;
    setDirectActionBusy(true);
    try {
      const payload = {
        answer: sub.answer,
        status: sub.status,
        questionId: sub.questionId,
        hintUsed: sub.hintUsed,
      };
      const res = offlineSessionRef.current
        ? await offlineSessionRef.current.submit(sub.questionId, payload)
        : await httpClient.submitStandaloneAnswer({
            sessionId: directSession.sessionId,
            questionId: sub.questionId,
            submission: payload,
          });
      if (epoch !== directEpochRef.current) return;
      setLatestFeedback({
        questionId: res.feedback.questionId,
        isCorrect: res.feedback.isCorrect,
        isSkipped: res.feedback.isSkipped,
        quality: res.feedback.quality,
        explanationMd: res.feedback.explanationMd,
        stepResults: res.feedback.stepResults.map((s) => ({
          stepId: s.stepId,
          isCorrect: s.isCorrect,
        })),
      });
      if (!res.feedback.isSkipped) {
        audioBus.emit('onLearningFeedback', { correct: res.feedback.isCorrect });
      }
      setDirectSession(res.session);
    } catch (err) {
      if (epoch === directEpochRef.current) {
        pushToast(err instanceof Error ? err.message : '提交失败', 'error');
      }
    } finally {
      if (epoch === directEpochRef.current) {
        directInFlightRef.current = false;
        setDirectActionBusy(false);
      }
    }
  };

  const handleDirectNext = async () => {
    if (!directSession || directInFlightRef.current) return;
    audioBus.emit('onUiFeedback', { kind: 'click' });
    const questions = directSession.currentStep.kind === 'remediation'
      ? []
      : directSession.currentStep.questions;
    if (questions.length > 0 && questionCursor < questions.length - 1) {
      setLatestFeedback(null);
      setQuestionCursor((c) => c + 1);
      return;
    }

    if (directSession.completed) {
      const granted = directSession.result?.rewardPointsGranted ?? 0;
      handleCloseDirect();
      if (granted > 0) {
        pushToast(`已完成练习，+${granted} 积分`, 'success');
      }
      return;
    }

    const epoch = directEpochRef.current;
    directInFlightRef.current = true;
    setDirectActionBusy(true);
    try {
      const nextView = offlineSessionRef.current
        ? await offlineSessionRef.current.advance()
        : await httpClient.advanceStandaloneStep(directSession.sessionId);
      if (epoch !== directEpochRef.current) return;
      setDirectSession(nextView);
      setLatestFeedback(null);
      setQuestionCursor(0);
    } catch (err) {
      if (epoch === directEpochRef.current) {
        pushToast(err instanceof Error ? err.message : '推进步骤失败', 'error');
      }
    } finally {
      if (epoch === directEpochRef.current) {
        directInFlightRef.current = false;
        setDirectActionBusy(false);
      }
    }
  };

  if (directSession) {
    const step = directSession.currentStep;
    const questions = step.kind === 'remediation' ? [] : step.questions;
    const activeQuestion =
      questions.length > 0
        ? questions[Math.min(questionCursor, questions.length - 1)] ?? null
        : null;
    const materialMd = step.materials.map((m) => m.materialMd).join('\n\n---\n\n');
    const remediationItems = step.corrections.map((c, idx) => ({
      questionId: c.questionId,
      stemMd: `第 ${idx + 1} 题复盘`,
      explanationMd: c.explanationMd,
    }));

    const stepsProgress: LessonStepProgressItem[] = directSession.steps.map((s, idx) => ({
      kind: s.kind,
      label: STEP_LABELS[s.kind],
      status:
        directSession.completed || idx < directSession.stepIndex
          ? 'done'
          : idx === directSession.stepIndex
            ? 'active'
            : 'upcoming',
    }));

    return (
      <div className="learning-briefing-backdrop" data-testid="standalone-learning-overlay">
        <div
          className="learning-briefing-modal"
          style={{
            width: 'min(1260px, 95vw)',
            maxWidth: '95vw',
            minHeight: 'min(660px, 80vh)',
            maxHeight: '94vh',
          }}
        >
          <div className="blc-standalone-topstrip">
            <div>
              <strong>独立练习</strong>
              {questions.length > 1 ? (
                <span style={{ marginLeft: 10, fontSize: 12.5 }}>
                  {questionCursor + 1} / {questions.length}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {directSession.completed && directSession.result ? (
                <span className="blc-chip blc-chip--gold" data-testid="standalone-points-result">
                  {isOffline
                    ? '已完成'
                    : directSession.result.rewardPointsGranted > 0
                      ? `+${directSession.result.rewardPointsGranted} 积分`
                      : '已完成'}
                </span>
              ) : null}
              <button
                type="button"
                className="lui-btn lui-btn--ghost"
                style={{ minHeight: 34, padding: '4px 12px', fontSize: 13 }}
                onClick={handleCloseDirect}
                data-testid="close-standalone-learning-btn"
              >
                结束 ✕
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <QuestionStepCard
              stepKind={step.kind}
              stepsProgress={stepsProgress}
              question={activeQuestion}
              lessonMaterialMd={materialMd}
              remediationItems={remediationItems}
              feedback={latestFeedback}
              busy={directActionBusy}
              sharedRemainingSeconds={null}
              variant="overlay"
              audioBus={audioBus}
              nextStepLabel={
                questions.length > 0 && questionCursor < questions.length - 1
                  ? '下一题 →'
                  : directSession.completed
                    ? '完成 →'
                    : '下一步 →'
              }
              onSubmitAnswer={(s) => void handleDirectSubmit(s)}
              onSkipQuestion={(s) => void handleDirectSubmit(s)}
              onAdvanceStep={() => void handleDirectNext()}
            />
          </div>
        </div>
      </div>
    );
  }

  const dueCount = dashboard?.dueReviews.length ?? null;
  const wrongCount = dashboard?.wrongQuestions.length ?? null;
  const outerRatio = Math.min(1, (activeChapterInfo.index + 1) / activeChapterInfo.total);
  const innerRatio = dueCount === 0 ? 1 : dueCount !== null ? Math.max(0.25, 1 - dueCount * 0.1) : 0.4;
  const outerCirc = 2 * Math.PI * 34;
  const innerCirc = 2 * Math.PI * 24;

  return (
    <SubpageShell
      title="学习中心"
      testId="learning-home-page"
    >
      {!isOffline && unsyncedCount > 0 ? (
        <div
          className="sf-card blc-offline-sync-bar"
          style={{ padding: '10px 16px' }}
          data-testid="offline-sync-banner"
        >
          <span>本地有 {unsyncedCount} 条练习记录待同步</span>
          <button
            type="button"
            className="sf-gold-cta"
            style={{ minHeight: 32, padding: '0 14px', fontSize: 12.5 }}
            disabled={syncingOffline}
            onClick={() => void handleSyncOffline()}
            data-testid="sync-offline-attempts-btn"
          >
            {syncingOffline ? '同步中…' : '同步'}
          </button>
        </div>
      ) : null}

      <section className="sf-card sf-learning-hero" aria-label="今日学习焦点">
        <div className="sf-learning-hero__left">
          <svg className="sf-ring-gauge" viewBox="0 0 84 84" aria-hidden="true">
            <circle
              cx="42"
              cy="42"
              r="34"
              fill="none"
              stroke="rgba(240, 220, 170, 0.14)"
              strokeWidth="6"
            />
            <circle
              cx="42"
              cy="42"
              r="34"
              fill="none"
              stroke="#c8b590"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={outerCirc}
              strokeDashoffset={outerCirc * (1 - outerRatio)}
              transform="rotate(-90 42 42)"
            />
            <circle
              cx="42"
              cy="42"
              r="24"
              fill="none"
              stroke="rgba(92, 200, 214, 0.14)"
              strokeWidth="5"
            />
            <circle
              cx="42"
              cy="42"
              r="24"
              fill="none"
              stroke="#89a3b8"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={innerCirc}
              strokeDashoffset={innerCirc * (1 - innerRatio)}
              transform="rotate(-90 42 42)"
            />
            <text
              x="42"
              y="46"
              textAnchor="middle"
              fill="#f3f0e8"
              fontSize="13"
              fontWeight="700"
            >
              {activeChapterInfo.index + 1}/{activeChapterInfo.total}
            </text>
          </svg>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              今日学习焦点 · {SHORT_SUBJECT[focusSubject]}
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--gold-light)' }}>
              {loading ? (
                <span className="stat-skeleton" style={{ width: 200 }} />
              ) : (
                activeChapterInfo.title
              )}
            </h2>

            <div className="sf-learning-hero__metrics">
              <div className="sf-stat-pill">
                <span>待复习</span>
                <strong data-testid="due-reviews-count">
                  {loading ? <span className="stat-skeleton" /> : (dueCount ?? '—')}
                </strong>
              </div>

              <div className="sf-stat-pill">
                <span>待巩固</span>
                <strong>
                  {loading ? <span className="stat-skeleton" /> : (wrongCount ?? '—')}
                </strong>
              </div>

              <div className="blc-seg-tabs" role="group" aria-label="学科切换">
                {(['english', 'math'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`blc-seg-tab ${focusSubject === s ? 'blc-seg-tab--active' : ''}`}
                    onClick={() => {
                      if (focusSubject !== s) {
                        audioBus.emit('onUiFeedback', { kind: 'toggle' });
                        setFocusSubject(s);
                      }
                    }}
                    data-testid={`learning-focus-${s}`}
                  >
                    {SHORT_SUBJECT[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sf-secondary-cta"
            disabled={startingDirect}
            onClick={() => void handleStartStandalone()}
            data-testid="direct-standalone-study-btn"
          >
            {startingDirect ? '准备中…' : '独立练习'}
          </button>

          <button
            type="button"
            className="sf-gold-cta"
            onClick={() => void handleBringIntoGame()}
            data-testid="bring-into-game-study-btn"
          >
            带入对局
          </button>
        </div>
      </section>

      <div className="sf-two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {dashboard && dashboard.dueReviews.length > 0 ? (
            <section className="sf-card sf-section-panel" data-testid="fsrs-due-list">
              <div className="blc-col-head">
                <h3 style={{ margin: 0, fontWeight: 600 }}>
                  待复习队列 ({dashboard.dueReviews.length})
                </h3>
              </div>
              <div className="blc-due-chips">
                {dashboard.dueReviews.map((card) => (
                  <div
                    key={`${card.subject}:${card.familyId}`}
                    className="ui-frosted-panel blc-due-item"
                  >
                    <strong>
                      {SHORT_SUBJECT[card.subject]} ·{' '}
                      {resolveChapterTitle(packs, card.subject, card.knowledgeNode)}
                    </strong>
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary blc-btn--xs"
                      onClick={() => void handleStartStandalone(card.subject)}
                    >
                      复习
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="sf-card sf-section-panel" data-testid="course-pack-catalog">
            <div className="blc-col-head">
              <h3 style={{ margin: 0, fontWeight: 600 }}>课程目录</h3>
            </div>
            <div className="blc-pack-list">
              {packs.map((pack) => {
                const currentStart =
                  profile?.learningStartSelections?.[pack.subject] ??
                  pack.knowledgeGraph[0]!.nodeId;
                return (
                  <div key={pack.packId} className="ui-frosted-panel blc-pack-card">
                    <div className="blc-pack-card__head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="blc-chip blc-chip--gold">
                          {SHORT_SUBJECT[pack.subject]}
                        </span>
                        <h4 style={{ margin: 0, fontWeight: 600 }}>{pack.title}</h4>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {pack.itemCount} 题
                      </span>
                    </div>

                    <div className="blc-chapter-rows">
                      {pack.knowledgeGraph.map((node, idx) => {
                        const isStart = currentStart === node.nodeId;
                        return (
                          <div key={node.nodeId} className="blc-chapter-row">
                            <span style={{ fontWeight: 500 }}>
                              {idx + 1}. {node.title}
                            </span>
                            {isStart ? (
                              <span className="blc-chip blc-chip--gold">当前起点</span>
                            ) : (
                              <button
                                type="button"
                                className="blc-btn blc-btn--ghost blc-btn--xs"
                                onClick={() =>
                                  void handleSelectStartNode(pack.subject, node.nodeId, node.title)
                                }
                              >
                                设为起点
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="sf-card sf-section-panel" data-testid="wrong-questions-archive">
          <div className="blc-col-head">
            <h3 style={{ margin: 0, fontWeight: 600 }}>错题本</h3>
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>
              <span className="stat-skeleton" style={{ width: '100%', height: 68 }} />
            </div>
          ) : !dashboard || dashboard.wrongQuestions.length === 0 ? (
            <div className="sf-star-empty">
              <svg width="54" height="54" viewBox="0 0 64 64" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r="24"
                  fill="none"
                  stroke="rgba(240, 220, 170, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <path
                  d="M32 14 L36 28 L50 32 L36 36 L32 50 L28 36 L14 32 L28 28 Z"
                  fill="rgba(240, 220, 170, 0.28)"
                  stroke="#f0dcaa"
                  strokeWidth="1.5"
                />
              </svg>
              <strong>错题星图已清空</strong>
              <span style={{ fontSize: 12.5 }}>暂无待巩固题目，保持当前节奏继续探索。</span>
            </div>
          ) : (
            <div className="blc-attempt-list">
              {dashboard.wrongQuestions.slice(0, 15).map((att) => (
                <div key={att.id} className="blc-attempt-row">
                  <strong>
                    {SHORT_SUBJECT[att.subject]} ·{' '}
                    {resolveChapterTitle(packs, att.subject, att.knowledge_node)}
                  </strong>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={() => void handleStartStandalone(att.subject)}
                  >
                    复练
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SubpageShell>
  );
}
