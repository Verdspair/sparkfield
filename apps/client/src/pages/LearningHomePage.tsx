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
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import {
  OfflineDirectLearningSession,
  buildOfflineLearningDashboard,
  getUnsyncedOfflineAttemptCount,
  syncPendingOfflineAttemptsToServer,
} from '../offline/offlinePracticeController.js';
import { useAppStore } from '../store/appStore.js';

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

  const activeChapterTitle = useMemo(() => {
    const pack = packs.find((p) => p.subject === focusSubject) ?? packs[0];
    if (!pack) return '基础章节';
    const rec = dashboard?.nextRecommendation;
    const targetNodeId =
      rec && rec.subject === focusSubject
        ? rec.knowledgeNode
        : (profile?.learningStartSelections?.[focusSubject] ?? pack.knowledgeGraph[0]?.nodeId ?? '');
    return resolveChapterTitle(packs, focusSubject, targetNodeId);
  }, [dashboard?.nextRecommendation, focusSubject, packs, profile?.learningStartSelections]);

  const handleStartStandalone = async (subjectOverride?: SubjectId) => {
    if (directInFlightRef.current) return;
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
        <div className="learning-briefing-modal">
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

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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

  return (
    <div className="blc-page-shell blc-scroll-page" data-testid="learning-home-page">
      {!isOffline && unsyncedCount > 0 ? (
        <div
          className="ui-frosted-panel blc-offline-sync-bar"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.22)',
            background: 'rgba(13, 17, 26, 0.78)',
          }}
          data-testid="offline-sync-banner"
        >
          <span>本地有 {unsyncedCount} 条练习记录待同步</span>
          <button
            type="button"
            className="blc-btn blc-btn--primary blc-btn--xs"
            disabled={syncingOffline}
            onClick={() => void handleSyncOffline()}
            data-testid="sync-offline-attempts-btn"
          >
            {syncingOffline ? '同步中…' : '同步'}
          </button>
        </div>
      ) : null}

      <section
        className="ui-frosted-panel blc-learning-hero"
        style={{
          borderRadius: 10,
          border: '1px solid rgba(240, 220, 170, 0.24)',
          background: 'rgba(13, 17, 26, 0.8)',
          padding: '20px 24px',
        }}
        aria-label="当前章节"
      >
        <div className="blc-learning-hero__main">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            当前章节
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 21, fontWeight: 600 }}>
            {loading ? (
              <span className="stat-skeleton" style={{ width: 200 }} />
            ) : (
              activeChapterTitle
            )}
          </h2>

          <div className="blc-learning-hero__stats" style={{ alignItems: 'center', gap: 12 }}>
            <div
              className="ui-frosted-panel blc-mini-stat"
              style={{ minWidth: 96, padding: '8px 14px' }}
            >
              <span>待复习</span>
              <strong
                style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}
                data-testid="due-reviews-count"
              >
                {loading ? <span className="stat-skeleton" /> : (dueCount ?? '—')}
              </strong>
            </div>

            <div
              className="ui-frosted-panel blc-mini-stat"
              style={{ minWidth: 96, padding: '8px 14px' }}
            >
              <span>待巩固</span>
              <strong style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                {loading ? <span className="stat-skeleton" /> : (wrongCount ?? '—')}
              </strong>
            </div>

            <div className="blc-seg-tabs">
              {(['english', 'math'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`blc-seg-tab ${focusSubject === s ? 'blc-seg-tab--active' : ''}`}
                  onClick={() => setFocusSubject(s)}
                  data-testid={`learning-focus-${s}`}
                >
                  {SHORT_SUBJECT[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="blc-btn blc-btn--primary"
            disabled={startingDirect}
            onClick={() => void handleStartStandalone()}
            data-testid="direct-standalone-study-btn"
          >
            {startingDirect ? '准备中…' : '独立练习'}
          </button>

          <button
            type="button"
            className="blc-btn blc-btn--metal"
            onClick={() => void handleBringIntoGame()}
            data-testid="bring-into-game-study-btn"
          >
            带入对局
          </button>
        </div>
      </section>

      {dashboard && dashboard.dueReviews.length > 0 ? (
        <section
          className="ui-frosted-panel blc-section-card"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          data-testid="fsrs-due-list"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>待复习 ({dashboard.dueReviews.length})</h3>
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

      <div className="blc-two-col-grid">
        <section
          className="ui-frosted-panel blc-section-card"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          data-testid="course-pack-catalog"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>课程目录</h3>
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

        <section
          className="ui-frosted-panel blc-section-card"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          data-testid="wrong-questions-archive"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>待巩固</h3>
          </div>
          {loading ? (
            <div style={{ padding: 16 }}>
              <span className="stat-skeleton" style={{ width: '100%', height: 68 }} />
            </div>
          ) : !dashboard || dashboard.wrongQuestions.length === 0 ? (
            <div className="blc-empty-box">暂无待巩固题目</div>
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
    </div>
  );
}
