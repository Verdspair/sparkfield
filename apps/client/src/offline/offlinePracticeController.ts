import {
  FinalBoardSnapshotSchema,
  MODE_BUDGETS,
  getMatchChoiceKind,
  type ClientQuestionView,
  type DurationMode,
  type FsrsCardRecord,
  type GameCommand,
  type LessonStepKind,
  type MatchPhaseKind,
  type QuestionItem,
  type SubjectId,
} from '@pkg/contracts';
import {
  applyGameCommand,
  applyLearningGoldGrant,
  beginNextRound,
  computeActiveTraits,
  createGame,
  createOnboardingMicroScenario,
  decideBotPrepCommands,
  finalPlacements,
  finalizePrepDeadline,
  grantGold,
  resolveRoundBattles,
  runCombat,
  settleRound,
  type CommandResult,
  type GameState,
  type OnboardingMicroScenario,
  type OnboardingStage,
  type ResolvedRound,
} from '@pkg/game-core';
import {
  activateLessonRemediation,
  buildPersonalizedLessonBundle,
  finalizeLearningGoldCarry,
  gradeFrozenLearningUnits,
  gradeQuestionSubmission,
  scheduleFsrsReview,
  settleLearningNodeGold,
  toClientQuestionView,
  type LearningGoldSettlement,
  type PersonalizedLessonBundle,
  type QuestionAnswer,
  type QuestionSubmission,
  type SubmissionInput,
} from '@pkg/learning-core';
import {
  ENGLISH_STARTER_PACK,
  MATH_STARTER_PACK,
  STARTER_COURSE_PACKS,
} from '../content/starterPacks.js';
import { offlineDb, readStoredSessionToken, type OfflineAttemptQueueItem } from '../platform/hostBridge.js';
import {
  httpClient,
  type DirectLearningSessionView,
  type DirectLearningSubmitResponse,
  type LearningDashboardResponse,
} from '../api/httpClient.js';
import type {
  BattleBroadcastPayload,
  MatchLearningFeedbackItem,
  MatchRoomSnapshot,
  MatchSummaryPayload,
} from '../api/matchSocket.js';

const STEPS: readonly LessonStepKind[] = [
  'material',
  'practice',
  'resource_check',
  'remediation',
  'verification',
];

const CHOICE_COMMANDS = new Set(['PICK_AUGMENT', 'REROLL_AUGMENT_SLOT', 'PICK_ANVIL_OPTION']);

async function readLocalFsrsCards(): Promise<FsrsCardRecord[]> {
  try {
    return await offlineDb.fsrsCards.toArray();
  } catch {
    return [];
  }
}

async function persistOfflineNodeLocally(
  questions: readonly QuestionItem[],
  submissions: Readonly<Record<string, SubmissionInput>>,
  nodeAttemptKey: string,
): Promise<void> {
  try {
    const cards = await readLocalFsrsCards();
    const now = new Date();
    const recorded = questions.filter((q) => Object.hasOwn(submissions, q.questionId));
    await offlineDb.transaction('rw', offlineDb.offlineAttempts, async () => {
      for (const q of recorded) {
        const raw = submissions[q.questionId];
        const submission: QuestionSubmission = raw && typeof raw === 'object' && !Array.isArray(raw)
          && ('answer' in raw || 'status' in raw || 'questionId' in raw)
          ? structuredClone(raw as QuestionSubmission)
          : { answer: structuredClone((raw ?? null) as QuestionAnswer | null) };
        const pack = STARTER_COURSE_PACKS.find((p) => p.items.some((item) => item.questionId === q.questionId));
        if (!pack) throw new Error('本地题库版本未找到');
        const grade = gradeQuestionSubmission(q, submission);
        await offlineDb.offlineAttempts.add({
          questionId: q.questionId,
          familyId: q.familyId,
          subject: q.subject,
          knowledgeNode: q.knowledgeNode,
          isCorrect: grade.isCorrect,
          isSkipped: grade.isSkipped,
          createdAtIso: now.toISOString(),
          synced: false,
          submission,
          packId: pack.manifest.packId,
          coursePackVersion: pack.manifest.coursePackVersion,
          nodeAttemptKey,
        });
      }
    });

    for (const q of recorded) {
      if (q.stepRole !== 'practice') {
        const grade = gradeQuestionSubmission(q, submissions[q.questionId]);
        const before = cards.find((c) => c.familyId === q.familyId && c.subject === q.subject);
        const updated = await scheduleFsrsReview({
          card: before,
          familyId: q.familyId,
          subject: q.subject,
          knowledgeNode: q.knowledgeNode,
          now,
          rating: grade.isCorrect ? 3 : 1,
        });
        await offlineDb.fsrsCards.put(updated);
      }
    }
  } catch {
  }
}

type SyncableOfflineAttempt = OfflineAttemptQueueItem & Required<Pick<OfflineAttemptQueueItem,
  'id' | 'submission' | 'packId' | 'coursePackVersion' | 'nodeAttemptKey'>>;

function isSyncableAttempt(row: OfflineAttemptQueueItem): row is SyncableOfflineAttempt {
  return row.id !== undefined && row.submission !== undefined && Boolean(row.packId && row.coursePackVersion && row.nodeAttemptKey);
}

function isOfflineAttemptVisible(row: OfflineAttemptQueueItem, userId?: string): boolean {
  return !row.syncUserId || row.syncUserId === userId;
}

export async function getUnsyncedOfflineAttemptCount(userId: string): Promise<number> {
  try {
    const all = await offlineDb.offlineAttempts.toArray();
    return all.filter((row) => !row.synced && isOfflineAttemptVisible(row, userId)).length;
  } catch {
    return 0;
  }
}

export async function syncPendingOfflineAttemptsToServer(userId: string): Promise<{ syncedCount: number; legacyCount: number }> {
  const token = readStoredSessionToken();
  const ensureCurrentSession = () => {
    if (!userId || !token || readStoredSessionToken() !== token) throw new Error('账号已变化，请重新打开学习页后同步');
  };
  ensureCurrentSession();
  const all = await offlineDb.offlineAttempts.toArray();
  const legacyCount = all.filter((row) => !row.synced && !isSyncableAttempt(row) && isOfflineAttemptVisible(row, userId)).length;
  const batches = new Map<string, SyncableOfflineAttempt[]>();
  for (const row of all) {
    if (!isSyncableAttempt(row)) continue;
    const key = JSON.stringify([row.nodeAttemptKey, row.packId, row.coursePackVersion]);
    const items = batches.get(key) ?? [];
    items.push(row);
    batches.set(key, items);
  }

  let syncedCount = 0;
  for (const items of batches.values()) {
    const pending = items.filter((row) => !row.synced);
    if (!pending.length || items.some((row) => row.syncUserId && row.syncUserId !== userId)) continue;
    ensureCurrentSession();
    await offlineDb.transaction('rw', offlineDb.offlineAttempts, async () => {
      for (const row of items) {
        const current = await offlineDb.offlineAttempts.get(row.id);
        if (!current || (current.syncUserId && current.syncUserId !== userId)) throw new Error('本地记录已归属其他账号，未同步');
        if (!current.syncUserId) await offlineDb.offlineAttempts.update(row.id, { syncUserId: userId });
      }
    });
    ensureCurrentSession();
    const first = items[0]!;
    const submissions = Object.fromEntries(items.map((row) => [row.questionId, row.submission]));
    if (Object.keys(submissions).length !== items.length) throw new Error('本地学习单元题目重复，已保留原记录');
    const result = await httpClient.syncOfflineAttempts({
      packId: first.packId,
      coursePackVersion: first.coursePackVersion,
      idempotencyKey: first.nodeAttemptKey,
      submissions,
    });
    ensureCurrentSession();
    if (!result.isOfflineUnverified || result.attemptIds.length !== items.length || new Set(result.attemptIds).size !== items.length) {
      throw new Error('服务器未完整确认本地记录，请重试同步');
    }
    await offlineDb.transaction('rw', offlineDb.offlineAttempts, async () => {
      for (const row of pending) {
        if (await offlineDb.offlineAttempts.update(row.id, { synced: true }) !== 1) throw new Error('本地同步标记失败，请重试');
      }
    });
    syncedCount += pending.length;
  }
  return { syncedCount, legacyCount };
}

export async function buildOfflineLearningDashboard(userId?: string): Promise<LearningDashboardResponse> {
  const cards = await readLocalFsrsCards();
  let attempts: OfflineAttemptQueueItem[] = [];
  try {
    const all = await offlineDb.offlineAttempts.toArray();
    attempts = all.filter((row) => isOfflineAttemptVisible(row, userId))
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)).slice(0, 60);
  } catch {
    attempts = [];
  }
  const now = new Date();
  const due = cards.filter((c) => new Date(c.dueIso) <= now);
  const mappedAttempts = attempts.map((a, idx) => ({
    id: `offline-${a.id ?? idx}`,
    question_id: a.questionId,
    family_id: a.familyId,
    subject: a.subject,
    knowledge_node: a.knowledgeNode,
    is_correct: a.isCorrect,
    is_offline_unverified: true,
    created_at: a.createdAtIso,
  }));

  return {
    dueReviews: due,
    nextRecommendation: due[0]
      ? { kind: 'due_review', subject: due[0].subject, knowledgeNode: due[0].knowledgeNode }
      : {
          kind: 'course_progress',
          subject: 'english',
          knowledgeNode: ENGLISH_STARTER_PACK.manifest.knowledgeGraph[0]!.nodeId,
        },
    coursePacks: STARTER_COURSE_PACKS.map((p) => ({ manifest: p.manifest, isActive: true })),
    recentAttempts: mappedAttempts,
    wrongQuestions: mappedAttempts.filter((a) => !a.is_correct),
  };
}

export class OfflineDirectLearningSession {
  public readonly sessionId: string;
  private bundle!: PersonalizedLessonBundle;
  private submissions: Record<string, SubmissionInput> = {};
  private stepIndex = 0;
  private completed = false;
  private wrongIds: string[] = [];

  private constructor(sessionId: string, bundle: PersonalizedLessonBundle) {
    this.sessionId = sessionId;
    this.bundle = bundle;
    this.normalizeStep();
  }

  public static async create(params: {
    mode?: DurationMode;
    subject: SubjectId;
    learningStartSelections?: Partial<Record<SubjectId, string>>;
  }): Promise<OfflineDirectLearningSession> {
    const cards = await readLocalFsrsCards();
    const pack = params.subject === 'math' ? MATH_STARTER_PACK : ENGLISH_STARTER_PACK;
    const startNode =
      params.learningStartSelections?.[params.subject] ??
      pack.manifest.knowledgeGraph[0]!.nodeId;
    const bundle = buildPersonalizedLessonBundle({
      packs: [pack],
      mode: params.mode ?? 'standard',
      nodeIndex: 0,
      queueType: 'solo',
      selectedSubjects: [params.subject],
      now: new Date(),
      cards,
      progress: [{ subject: params.subject, knowledgeNode: startNode }],
    });
    return new OfflineDirectLearningSession(`offline-direct-${crypto.randomUUID()}`, bundle);
  }

  private normalizeStep(): void {
    while (this.stepIndex < STEPS.length) {
      const kind = STEPS[this.stepIndex]!;
      const step = this.bundle.steps[this.stepIndex]!;
      if (!step.active || (kind !== 'material' && kind !== 'remediation' && step.questionIds.length === 0)) {
        this.stepIndex += 1;
        continue;
      }
      break;
    }
    this.completed = this.stepIndex >= STEPS.length;
  }

  public toView(): DirectLearningSessionView {
    const activeBundle = activateLessonRemediation(this.bundle, this.submissions);
    const clampedIdx = Math.min(this.stepIndex, activeBundle.steps.length - 1);
    const step = activeBundle.steps[clampedIdx]!;
    const locked = new Set(Object.keys(this.submissions));
    return {
      sessionId: this.sessionId,
      mode: activeBundle.mode,
      nodeIndex: activeBundle.nodeIndex,
      plannedSeconds: activeBundle.plannedSeconds,
      pausedClockAllowed: true,
      expiresAtIso: new Date(Date.now() + 3600_000).toISOString(),
      stepIndex: clampedIdx,
      steps: activeBundle.steps.map((s) => ({
        kind: s.kind,
        plannedSeconds: s.plannedSeconds,
        active: s.active,
        questionCount: s.questionIds.length,
      })),
      currentStep: {
        kind: step.kind,
        materials: step.kind === 'material' ? [...step.materials] : [],
        corrections: step.kind === 'remediation' ? [...step.corrections] : [],
        questions: activeBundle.clientQuestions.filter((q) => q.stepRole === step.kind && step.questionIds.includes(q.questionId)),
        lockedQuestionIds: step.questionIds.filter((id) => locked.has(id)),
      },
      completed: this.completed,
      result: this.completed
        ? {
            attemptIds: Object.keys(this.submissions),
            wrongQuestionIds: this.wrongIds,
            rewardPointsGranted: 0,
            alreadyPersisted: true,
            feedback: [],
          }
        : null,
    };
  }

  public async submit(
    questionId: string,
    submission: SubmissionInput,
  ): Promise<DirectLearningSubmitResponse> {
    if (this.completed) throw new Error('练习已完成');
    const step = this.bundle.steps[this.stepIndex];
    if (!step || step.kind === 'remediation' || !step.questionIds.includes(questionId)) {
      throw new Error('未找到当前步骤对应题目');
    }
    if (Object.hasOwn(this.submissions, questionId)) throw new Error('该题已提交');
    const q = this.bundle.questions.find((it) => it.questionId === questionId);
    if (!q) throw new Error('未找到当前步骤对应题目');
    this.submissions[questionId] = submission;
    const grade = gradeQuestionSubmission(q, submission);
    if (!grade.isCorrect) this.wrongIds.push(questionId);

    if (
      this.stepIndex === 4 &&
      step &&
      step.questionIds.every((id) => Object.hasOwn(this.submissions, id))
    ) {
      this.completed = true;
      await persistOfflineNodeLocally(this.bundle.questions, this.submissions, this.sessionId);
    }

    return {
      feedback: {
        ...grade,
        explanationMd: q.explanationMd,
      },
      session: this.toView(),
    };
  }

  public async advance(): Promise<DirectLearningSessionView> {
    if (this.completed) return this.toView();
    if (this.stepIndex === 2) {
      this.bundle = activateLessonRemediation(this.bundle, this.submissions, true);
    }
    this.stepIndex += 1;
    this.normalizeStep();
    if (this.completed) {
      await persistOfflineNodeLocally(this.bundle.questions, this.submissions, this.sessionId);
    }
    return this.toView();
  }
}

export interface OfflineMatchListeners {
  onSnapshot: (snapshot: MatchRoomSnapshot) => void;
  onBattle?: (payload: BattleBroadcastPayload) => void;
  onSummary?: (summary: MatchSummaryPayload) => void;
}

export class OfflinePracticeMatchController {
  public readonly matchId: string;
  public readonly mode: DurationMode;
  public readonly subject: SubjectId;
  private readonly nickname: string;
  private readonly learningStart: Partial<Record<SubjectId, string>>;
  private readonly listeners: OfflineMatchListeners;
  private readonly game: GameState;
  private readonly playerSeatId: string;

  private phase: MatchPhaseKind = 'entry';
  private phaseIndex = -1;
  private nodeIndex = -1;
  private deadlineEpochMs = 0;
  private completed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingBattle: ResolvedRound | null = null;
  private settlements: LearningGoldSettlement[] = [];
  private wrongIds = new Set<string>();
  private summary: MatchSummaryPayload | null = null;
  private disposed = false;

  private lessonProgress: {
    bundle: PersonalizedLessonBundle;
    submissions: Record<string, SubmissionInput>;
    step: number;
    complete: boolean;
    feedback: Record<string, MatchLearningFeedbackItem>;
    settled: boolean;
  } | null = null;

  constructor(options: {
    mode: DurationMode;
    subject: SubjectId;
    nickname?: string;
    botDifficulty?: 'novice' | 'standard' | 'veteran';
    learningStartSelections?: Partial<Record<SubjectId, string>>;
    seed?: number;
    listeners: OfflineMatchListeners;
  }) {
    this.matchId = `offline-match-${crypto.randomUUID()}`;
    this.mode = options.mode;
    this.subject = options.subject;
    this.nickname = options.nickname ?? '离线指挥官';
    this.learningStart = options.learningStartSelections ?? {};
    this.listeners = options.listeners;

    const seed = options.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0);
    this.game = createGame(options.mode, seed);
    this.playerSeatId = this.game.seats[0]!.id;
    for (let i = 0; i < this.game.seats.length; i += 1) {
      const seat = this.game.seats[i]!;
      seat.isBot = i > 0;
      seat.botDifficulty = options.botDifficulty ?? 'standard';
    }
  }

  public async start(): Promise<void> {
    await this.transition();
  }

  private normalizeLessonStep(): void {
    if (!this.lessonProgress) return;
    while (this.lessonProgress.step < STEPS.length) {
      const kind = STEPS[this.lessonProgress.step]!;
      const step = this.lessonProgress.bundle.steps[this.lessonProgress.step]!;
      if (!step.active || (kind !== 'material' && kind !== 'remediation' && step.questionIds.length === 0)) {
        this.lessonProgress.step += 1;
        continue;
      }
      break;
    }
    this.lessonProgress.complete = this.lessonProgress.step >= STEPS.length;
  }

  private runBots(): void {
    if (!['strategy', 'choice'].includes(this.phase) || this.game.phase !== 'prep') return;
    for (const seat of this.game.seats) {
      if (!seat.isBot) continue;
      for (const cmd of decideBotPrepCommands(this.game, seat.id, seat.botDifficulty)) {
        applyGameCommand(this.game, seat.id, cmd);
      }
    }
  }

  public sendCommand(command: GameCommand): CommandResult {
    if (this.disposed || this.completed) return { ok: false, reason: 'MATCH_NOT_ACTIVE' };
    const selfSeat = this.game.seats.find((s) => s.id === this.playerSeatId)!;
    if (command.type === 'SET_LINEUP_PLAN') {
      selfSeat.lineupPlan = [...command.unitIds];
      this.emitSnapshot();
      return { ok: true };
    }
    if (CHOICE_COMMANDS.has(command.type)) {
      const kind = getMatchChoiceKind(
        this.phase, MODE_BUDGETS.modes[this.mode].timeline[this.phaseIndex]?.label ?? '',
      );
      const allowed = kind === 'augment'
        ? command.type === 'PICK_AUGMENT' || command.type === 'REROLL_AUGMENT_SLOT'
        : kind === 'anvil' && command.type === 'PICK_ANVIL_OPTION';
      if (!allowed) return { ok: false, reason: 'CHOICE_WINDOW_REQUIRED' };
    } else if (this.phase !== 'strategy') {
      return { ok: false, reason: 'STRATEGY_PHASE_REQUIRED' };
    }
    const res = applyGameCommand(this.game, this.playerSeatId, command);
    if (res.ok) this.emitSnapshot();
    return res;
  }

  public sendLearningSubmit(
    questionId: string,
    submission: SubmissionInput,
  ): { ok: boolean; feedback?: MatchLearningFeedbackItem } {
    if (!this.lessonProgress || this.phase !== 'learning') return { ok: false };
    this.normalizeLessonStep();
    if (this.lessonProgress.complete) return { ok: false };
    const kind = STEPS[this.lessonProgress.step]!;
    const step = this.lessonProgress.bundle.steps[this.lessonProgress.step]!;
    if (kind === 'remediation' || !step.questionIds.includes(questionId) ||
      Object.hasOwn(this.lessonProgress.submissions, questionId)) return { ok: false };

    const q = this.lessonProgress.bundle.questions.find((it) => it.questionId === questionId);
    if (!q) return { ok: false };
    const grade = gradeQuestionSubmission(q, submission);
    this.lessonProgress.submissions[questionId] = structuredClone(submission);
    const fb: MatchLearningFeedbackItem = {
      ...grade,
      explanationMd: q.explanationMd,
    };
    this.lessonProgress.feedback[questionId] = fb;
    if (!grade.isCorrect) this.wrongIds.add(questionId);

    if (step.questionIds.every((id) => Object.hasOwn(this.lessonProgress!.submissions, id))) {
      if (kind === 'resource_check') {
        this.lessonProgress.bundle = activateLessonRemediation(
          this.lessonProgress.bundle,
          this.lessonProgress.submissions,
          true,
        );
      }
      this.lessonProgress.step += 1;
      this.normalizeLessonStep();
    }
    this.emitSnapshot();
    return { ok: true, feedback: fb };
  }

  public sendLearningAdvance(): { ok: boolean; reason?: string } {
    if (!this.lessonProgress || this.phase !== 'learning') {
      return { ok: false, reason: 'LEARNING_WINDOW_CLOSED' };
    }
    this.normalizeLessonStep();
    if (this.lessonProgress.complete) {
      void this.skipCurrentPhaseWait();
      return { ok: true };
    }
    const kind = STEPS[this.lessonProgress.step];
    if (kind !== 'material' && kind !== 'remediation') {
      return { ok: false, reason: 'STEP_REQUIRES_SUBMISSIONS' };
    }
    this.lessonProgress.step += 1;
    this.normalizeLessonStep();
    if (this.lessonProgress.complete) {
      void this.skipCurrentPhaseWait();
      return { ok: true };
    }
    this.emitSnapshot();
    return { ok: true };
  }

  public async skipCurrentPhaseWait(): Promise<void> {
    if (this.disposed || this.completed) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.transition();
  }

  private async transition(): Promise<void> {
    if (this.disposed) return;
    const timeline = MODE_BUDGETS.modes[this.mode].timeline;
    this.phaseIndex += 1;
    if (this.phaseIndex >= timeline.length) {
      return;
    }
    const event = timeline[this.phaseIndex]!;
    this.phase = event.kind as MatchPhaseKind;

    if (
      this.game.phase !== 'finished' &&
      this.game.settledRounds.includes(this.game.round) &&
      ['learning', 'strategy', 'choice'].includes(this.phase)
    ) {
      const postBattleChoice =
        this.phase === 'choice' && /战后|PVE.*补给|PVE.*选择/u.test(event.label);
      if (!postBattleChoice) beginNextRound(this.game);
      else this.game.phase = 'prep';
    }

    if (this.phase === 'learning') {
      this.nodeIndex += 1;
      const cards = await readLocalFsrsCards();
      const pack = this.subject === 'math' ? MATH_STARTER_PACK : ENGLISH_STARTER_PACK;
      const startNode =
        this.learningStart[this.subject] ?? pack.manifest.knowledgeGraph[0]!.nodeId;
      const bundle = buildPersonalizedLessonBundle({
        packs: [pack],
        mode: this.mode,
        nodeIndex: this.nodeIndex,
        queueType: 'solo',
        selectedSubjects: [this.subject],
        now: new Date(),
        cards,
        progress: [{ subject: this.subject, knowledgeNode: startNode }],
      });
      this.lessonProgress = {
        bundle,
        submissions: {},
        step: 0,
        complete: false,
        feedback: {},
        settled: false,
      };
      this.normalizeLessonStep();
    } else if (this.phase === 'resource') {
      if (this.lessonProgress && !this.lessonProgress.settled) {
        const selfSeat = this.game.seats.find((s) => s.id === this.playerSeatId)!;
        const settlement = settleLearningNodeGold({
          mode: this.mode,
          blockIndex: this.nodeIndex,
          gradedUnits: gradeFrozenLearningUnits(
            this.lessonProgress.bundle.questions,
            this.lessonProgress.submissions,
          ),
          carryInCents: selfSeat.learningChargeCents,
        });
        applyLearningGoldGrant(
          selfSeat,
          settlement.grantedIntegerGold,
          settlement.carryOutCents,
        );
        selfSeat.learningGoldOrbs = [...settlement.orbSplits];
        this.lessonProgress.settled = true;
        this.settlements.push(settlement);
        for (const q of this.lessonProgress.bundle.questions) {
          if (!gradeQuestionSubmission(q, this.lessonProgress.submissions[q.questionId]).isCorrect) {
            this.wrongIds.add(q.questionId);
          }
        }
        void persistOfflineNodeLocally(
          this.lessonProgress.bundle.questions,
          this.lessonProgress.submissions,
          `${this.matchId}-node-${this.nodeIndex}`,
        );

        for (const botSeat of this.game.seats) {
          if (botSeat.isBot) grantGold(botSeat, 1, 'learning_bot');
        }
      }
    } else if (this.phase === 'strategy' || this.phase === 'choice') {
      this.runBots();
    } else if (this.phase === 'battle') {
      finalizePrepDeadline(this.game);
      this.pendingBattle = resolveRoundBattles(this.game);
      this.listeners.onBattle?.({
        round: this.game.round,
        battles: this.pendingBattle.battles,
      });
    } else if (this.phase === 'settlement') {
      if (this.pendingBattle) {
        settleRound(this.game, this.pendingBattle.outcomes);
        this.pendingBattle = null;
      }
    } else if (this.phase === 'exit') {
      this.finishMatch();
    }

    const durationSec = this.phase === 'entry' ? Math.min(8, event.duration) : event.duration;
    this.deadlineEpochMs = Date.now() + Math.max(1000, durationSec * 1000);
    this.emitSnapshot();

    if (!this.completed) {
      this.timer = setTimeout(() => {
        void this.transition();
      }, Math.max(250, this.deadlineEpochMs - Date.now()));
    }
  }

  private finishMatch(): void {
    const placements = finalPlacements(this.game.seats);
    const selfSeat = this.game.seats.find((s) => s.id === this.playerSeatId)!;
    const carry = finalizeLearningGoldCarry(selfSeat.learningChargeCents);
    selfSeat.learningChargeCents = 0;

    const finalBoard = FinalBoardSnapshotSchema.parse({
      level: selfSeat.level,
      activeTraits: computeActiveTraits(selfSeat.units),
      chosenAugments: [...selfSeat.chosenAugments],
      units: selfSeat.units.flatMap((u) =>
        u.location.zone === 'board'
          ? [
              {
                unitId: u.unitId,
                star: u.star,
                items: [...u.items],
                row: u.location.row,
                col: u.location.col,
              },
            ]
          : [],
      ),
    });

    this.completed = true;
    this.summary = {
      competitive: {
        matchId: this.matchId,
        queueType: 'solo',
        placements,
        seatId: this.playerSeatId,
        place: placements.find((p) => p.seatId === this.playerSeatId)!.place,
        quarterPoints: selfSeat.victoryPoints,
        standing: null,
        standingBefore: null,
        rankScoreDelta: null,
        standingStatus: 'not_applicable',
        finalBoardSnapshot: finalBoard,
      },
      learning: {
        wrongQuestionIds: [...this.wrongIds],
        nodes: [...this.settlements],
        rewardPointsGranted: 0,
        attemptIds: [],
        ...carry,
      },
    };
    this.listeners.onSummary?.(this.summary);
  }

  public getSnapshot(): MatchRoomSnapshot {
    const lp = this.lessonProgress;
    const current = lp && !lp.complete ? STEPS[lp.step]! : null;
    const packVersion =
      (this.subject === 'math' ? MATH_STARTER_PACK : ENGLISH_STARTER_PACK).manifest
        .coursePackVersion;

    return {
      roomId: 'offline-local-room',
      matchId: this.matchId,
      mode: this.mode,
      queueType: 'solo',
      phase: this.phase,
      phaseIndex: this.phaseIndex,
      deadlineEpochMs: this.deadlineEpochMs,
      remainingSeconds: Math.max(0, (this.deadlineEpochMs - Date.now()) / 1000),
      round: this.game.round,
      nodeIndex: this.nodeIndex,
      versionLock: {
        seasonTermId: 'offline-local-practice',
        gameSetVersion: 'season1-v1',
        coursePackVersion: packVersion,
      },
      seatId: this.playerSeatId,
      self: structuredClone(this.game.seats.find((s) => s.id === this.playerSeatId)!),
      seats: this.game.seats.map((seat, idx) => ({
        seatId: seat.id,
        nickname: idx === 0 ? this.nickname : `演练程序 AI-${idx}`,
        level: seat.level,
        units: structuredClone(seat.units.filter((u) => u.location.zone === 'board')),
        victoryPoints: seat.victoryPoints,
        isBot: seat.isBot,
        chosenAugments: [...seat.chosenAugments],
      })),
      learning: lp
        ? {
            nodeIndex: this.nodeIndex,
            currentStep: current,
            complete: lp.complete,
            clientQuestions: lp.bundle.clientQuestions.filter((q) => q.stepRole === current),
            steps: lp.bundle.steps.map((step, index) => ({
              kind: step.kind,
              active: step.active,
              plannedSeconds: step.plannedSeconds,
              questionIds: step.questionIds,
              materials: index === lp.step ? step.materials : [],
              corrections: index === lp.step ? step.corrections : [],
            })),
            submittedQuestionIds: Object.keys(lp.submissions),
            feedback: lp.feedback,
          }
        : null,
      resourceSettlement: this.settlements.at(-1) ?? null,
      summary: this.summary,
      completed: this.completed,
      failure: null,
    };
  }

  private emitSnapshot(): void {
    if (!this.disposed) {
      this.listeners.onSnapshot(this.getSnapshot());
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export interface OnboardingMicroProgress {
  stageId: OnboardingStage['id'];
  stageRemainingSec: number;
  totalRemainingSec: number;
  sampleQuestion: ClientQuestionView;
  sampleFeedback: MatchLearningFeedbackItem | null;
  checklist: {
    mergedTwoStar: boolean;
    craftedRailgun: boolean;
    repositionedUnit: boolean;
  };
  battleOutcome: 'win' | 'draw' | 'loss' | null;
}

export class OnboardingMicroController {
  public readonly scenario: OnboardingMicroScenario;
  private stageIdx = 0;
  private stageDeadlineMs = 0;
  private scenarioDeadlineMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private readonly sampleItem: QuestionItem;
  private readonly sampleClientView: ClientQuestionView;
  private sampleFeedback: MatchLearningFeedbackItem | null = null;
  private repositionedUnit = false;
  private battleOutcome: 'win' | 'draw' | 'loss' | null = null;

  constructor(
    private readonly handlers: {
      onUpdate: (snapshot: MatchRoomSnapshot, progress: OnboardingMicroProgress) => void;
      onBattle: (payload: BattleBroadcastPayload) => void;
      onFinished: () => void;
    },
  ) {
    this.scenario = createOnboardingMicroScenario();
    this.sampleItem =
      ENGLISH_STARTER_PACK.items.find((q) => q.questionType === 'single_choice' && q.stepRole === 'resource_check') ??
      ENGLISH_STARTER_PACK.items[0]!;
    this.sampleClientView = toClientQuestionView(this.sampleItem);
  }

  public start(): void {
    this.scenarioDeadlineMs = Date.now() + this.scenario.durationSeconds * 1000;
    this.enterStage(0);
  }

  private enterStage(index: number): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);

    if (index >= this.scenario.stages.length) {
      this.handlers.onFinished();
      return;
    }
    this.stageIdx = index;
    const st = this.scenario.stages[index]!;
    this.stageDeadlineMs = Date.now() + st.durationSeconds * 1000;

    if (st.id === 'battle') {
      finalizePrepDeadline(this.scenario.game);
      const playerSeat = this.scenario.game.seats.find(
        (s) => s.id === this.scenario.playerSeatId,
      )!;
      const enemySeat = this.scenario.game.seats.find(
        (s) => s.id === this.scenario.enemySeatId,
      )!;
      const result = runCombat(playerSeat, enemySeat, 'quick', 900120);
      this.battleOutcome = result.outcome;
      this.handlers.onBattle({
        round: 1,
        battles: [
          {
            leftSeatId: playerSeat.id,
            rightSeatId: enemySeat.id,
            result,
            pve: false,
          },
        ],
      });
    }

    this.emit();
    this.timer = setTimeout(() => {
      this.enterStage(this.stageIdx + 1);
    }, st.durationSeconds * 1000);
  }

  public submitSampleQuestion(submission: SubmissionInput): void {
    const grade = gradeQuestionSubmission(this.sampleItem, submission);
    this.sampleFeedback = {
      ...grade,
      explanationMd: this.sampleItem.explanationMd,
    };
    const playerSeat = this.scenario.game.seats.find(
      (s) => s.id === this.scenario.playerSeatId,
    )!;
    if (grade.isCorrect) {
      applyLearningGoldGrant(playerSeat, 2, 0);
    } else {
      applyLearningGoldGrant(playerSeat, 1, 40);
    }
    this.emit();
  }

  public advanceStageNow(): void {
    this.enterStage(this.stageIdx + 1);
  }

  public sendCommand(cmd: GameCommand): CommandResult {
    const st = this.scenario.stages[this.stageIdx];
    if (!st || st.id !== 'prep') return { ok: false, reason: 'NOT_PREP' };
    const res = applyGameCommand(this.scenario.game, this.scenario.playerSeatId, cmd);
    if (res.ok && cmd.type === 'MOVE_UNIT') {
      this.repositionedUnit = true;
    }
    this.emit();
    return res;
  }

  private buildSnapshot(): MatchRoomSnapshot {
    const st = this.scenario.stages[this.stageIdx]!;
    const phaseMap: Record<OnboardingStage['id'], MatchPhaseKind> = {
      goal: 'entry',
      sample: 'learning',
      prep: 'strategy',
      battle: 'battle',
      summary: 'settlement',
    };
    const playerSeat = this.scenario.game.seats.find(
      (s) => s.id === this.scenario.playerSeatId,
    )!;
    const enemySeat = this.scenario.game.seats.find(
      (s) => s.id === this.scenario.enemySeatId,
    )!;

    return {
      roomId: 'onboarding-micro-room',
      matchId: 'onboarding-90s-micro',
      mode: 'quick',
      queueType: 'solo',
      phase: phaseMap[st.id],
      phaseIndex: this.stageIdx,
      deadlineEpochMs: this.stageDeadlineMs,
      remainingSeconds: Math.max(0, (this.stageDeadlineMs - Date.now()) / 1000),
      round: 1,
      nodeIndex: 0,
      versionLock: {
        seasonTermId: 'onboarding-sandbox',
        gameSetVersion: 'season1-v1',
        coursePackVersion: ENGLISH_STARTER_PACK.manifest.coursePackVersion,
      },
      seatId: playerSeat.id,
      self: structuredClone(playerSeat),
      seats: [
        {
          seatId: playerSeat.id,
          nickname: '新晋星港领航员（你）',
          level: playerSeat.level,
          units: structuredClone(playerSeat.units.filter((u) => u.location.zone === 'board')),
          victoryPoints: playerSeat.victoryPoints,
          isBot: false,
          chosenAugments: [],
        },
        {
          seatId: enemySeat.id,
          nickname: '试手靶机编队',
          level: enemySeat.level,
          units: structuredClone(enemySeat.units.filter((u) => u.location.zone === 'board')),
          victoryPoints: enemySeat.victoryPoints,
          isBot: true,
          chosenAugments: [],
        },
        ...this.scenario.game.seats.slice(2).map((s, i) => ({
          seatId: s.id,
          nickname: `观摩席位 ${i + 3}`,
          level: s.level,
          units: [],
          victoryPoints: 0,
          isBot: true,
          chosenAugments: [],
        })),
      ],
      learning: null,
      resourceSettlement: null,
      summary: null,
      completed: false,
      failure: null,
    };
  }

  private emit(): void {
    if (this.disposed) return;
    const st = this.scenario.stages[this.stageIdx]!;
    const playerSeat = this.scenario.game.seats.find(
      (s) => s.id === this.scenario.playerSeatId,
    )!;
    const mergedTwoStar = playerSeat.units.some(
      (u) => u.unitId === this.scenario.hints.pairUnitId && u.star >= 2,
    );
    const craftedRailgun = playerSeat.units.some((u) =>
      u.items.includes(this.scenario.hints.craftedItemId),
    );

    this.handlers.onUpdate(this.buildSnapshot(), {
      stageId: st.id,
      stageRemainingSec: Math.max(0, Math.ceil((this.stageDeadlineMs - Date.now()) / 1000)),
      totalRemainingSec: Math.max(0, Math.ceil((this.scenarioDeadlineMs - Date.now()) / 1000)),
      sampleQuestion: this.sampleClientView,
      sampleFeedback: this.sampleFeedback,
      checklist: {
        mergedTwoStar,
        craftedRailgun,
        repositionedUnit: this.repositionedUnit,
      },
      battleOutcome: this.battleOutcome,
    });
  }

  public dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
