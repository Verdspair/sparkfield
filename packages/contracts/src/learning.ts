import { z } from 'zod';
import { DurationModeSchema, MATCH_STUDY_ARC_SLOTS } from './modes.js';

export const SubjectIdSchema = z.enum(['english', 'math']);
export type SubjectId = z.infer<typeof SubjectIdSchema>;

export const ArcStageKindSchema = z.enum(['intro', 'deepen', 'remediate', 'stretch', 'mastery', 'diagnose']);
export type ArcStageKind = z.infer<typeof ArcStageKindSchema>;

export const StudyArcStrategySchema = z.enum(['structured_topic', 'modular_pack']);
export const StudyDifficultyTierSchema = z.enum(['foundational', 'standard', 'advanced']);
export type StudyDifficultyTier = z.infer<typeof StudyDifficultyTierSchema>;

export const StudyArcSlotsSchema = z.union([z.literal(3), z.literal(4), z.literal(5)]);
export type StudyArcSlots = z.infer<typeof StudyArcSlotsSchema>;

export const MatchStudyArcPlanSchema = z.object({
  arcIndex: z.number().int().nonnegative(),
  topicNodeIds: z.array(z.string().min(1)).min(1),
  primaryNodeId: z.string().min(1),
  title: z.string().min(1),
  subject: SubjectIdSchema,
  strategy: StudyArcStrategySchema,
  tags: z.array(z.string().min(1)),
  loadScore: z.number().nonnegative(),
  slotsInArc: StudyArcSlotsSchema,
  slotStages: z.array(ArcStageKindSchema).min(3).max(5),
}).refine(arc => arc.topicNodeIds.includes(arc.primaryNodeId), { path: ['primaryNodeId'] })
  .refine(arc => arc.slotStages.length === arc.slotsInArc && arc.slotStages[0] === 'intro'
    && arc.slotStages.at(-1) === 'mastery', { path: ['slotStages'] });
export type MatchStudyArcPlan = z.infer<typeof MatchStudyArcPlanSchema>;

export const MatchStudyBlueprintSchema = z.object({
  mode: DurationModeSchema,
  subject: SubjectIdSchema,
  arcCount: z.number().int().positive(),
  slotsPerArc: StudyArcSlotsSchema,
  difficultyTier: StudyDifficultyTierSchema,
  seed: z.number().int(),
  arcs: z.array(MatchStudyArcPlanSchema).min(1),
}).refine(blueprint => {
  const [min, max] = MATCH_STUDY_ARC_SLOTS[blueprint.mode];
  const total = blueprint.arcs.reduce((sum, arc) => sum + arc.slotsInArc, 0);
  return total >= min && total <= max && blueprint.arcCount === blueprint.arcs.length
    && blueprint.slotsPerArc === Math.max(...blueprint.arcs.map(arc => arc.slotsInArc))
    && blueprint.arcs.every((arc, index) => arc.arcIndex === index && arc.subject === blueprint.subject);
}, { path: ['arcs'] });
export type MatchStudyBlueprint = z.infer<typeof MatchStudyBlueprintSchema>;

export const LearningArcMetaSchema = z.object({
  arcIndex: z.number().int().nonnegative(),
  arcCount: z.number().int().positive(),
  slotInArc: z.number().int().nonnegative(),
  slotsPerArc: StudyArcSlotsSchema,
  stageKind: ArcStageKindSchema,
  stageLabel: z.string().min(1),
  topicTitle: z.string().min(1),
  strategy: StudyArcStrategySchema,
  blueprintTags: z.array(z.string().min(1)),
  adaptiveBranch: z.enum(['standard', 'remediation_inserted', 'stretch_promoted']),
  stageOutline: z.array(z.object({
    slot: z.number().int().nonnegative(),
    kind: ArcStageKindSchema,
    label: z.string().min(1),
    status: z.enum(['done', 'active', 'upcoming']),
  })).min(3).max(5),
}).refine(meta => meta.arcIndex < meta.arcCount && meta.slotInArc < meta.slotsPerArc
  && meta.stageOutline.length === meta.slotsPerArc
  && meta.stageOutline.every((stage, index) => stage.slot === index
    && stage.status === (index === meta.slotInArc ? 'active' : index < meta.slotInArc ? 'done' : 'upcoming'))
  && meta.stageOutline[meta.slotInArc]?.kind === meta.stageKind, { path: ['slotInArc'] });
export type LearningArcMeta = z.infer<typeof LearningArcMetaSchema>;


export const LessonStepKindSchema = z.enum([
  'material',
  'practice',
  'resource_check',
  'remediation',
  'verification',
]);
export type LessonStepKind = z.infer<typeof LessonStepKindSchema>;

export const QuestionTypeSchema = z.enum([
  'single_choice',
  'multi_choice',
  'matching',
  'short_fill',
  'numeric',
  'multi_step_numeric',
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const AssessmentKindSchema = z.enum(['retrieval', 'application']);
export type AssessmentKind = z.infer<typeof AssessmentKindSchema>;

export const StepRubricEntrySchema = z.object({
  stepId: z.string().min(1),
  prompt: z.string().min(1),
  expected: z.number(),
  tolerance: z.number().nonnegative().default(0.01),
  weightShare: z.number().positive().max(1),
});
export type StepRubricEntry = z.infer<typeof StepRubricEntrySchema>;

export const MatchingPairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

export const QuestionItemBaseSchema = z.object({
  questionId: z.string().min(1),
  familyId: z.string().min(1),
  subject: SubjectIdSchema,
  knowledgeNode: z.string().min(1),
  stepRole: z.enum(['practice', 'resource_check', 'verification']),
  questionType: QuestionTypeSchema,
  assessmentKind: AssessmentKindSchema,
  allowMaterialReview: z.boolean(),
  materialMd: z.string().default(''),
  stemMd: z.string().min(1),
  options: z.array(z.object({ key: z.string().min(1), text: z.string().min(1) })).default([]),
  matchingPairs: z.array(MatchingPairSchema).default([]),
  stepsRubric: z.array(StepRubricEntrySchema).default([]),
  answerSpec: z.string().min(1),
  partialRubric: z.string().default(''),
  hintMd: z.string().default(''),
  explanationMd: z.string().min(1),
  difficulty: z.number().int().min(1).max(5).default(2),
  weight: z.number().int().positive().default(10),
  estSeconds: z.number().int().positive().default(30),
  sourceLicense: z.string().min(1),
  audioRefOptional: z.string().nullable().default(null),
});

export const QuestionItemSchema = QuestionItemBaseSchema.superRefine((q, ctx) => {
  if ((q.stepRole === 'resource_check' || q.stepRole === 'verification') && q.hintMd.trim().length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `Question ${q.questionId}: resource_check and verification items must not provide item hints.`,
    });
  }
  if (q.assessmentKind === 'retrieval' && q.allowMaterialReview) {
    ctx.addIssue({
      code: 'custom',
      message: `Question ${q.questionId}: retrieval items must forbid reviewing newly learned definition cards.`,
    });
  }
});
export type QuestionItem = z.infer<typeof QuestionItemSchema>;

export const ClientStepPromptSchema = z.object({
  stepId: z.string().min(1),
  prompt: z.string().min(1),
  weightShare: z.number().positive().max(1),
});
export type ClientStepPrompt = z.infer<typeof ClientStepPromptSchema>;

export const ClientQuestionViewSchema = QuestionItemBaseSchema.omit({
  answerSpec: true,
  partialRubric: true,
  explanationMd: true,
  matchingPairs: true,
  stepsRubric: true,
}).extend({
  stepsRubric: z.array(ClientStepPromptSchema).default([]),
  matchingLeft: z.array(z.string().min(1)).default([]),
  matchingRight: z.array(z.string().min(1)).default([]),
});
export type ClientQuestionView = z.infer<typeof ClientQuestionViewSchema>;

export const QuestionFeedbackRevealSchema = z.object({
  questionId: z.string().min(1),
  isCorrect: z.boolean(),
  isSkipped: z.boolean(),
  quality: z.object({ numerator: z.string(), denominator: z.string() }),
  explanationMd: z.string(),
});
export type QuestionFeedbackReveal = z.infer<typeof QuestionFeedbackRevealSchema>;

export const KnowledgeNodeDefSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
  prerequisites: z.array(z.string()),
});
export type KnowledgeNodeDef = z.infer<typeof KnowledgeNodeDefSchema>;

export const CoursePackManifestSchema = z.object({
  packId: z.string().min(1),
  coursePackVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  subject: SubjectIdSchema,
  title: z.string().min(1),
  syllabusTag: z.string().min(1),
  contentSha256: z.string().length(64),
  itemCount: z.number().int().positive(),
  knowledgeGraph: z.array(KnowledgeNodeDefSchema).min(1),
  createdAtIso: z.string().min(1),
});
export type CoursePackManifest = z.infer<typeof CoursePackManifestSchema>;

export const CoursePackSchema = z.object({
  manifest: CoursePackManifestSchema,
  items: z.array(QuestionItemSchema).min(1),
});
export type CoursePack = z.infer<typeof CoursePackSchema>;

export const DivmodGoldSettlementSchema = z.object({
  nodeIndex: z.number().int().nonnegative(),
  centBudget: z.number().int().positive(),
  scoreNumerator: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
  scoreDenominator: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]),
  rawEarnedCents: z.number().int().nonnegative(),
  carryInCents: z.number().int().min(0).max(99),
  grantedIntegerGold: z.number().int().nonnegative(),
  orbSplits: z.array(z.number().int().positive()),
  carryOutCents: z.number().int().min(0).max(99),
});
export type DivmodGoldSettlement = z.infer<typeof DivmodGoldSettlementSchema>;

export const FsrsCardRecordSchema = z.object({
  familyId: z.string().min(1),
  subject: SubjectIdSchema,
  knowledgeNode: z.string().min(1),
  dueIso: z.string(),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  lastReviewIso: z.string().nullable(),
});
export type FsrsCardRecord = z.infer<typeof FsrsCardRecordSchema>;
