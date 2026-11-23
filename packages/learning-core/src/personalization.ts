import type { CoursePack, FsrsCardRecord, LessonStepKind, QueueType, QuestionItem, SubjectId, DurationMode, LearningArcMeta, MatchStudyBlueprint } from '@pkg/contracts';
import { forgettingCurve, FSRS6_DEFAULT_WEIGHTS } from 'ts-fsrs/models/fsrs-6';
import { toClientQuestionView, type SafeClientQuestionView } from './client-view.js';
import { validDate } from './fsrs.js';
import { gradeQuestionSubmission } from './grading.js';
import { learningNodePolicy, type SubmissionMap } from './settlement.js';
import { lessonArcMeta, selectArcLesson } from './arc-lesson.js';
import { buildMatchStudyBlueprint } from './study-blueprint.js';

export { buildMatchStudyBlueprint, type MatchStudyBlueprintInput } from './study-blueprint.js';
export { locateMatchStudySlot } from './study-layout.js';

export interface CourseProgress {
  subject: SubjectId;
  knowledgeNode: string;
  completedNodeIds?: readonly string[];
  familiarity?: 'new' | 'familiar' | 'confident';
}
export interface RecentLearningPerformance {
  familyId: string;
  independentAccuracy: number;
  hintRate: number;
  remediationAccuracy?: number;
}
export interface ArcAttempt {
  questionId: string;
  familyId: string;
  isCorrect: boolean;
  slotInArc?: number;
}

export interface PersonalizedLessonInput {
  packs: readonly CoursePack[];
  mode: DurationMode;
  nodeIndex: number;
  queueType: QueueType;
  selectedSubjects: readonly SubjectId[];
  rankedSubject?: SubjectId;
  now: Date | string;
  cards?: readonly FsrsCardRecord[];
  progress?: readonly CourseProgress[];
  recentPerformance?: readonly RecentLearningPerformance[];
  usedQuestionIds?: readonly string[];
  studyBlueprint?: MatchStudyBlueprint;
  priorArcAttempts?: readonly ArcAttempt[];
  submissions?: SubmissionMap;
  assessmentComplete?: boolean;
}
export interface LessonBundleStep {
  kind: LessonStepKind;
  plannedSeconds: number;
  active: boolean;
  questionIds: readonly string[];
  materials: readonly { familyId: string; materialMd: string }[];
  corrections: readonly { questionId: string; explanationMd: string }[];
}
export interface PersonalizedLessonBundle {
  mode: DurationMode;
  nodeIndex: number;
  subjects: readonly SubjectId[];
  plannedSeconds: number;
  verificationWeightPercent: number;
  questions: readonly QuestionItem[];
  clientQuestions: readonly SafeClientQuestionView[];
  steps: readonly LessonBundleStep[];
  frozenDenominators: { resourceCheckWeight: string; verificationWeight: string };
  arcMeta: LearningArcMeta;
  blueprint: MatchStudyBlueprint;
  selectionEvidence: readonly { familyId: string; due: boolean; retrievability: number | null; priority: number }[];
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function validateRate(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be in [0,1]`);
}
export function activateLessonRemediation(bundle: PersonalizedLessonBundle, submissions: SubmissionMap, assessmentComplete = false): PersonalizedLessonBundle {
  const corrections = bundle.questions.filter((q) =>
    q.stepRole === 'resource_check' && (Object.hasOwn(submissions, q.questionId) || assessmentComplete)
    && !gradeQuestionSubmission(q, Object.hasOwn(submissions, q.questionId) ? submissions[q.questionId] : undefined).isCorrect,
  ).map((q) => ({ questionId: q.questionId, explanationMd: q.explanationMd }));
  return freeze({ ...bundle, steps: bundle.steps.map((step) => step.kind === 'remediation' && step.plannedSeconds > 0
    ? { ...step, active: corrections.length > 0, questionIds: corrections.map((c) => c.questionId), corrections }
    : step) });
}
export function buildPersonalizedLessonBundle(input: PersonalizedLessonInput): PersonalizedLessonBundle {
  const policy = learningNodePolicy(input.mode, input.nodeIndex);
  const now = validDate(input.now);
  const subjects = [...new Set(input.selectedSubjects)];
  if (!subjects.length || subjects.some((s) => s !== 'english' && s !== 'math')) throw new Error('Select at least one valid subject');
  if (input.queueType === 'ranked' && (subjects.length !== 1 || !input.rankedSubject || subjects[0] !== input.rankedSubject)) throw new Error('Ranked lessons must use the room shared subject');
  const cards = new Map((input.cards ?? []).map((card) => [card.familyId, card]));
  if (cards.size !== (input.cards?.length ?? 0)) throw new Error('Duplicate FSRS familyId');
  const performance = new Map((input.recentPerformance ?? []).map((item) => {
    validateRate(item.independentAccuracy, 'Independent accuracy'); validateRate(item.hintRate, 'Hint rate');
    if (item.remediationAccuracy !== undefined) validateRate(item.remediationAccuracy, 'Remediation accuracy');
    return [item.familyId, item] as const;
  }));
  const blueprint = input.studyBlueprint ?? buildMatchStudyBlueprint({ ...input, subject: subjects[0]! });
  if (input.studyBlueprint || input.priorArcAttempts !== undefined) {
    const bundle = freeze(selectArcLesson(input, blueprint));
    return input.submissions === undefined ? bundle : activateLessonRemediation(bundle, input.submissions, input.assessmentComplete);
  }
  const arcMeta = lessonArcMeta(blueprint, input.nodeIndex);
  const phaseWeights = [10, 15, 15, 10, 10];
  const phaseSeconds = phaseWeights.map(weight => Math.floor(policy.plannedSeconds * weight / 60));
  phaseSeconds[4]! += policy.plannedSeconds - phaseSeconds.reduce((sum, seconds) => sum + seconds, 0);
  const used = new Set(input.usedQuestionIds ?? []);
  const seenQuestions = new Set<string>();
  const familySubjects = new Map<string, SubjectId>();
  const families = new Map<string, QuestionItem[]>();
  const evidence = new Map<string, { familyId: string; due: boolean; retrievability: number | null; priority: number }>();
  for (const subject of subjects) {
    const packs = input.packs.filter((p) => p.manifest.subject === subject);
    if (!packs.length) throw new Error(`No course pack for ${subject}`);
    const nodes = new Map(packs.flatMap((p) => p.manifest.knowledgeGraph.map((n) => [n.nodeId, n] as const)));
    const progress = input.progress?.find((p) => p.subject === subject);
    const current = progress?.knowledgeNode ?? packs[0]!.manifest.knowledgeGraph[0]!.nodeId;
    if (!nodes.has(current)) throw new Error(`Unknown selected progress: ${current}`);
    const completed = new Set(progress?.completedNodeIds ?? []);
    if ([...completed].some((id) => !nodes.has(id))) throw new Error('Unknown completed knowledge node');
    for (const pack of packs) for (const item of pack.items) {
      if (item.subject !== subject || !nodes.has(item.knowledgeNode)) throw new Error('Course item subject/node mismatch');
      if (seenQuestions.has(item.questionId)) throw new Error('Duplicate questionId across active packs');
      seenQuestions.add(item.questionId);
      if (familySubjects.has(item.familyId) && familySubjects.get(item.familyId) !== subject) throw new Error('Family cannot span subjects');
      familySubjects.set(item.familyId, subject);
      if (used.has(item.questionId)) continue;
      const card = cards.get(item.familyId);
      if (card && (card.subject !== subject || card.knowledgeNode !== item.knowledgeNode)) throw new Error('FSRS family scope mismatch');
      const due = card ? validDate(card.dueIso, 'card due') <= now : false;
      const node = nodes.get(item.knowledgeNode)!;
      const inProgress = item.knowledgeNode === current;
      const unlocked = completed.has(current) && node.prerequisites.every((id) => completed.has(id));
      if (!inProgress && !due && !completed.has(item.knowledgeNode) && !unlocked) continue;
      let retrievability: number | null = null;
      if (card?.lastReviewIso && card.stability > 0) {
        const elapsed = Math.max(0, (now.getTime() - validDate(card.lastReviewIso).getTime()) / 86_400_000);
        retrievability = forgettingCurve(FSRS6_DEFAULT_WEIGHTS, elapsed, card.stability);
      }
      const perf = performance.get(item.familyId);
      const weakness = perf ? (1 - perf.independentAccuracy) * 3 + perf.hintRate * 2 + (1 - (perf.remediationAccuracy ?? 1)) : 0;
      const unfamiliar = progress?.familiarity === 'new' ? 1 : progress?.familiarity === 'confident' ? -0.5 : 0;
      const priority = (due ? 4 : 0) + (retrievability === null ? 0 : (1 - retrievability) * 3)
        + (inProgress ? 2 + unfamiliar : 0) + weakness;
      evidence.set(item.familyId, { familyId: item.familyId, due, retrievability, priority });
      const list = families.get(item.familyId) ?? []; list.push(item); families.set(item.familyId, list);
    }
  }
  const roles = ['practice', 'resource_check', 'verification'] as const;
  const phaseIndex = { practice: 1, resource_check: 2, verification: 4 } as const;
  const chosen: QuestionItem[] = [];
  for (const role of roles) for (const subject of subjects) {
    const candidates = [...families.values()].flat().filter((q) => q.subject === subject && q.stepRole === role);
    candidates.sort((a, b) => {
      const delta = evidence.get(b.familyId)!.priority - evidence.get(a.familyId)!.priority;
      if (delta !== 0) return delta;
      const pa = performance.get(a.familyId);
      const pb = performance.get(b.familyId);
      const targetA = pa && (pa.independentAccuracy < 0.6 || pa.hintRate > 0.5) ? 1 : 3;
      const targetB = pb && (pb.independentAccuracy < 0.6 || pb.hintRate > 0.5) ? 1 : 3;
      return Math.abs(a.difficulty - targetA) - Math.abs(b.difficulty - targetB) || a.questionId.localeCompare(b.questionId);
    });
    const budget = phaseSeconds[phaseIndex[role]]! / subjects.length;
    const selectedFamilies = new Set<string>();
    let seconds = 0;
    let count = 0;
    for (const candidate of candidates) {
      if (selectedFamilies.has(candidate.familyId)) continue;
      if (count > 0 && seconds + candidate.estSeconds > budget) continue;
      chosen.push(structuredClone(candidate)); selectedFamilies.add(candidate.familyId);
      seconds += candidate.estSeconds; count++;
    }
    if (!count && role !== 'practice') throw new Error(`Insufficient ${subject} ${role} variants at selected progress`);
  }
  const materials = [...new Map(chosen.filter((q) => q.materialMd.trim()).map((q) => [q.materialMd, { familyId: q.familyId, materialMd: q.materialMd }])).values()];
  const kinds: LessonStepKind[] = ['material', 'practice', 'resource_check', 'remediation', 'verification'];
  const steps: LessonBundleStep[] = kinds.map((kind, i) => ({
    kind, plannedSeconds: phaseSeconds[i]!, active: kind !== 'remediation',
    questionIds: chosen.filter((q) => q.stepRole === kind).map((q) => q.questionId),
    materials: kind === 'material' && phaseSeconds[0]! > 0 ? materials : [], corrections: [],
  }));
  const weightSum = (role: string) => chosen.filter((q) => q.stepRole === role).reduce((sum, q) => {
    if (!Number.isSafeInteger(q.weight) || q.weight <= 0) throw new Error('Invalid frozen question weight');
    return sum + BigInt(q.weight);
  }, 0n).toString();
  const bundle = freeze({
    mode: input.mode, nodeIndex: input.nodeIndex, subjects, arcMeta, blueprint,
    plannedSeconds: policy.plannedSeconds, verificationWeightPercent: policy.verificationWeightPercent,
    questions: chosen, clientQuestions: chosen.map(toClientQuestionView), steps,
    frozenDenominators: { resourceCheckWeight: weightSum('resource_check'), verificationWeight: weightSum('verification') },
    selectionEvidence: [...new Set(chosen.map((q) => q.familyId))].map((id) => evidence.get(id)!),
  });
  return input.submissions === undefined ? bundle : activateLessonRemediation(bundle, input.submissions, input.assessmentComplete);
}
