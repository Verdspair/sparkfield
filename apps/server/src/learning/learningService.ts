import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Transaction } from 'kysely';
import { z } from 'zod';
import { CoursePackSchema, DurationModeSchema, SubjectIdSchema,
  type QuestionFeedbackReveal, type QuestionIssueReport } from '@pkg/contracts';
import { activateLessonRemediation, buildPersonalizedLessonBundle, evaluateRewardPointsTaskGrant,
  formatCorrectAnswerDisplay, gradeQuestionSubmission, learningNodePolicy, scheduleFsrsReview, type PersonalizedLessonBundle,
  type QuestionSubmission, type SubmissionInput, type SubmissionMap } from '@pkg/learning-core';
import type { AppDatabase } from '../db/client.js';
import type { Database, JsonValue } from '../db/schema.js';
import { ServiceError } from '../db/errors.js';
import { getCoursePack, getPrivateFsrsCards, recordLearningAttempt, saveFsrsCard, storeQuestionIssueReport } from '../db/repositories.js';
import { grantRewardPointsInTx } from '../rewards/rewardsService.js';

const AnswerSchema = z.union([z.string().max(20_000), z.number().finite(), z.array(z.string().max(2000)).max(100),
  z.record(z.string().max(200), z.union([z.string().max(2000), z.number().finite()]))]);
export const LearningSubmissionSchema = z.object({ answer: AnswerSchema.nullable().optional(),
  status: z.enum(['submitted', 'skipped', 'timed_out']).optional(), questionId: z.string().optional(), hintUsed: z.boolean().optional() }).strict();
export const DirectLearningStartSchema = z.object({ mode: DurationModeSchema.default('standard'),
  nodeIndex: z.number().int().nonnegative().default(0), selectedSubjects: z.array(SubjectIdSchema).min(1).max(2).default(['english']),
  packIds: z.array(z.string().min(1)).max(10).optional() }).strict();
export const OfflineLearningSyncSchema = z.object({ packId: z.string().min(1), coursePackVersion: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128), submissions: z.record(z.string().min(1), LearningSubmissionSchema).refine((s) => Object.keys(s).length > 0 && Object.keys(s).length <= 500) }).strict();
export interface PersistNodeContext {
  source: 'match_learning' | 'direct_learning' | 'offline_sync';
  coursePackVersion?: string;
  questionVersions?: Readonly<Record<string, string>>;
  idempotencyKey: string;
  now?: Date;
  tx?: Transaction<Database>;
}
export interface PersistNodeResult {
  attemptIds: string[];
  wrongQuestionIds: string[];
  rewardPointsGranted: number;
  alreadyPersisted: boolean;
  feedback: QuestionFeedbackReveal[];
}
interface DirectSession {
  id: string; userId: string; bundle: PersonalizedLessonBundle; versions: Record<string, string>;
  submissions: Record<string, SubmissionInput>; stepIndex: number; expiresAt: number;
  result?: PersistNodeResult;
}
export interface LearningServiceOptions { now?: () => Date; directSessionTtlMs?: number; pointsPerTask?: number }
const hintUsed = (submission: SubmissionInput): boolean => !!submission && typeof submission === 'object' && !Array.isArray(submission)
  && (submission as QuestionSubmission).hintUsed === true;
const attemptIdentity = (userId: string, key: string, questionId: string): string =>
  `learning:${createHash('sha256').update(JSON.stringify([userId, key, questionId])).digest('hex')}`;
const feedbackFor = (bundle: Pick<PersonalizedLessonBundle, 'questions'>, submissions: SubmissionMap): QuestionFeedbackReveal[] =>
  bundle.questions.map((q) => { const grade = gradeQuestionSubmission(q, submissions[q.questionId]);
    return { questionId: q.questionId, isCorrect: grade.isCorrect, isSkipped: grade.isSkipped, quality: grade.quality, explanationMd: q.explanationMd }; });

export class LearningService {
  private readonly sessions = new Map<string, DirectSession>();
  private readonly now: () => Date;
  private readonly ttl: number;
  private readonly points: number;
  constructor(private readonly db: AppDatabase, options: LearningServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.ttl = options.directSessionTtlMs ?? 4 * 60 * 60 * 1000;
    this.points = options.pointsPerTask ?? 1;
    if (!Number.isSafeInteger(this.points) || this.points < 1) throw new RangeError('Invalid reward-points policy');
  }

  async persistNode(userId: string, bundle: Pick<PersonalizedLessonBundle, 'questions'>, submissions: SubmissionMap, context: PersistNodeContext): Promise<PersistNodeResult> {
    if (!context.idempotencyKey || context.idempotencyKey.length > 256) throw new ServiceError('INVALID_IDEMPOTENCY_KEY');
    const ids = new Set(bundle.questions.map((q) => q.questionId));
    if (ids.size !== bundle.questions.length || Object.keys(submissions).some((id) => !ids.has(id))) throw new ServiceError('UNKNOWN_FROZEN_QUESTION');
    for (const [questionId, submission] of Object.entries(submissions)) {
      if (submission && typeof submission === 'object' && !Array.isArray(submission) && 'questionId' in submission
        && submission.questionId !== undefined && submission.questionId !== questionId) throw new ServiceError('QUESTION_ID_MISMATCH');
    }
    const now = context.now ?? this.now();
    if (!Number.isFinite(now.getTime())) throw new ServiceError('INVALID_REVIEW_TIME');
    const offline = context.source === 'offline_sync';
    const feedback = feedbackFor(bundle, submissions);
    const gradeById = new Map(feedback.map((grade) => [grade.questionId, grade]));
    const recordedQuestions = bundle.questions.filter((q) => Object.hasOwn(submissions, q.questionId) && submissions[q.questionId] !== undefined);
    const attemptIds = recordedQuestions.map((q) => attemptIdentity(userId, context.idempotencyKey, q.questionId));
    const run = async (tx: Transaction<Database>): Promise<PersistNodeResult> => {
      const user = await tx.selectFrom('users').select('id').where('id', '=', userId).forUpdate().executeTakeFirst();
      if (!user) throw new ServiceError('USER_NOT_FOUND');
      const existing = attemptIds.length ? await tx.selectFrom('learning_attempts').selectAll().where('id', 'in', attemptIds).execute() : [];
      const payloads = recordedQuestions.map((q) => JSON.parse(JSON.stringify({ submission: submissions[q.questionId] ?? null,
        source: context.source, stepRole: q.stepRole, nodeKey: context.idempotencyKey })) as JsonValue);
      if (existing.length) {
        if (existing.length !== attemptIds.length || existing.some((row) => {
          const i = attemptIds.indexOf(row.id); const q = recordedQuestions[i]!;
          return row.user_id !== userId || row.question_id !== q.questionId || row.family_id !== q.familyId
            || row.subject !== q.subject || row.knowledge_node !== q.knowledgeNode || row.is_correct !== gradeById.get(q.questionId)!.isCorrect
            || row.course_pack_version !== (context.questionVersions?.[q.questionId] ?? context.coursePackVersion)
            || row.is_offline_unverified !== offline || !isDeepStrictEqual(row.answer_json, payloads[i]);
        })) throw new ServiceError('LEARNING_NODE_IDEMPOTENCY_CONFLICT');
        const awards = await tx.selectFrom('reward_points_ledger').select('points_delta').where('user_id', '=', userId)
          .where('related_attempt_id', 'in', attemptIds).where('points_delta', '>', 0).execute();
        return { attemptIds, wrongQuestionIds: feedback.filter((f) => !f.isCorrect).map((f) => f.questionId),
          rewardPointsGranted: awards.reduce((sum, row) => sum + row.points_delta, 0), alreadyPersisted: true, feedback };
      }
      for (let i = 0; i < recordedQuestions.length; i++) {
        const q = recordedQuestions[i]!;
        const version = context.questionVersions?.[q.questionId] ?? context.coursePackVersion;
        if (!version) throw new ServiceError('COURSE_PACK_VERSION_REQUIRED');
        if (!offline && q.stepRole !== 'practice' && hintUsed(submissions[q.questionId])) throw new ServiceError('SCORED_QUESTION_HINT_FORBIDDEN');
        await recordLearningAttempt(tx, { id: attemptIds[i], userId, questionId: q.questionId, familyId: q.familyId,
          subject: q.subject, coursePackVersion: version, knowledgeNode: q.knowledgeNode, isCorrect: gradeById.get(q.questionId)!.isCorrect,
          answer: payloads[i] as JsonValue, isOfflineUnverified: offline });
      }
      let rewardPointsGranted = 0;
      if (!offline && recordedQuestions.length) {
        const cards = await getPrivateFsrsCards(tx, userId);
        const quotas = await tx.selectFrom('reward_task_quotas').select('task_key').where('user_id', '=', userId).execute();
        const taskKeys = new Set(quotas.map((q) => q.task_key));
        const families = [...new Set(recordedQuestions.map((q) => q.familyId))];
        for (const familyId of families) {
          const family = recordedQuestions.filter((q) => q.familyId === familyId && q.stepRole !== 'practice');
          if (!family.length) continue;
          const independent = family.filter((q) => q.stepRole === 'verification');
          const evidence = independent.length ? independent : family;
          const frozenIndependent = bundle.questions.filter((q) => q.familyId === familyId && q.stepRole === 'verification');
          const mastered = frozenIndependent.length > 0 && frozenIndependent.every((q) => Object.hasOwn(submissions, q.questionId)
            && gradeQuestionSubmission(q, submissions[q.questionId]).isCorrect && !hintUsed(submissions[q.questionId]));
          const first = family[0]!;
          const before = cards.find((card) => card.familyId === familyId && card.subject === first.subject);
          const grant = evaluateRewardPointsTaskGrant({ userId, familyId, source: context.source, verifiedOnline: true,
            isMastered: mastered, now, cardBeforeReview: before, grantedTaskKeys: taskKeys, points: this.points });
          if (grant.granted && grant.taskKey) {
            const q = independent[0]!;
            const attemptId = attemptIdentity(userId, context.idempotencyKey, q.questionId);
            const ledger = await grantRewardPointsInTx(tx, { userId, points: grant.pointsDelta, reason: `learning_${grant.reason}`,
              idempotencyKey: `task:${createHash('sha256').update(grant.taskKey).digest('hex')}`, attemptId,
              taskQuota: { taskKey: grant.taskKey, quotaWindow: 'shared_all_learning_entries' } });
            rewardPointsGranted += ledger.points_delta;
            taskKeys.add(grant.taskKey);
          }
          const allCorrect = evidence.every((q) => gradeQuestionSubmission(q, submissions[q.questionId]).isCorrect && !hintUsed(submissions[q.questionId]));
          const hasCredit = evidence.some((q) => BigInt(gradeQuestionSubmission(q, submissions[q.questionId]).quality.numerator) > 0n);
          const next = await scheduleFsrsReview({ card: before, familyId, subject: first.subject,
            knowledgeNode: first.knowledgeNode, now, rating: allCorrect ? 3 : hasCredit ? 2 : 1 });
          await saveFsrsCard(tx, userId, next);
        }
      }
      return { attemptIds, wrongQuestionIds: feedback.filter((f) => !f.isCorrect).map((f) => f.questionId),
        rewardPointsGranted, alreadyPersisted: false, feedback };
    };
    return context.tx ? run(context.tx) : this.db.transaction().execute(run);
  }

  async listCoursePacks() {
    const rows = await this.db.selectFrom('course_packs').select(['pack_json', 'is_active']).where('is_active', '=', true).orderBy('pack_id').execute();
    return rows.map((row) => ({ manifest: CoursePackSchema.parse(row.pack_json).manifest, isActive: row.is_active }));
  }
  async overview(userId: string) {
    const [cards, packs, attempts] = await Promise.all([getPrivateFsrsCards(this.db, userId), this.listCoursePacks(),
      this.db.selectFrom('learning_attempts').select(['id', 'question_id', 'family_id', 'subject', 'knowledge_node', 'is_correct', 'is_offline_unverified', 'created_at'])
        .where('user_id', '=', userId).orderBy('created_at', 'desc').limit(100).execute()]);
    const due = cards.filter((card) => new Date(card.dueIso) <= this.now());
    return { dueReviews: due, nextRecommendation: due[0] ? { kind: 'due_review', subject: due[0].subject, knowledgeNode: due[0].knowledgeNode }
      : packs[0] ? { kind: 'course_progress', subject: packs[0].manifest.subject, knowledgeNode: packs[0].manifest.knowledgeGraph[0]!.nodeId } : null,
      coursePacks: packs, recentAttempts: attempts, wrongQuestions: attempts.filter((a) => !a.is_correct) };
  }
  async startDirect(userId: string, input: unknown, tx?: Transaction<Database>) {
    const data = DirectLearningStartSchema.parse(input);
    try { learningNodePolicy(data.mode, data.nodeIndex); } catch { throw new ServiceError('INVALID_LEARNING_NODE'); }
    const db = tx ?? this.db;
    const user = await db.selectFrom('users').select('learning_start_json').where('id', '=', userId).executeTakeFirstOrThrow();
    const rows = await db.selectFrom('course_packs').select('pack_json').where('is_active', '=', true).orderBy('pack_id').execute();
    const packs = rows.map((row) => CoursePackSchema.parse(row.pack_json)).filter((p) => data.selectedSubjects.includes(p.manifest.subject)
      && (!data.packIds || data.packIds.includes(p.manifest.packId)));
    if (!packs.length || data.selectedSubjects.some((subject) => !packs.some((pack) => pack.manifest.subject === subject))) throw new ServiceError('COURSE_PACK_NOT_FOUND');
    const cards = await getPrivateFsrsCards(db, userId);
    const recent = await db.selectFrom('learning_attempts').select(['family_id', 'is_correct', 'answer_json'])
      .where('user_id', '=', userId).where('is_offline_unverified', '=', false).orderBy('created_at', 'desc').limit(100).execute();
    const groups = new Map<string, typeof recent>();
    for (const row of recent) { const entries = groups.get(row.family_id) ?? []; entries.push(row); groups.set(row.family_id, entries); }
    const progress = data.selectedSubjects.map((subject) => ({ subject,
      knowledgeNode: user.learning_start_json[subject] ?? packs.find((p) => p.manifest.subject === subject)?.manifest.knowledgeGraph[0]?.nodeId ?? '' }));
    if (progress.some((p) => !packs.some((pack) => pack.manifest.subject === p.subject && pack.manifest.knowledgeGraph.some((n) => n.nodeId === p.knowledgeNode)))) {
      throw new ServiceError('INVALID_LEARNING_START');
    }
    const bundle = buildPersonalizedLessonBundle({ packs, mode: data.mode, nodeIndex: data.nodeIndex, queueType: 'solo',
      selectedSubjects: data.selectedSubjects, now: this.now(), cards, progress,
      recentPerformance: [...groups].map(([familyId, entries]) => {
        const meta = (entry: typeof entries[number]) => entry.answer_json && typeof entry.answer_json === 'object' && !Array.isArray(entry.answer_json)
          ? entry.answer_json as Record<string, JsonValue> : {};
        const independent = entries.filter((entry) => meta(entry).stepRole !== 'practice' && !hintUsed(meta(entry).submission as SubmissionInput));
        return { familyId, independentAccuracy: independent.length ? independent.filter((e) => e.is_correct).length / independent.length : 0.5,
          hintRate: entries.filter((e) => hintUsed(meta(e).submission as SubmissionInput)).length / entries.length };
      }) });
    for (const [id, session] of this.sessions) if (session.expiresAt <= this.now().getTime()) this.sessions.delete(id);
    for (const [id, session] of this.sessions) if (session.userId === userId) this.sessions.delete(id);
    const id = randomUUID(); const versions: Record<string, string> = {};
    for (const pack of packs) for (const q of pack.items) versions[q.questionId] = pack.manifest.coursePackVersion;
    this.sessions.set(id, { id, userId, bundle, versions, submissions: Object.create(null) as Record<string, SubmissionInput>,
      stepIndex: 0, expiresAt: this.now().getTime() + this.ttl });
    return this.getDirect(userId, id);
  }
  private direct(userId: string, sessionId: string): DirectSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw new ServiceError('LEARNING_SESSION_NOT_FOUND');
    if (session.expiresAt <= this.now().getTime()) { this.sessions.delete(sessionId); throw new ServiceError('LEARNING_SESSION_EXPIRED'); }
    return session;
  }
  getDirect(userId: string, sessionId: string) {
    const session = this.direct(userId, sessionId);
    const bundle = activateLessonRemediation(session.bundle, session.submissions);
    const step = bundle.steps[session.stepIndex]!;
    const locked = new Set(Object.keys(session.submissions));
    return { sessionId, mode: bundle.mode, nodeIndex: bundle.nodeIndex, plannedSeconds: bundle.plannedSeconds,
      pausedClockAllowed: true, expiresAtIso: new Date(session.expiresAt).toISOString(), stepIndex: session.stepIndex,
      steps: bundle.steps.map((s) => ({ kind: s.kind, plannedSeconds: s.plannedSeconds, active: s.active, questionCount: s.questionIds.length })),
      currentStep: { kind: step.kind, materials: step.kind === 'material' ? step.materials : [],
        corrections: step.kind === 'remediation' ? step.corrections : [],
        questions: bundle.clientQuestions.filter((q) => step.questionIds.includes(q.questionId)),
        lockedQuestionIds: step.questionIds.filter((id) => locked.has(id)) },
      completed: !!session.result, result: session.result ?? null };
  }
  async submitDirect(userId: string, sessionId: string, questionId: string, input: unknown, tx?: Transaction<Database>) {
    const session = this.direct(userId, sessionId); const submission = LearningSubmissionSchema.parse(input);
    if (submission.questionId !== undefined && submission.questionId !== questionId) throw new ServiceError('QUESTION_ID_MISMATCH');
    const q = session.bundle.questions.find((item) => item.questionId === questionId);
    if (!q || !session.bundle.steps[session.stepIndex]!.questionIds.includes(questionId)) throw new ServiceError('QUESTION_NOT_IN_CURRENT_STEP');
    if (q.stepRole !== 'practice' && submission.hintUsed) throw new ServiceError('SCORED_QUESTION_HINT_FORBIDDEN');
    if (Object.hasOwn(session.submissions, questionId) && !isDeepStrictEqual(session.submissions[questionId], submission)) throw new ServiceError('QUESTION_SUBMISSION_LOCKED');
    session.submissions[questionId] = submission;
    const grade = gradeQuestionSubmission(q, submission);
    const complete = session.stepIndex === 4 && session.bundle.steps[4]!.questionIds.every((id) => Object.hasOwn(session.submissions, id));
    if (complete && !session.result) session.result = await this.persistNode(userId, session.bundle, session.submissions,
      { source: 'direct_learning', questionVersions: session.versions, idempotencyKey: `direct:${session.id}`, tx });
    return { feedback: { ...grade, explanationMd: q.explanationMd, correctAnswerDisplay: formatCorrectAnswerDisplay(q) }, session: this.getDirect(userId, sessionId) };
  }
  async advanceDirect(userId: string, sessionId: string, tx?: Transaction<Database>) {
    const session = this.direct(userId, sessionId);
    if (session.result) return this.getDirect(userId, sessionId);
    const step = session.bundle.steps[session.stepIndex]!;
    if (step.questionIds.some((id) => !Object.hasOwn(session.submissions, id))) throw new ServiceError('LEARNING_STEP_INCOMPLETE');
    if (session.stepIndex < 4) session.stepIndex++;
    else session.result = await this.persistNode(userId, session.bundle, session.submissions,
      { source: 'direct_learning', questionVersions: session.versions, idempotencyKey: `direct:${session.id}`, tx });
    return this.getDirect(userId, sessionId);
  }
  async syncOffline(userId: string, input: unknown, tx?: Transaction<Database>) {
    const data = OfflineLearningSyncSchema.parse(input);
    const pack = await getCoursePack(tx ?? this.db, data.packId, data.coursePackVersion);
    const questions = pack.items.filter((q) => Object.hasOwn(data.submissions, q.questionId));
    if (questions.length !== Object.keys(data.submissions).length) throw new ServiceError('QUESTION_NOT_IN_COURSE_PACK');
    const bundle = { questions };
    const result = await this.persistNode(userId, bundle, data.submissions,
      { source: 'offline_sync', coursePackVersion: data.coursePackVersion, idempotencyKey: `offline:${data.idempotencyKey}`, tx });
    return { ...result, isOfflineUnverified: true, rewardPointsGranted: 0 };
  }
  async reportQuestionIssue(userId: string, report: QuestionIssueReport, tx?: Transaction<Database>) {
    return { reportId: await storeQuestionIssueReport(tx ?? this.db, userId, report) };
  }
}
