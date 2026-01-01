import { MODE_BUDGETS, type DivmodGoldSettlement, type DurationMode, type LessonStepKind, type QuestionItem } from '@pkg/contracts';
import { gradeQuestionSubmission, type SubmissionInput } from './grading.js';
import { add, compare, divide, integer, multiply, ONE, rational, safeInteger, serialize, wireInteger, ZERO, type Rational, type RationalScore } from './rational.js';

export type SubmissionMap = Readonly<Record<string, SubmissionInput>>;
export interface GradedLearningUnit {
  questionId?: string;
  stepRole: LessonStepKind;
  weight: number;
  quality: RationalScore;
  status?: 'submitted' | 'skipped' | 'timed_out';
  isSkipped?: boolean;
}
export interface LearningNodeGoldInput {
  mode: DurationMode;
  blockIndex: number;
  gradedUnits: readonly GradedLearningUnit[];
  carryInCents?: number;
}
export interface QuestionNodeGoldInput {
  mode: DurationMode;
  nodeIndex: number;
  questions: readonly QuestionItem[];
  submissions: SubmissionMap;
  carryInCents?: number;
}
export interface LearningGoldSettlement extends DivmodGoldSettlement {
  exactScore: RationalScore;
  verificationWeightPercent: number;
}
export function learningNodePolicy(mode: DurationMode, nodeIndex: number) {
  const config = MODE_BUDGETS.modes[mode];
  if (!config || !Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= config.learning.length) throw new RangeError('Unknown learning node');
  return {
    centBudget: config.learning_gold_cap_by_block_cents[nodeIndex]!,
    verificationWeightPercent: config.verification_weight_percent_by_block[nodeIndex]!,
    phaseSeconds: config.learning_detail[nodeIndex]!.seconds_by_phase,
    plannedSeconds: config.learning[nodeIndex]!,
  };
}
export function gradeFrozenLearningUnits(questions: readonly QuestionItem[], submissions: SubmissionMap): GradedLearningUnit[] {
  return questions.map((q) => {
    const result = gradeQuestionSubmission(q, Object.hasOwn(submissions, q.questionId) ? submissions[q.questionId] : undefined);
    return { questionId: q.questionId, stepRole: q.stepRole, weight: q.weight, quality: result.quality, isSkipped: result.isSkipped };
  });
}
function roleScore(units: readonly GradedLearningUnit[]): Rational {
  let numerator = ZERO;
  let denominator = 0n;
  for (const unit of units) {
    const weight = integer(unit.weight, 'Question weight', 1);
    denominator += weight;
    const quality = rational(BigInt(unit.quality.numerator), BigInt(unit.quality.denominator));
    if (compare(quality, ZERO) < 0 || compare(quality, ONE) > 0) throw new RangeError('Quality must be in [0,1]');
    if (unit.isSkipped || unit.status === 'skipped' || unit.status === 'timed_out') continue;
    numerator = add(numerator, multiply(rational(weight), quality));
  }
  return denominator === 0n ? ZERO : divide(numerator, rational(denominator));
}
export function settleLearningNodeGold(input: LearningNodeGoldInput | QuestionNodeGoldInput): LearningGoldSettlement {
  const index = 'blockIndex' in input ? input.blockIndex : input.nodeIndex;
  const policy = learningNodePolicy(input.mode, index);
  const units = 'gradedUnits' in input ? input.gradedUnits : gradeFrozenLearningUnits(input.questions, input.submissions);
  const carry = integer(input.carryInCents ?? 0, 'carryInCents', 0, 99);
  const seen = new Set<string>();
  for (const unit of units) {
    if (unit.questionId !== undefined) {
      if (seen.has(unit.questionId)) throw new Error('Duplicate frozen questionId');
      seen.add(unit.questionId);
    }
  }
  const resource = roleScore(units.filter((q) => q.stepRole === 'resource_check'));
  const verification = roleScore(units.filter((q) => q.stepRole === 'verification'));
  const v = BigInt(policy.verificationWeightPercent);
  const score = add(multiply(resource, rational(100n - v, 100n)), multiply(verification, rational(v, 100n)));
  const earned = BigInt(policy.centBudget) * score.n / score.d;
  const total = earned + carry;
  const gold = total / 100n;
  const carryOut = total % 100n;
  const orbSplits: number[] = [];
  let remaining = gold;
  while (remaining > 0n) { const orb = remaining >= 2n ? 2n : 1n; orbSplits.push(safeInteger(orb)); remaining -= orb; }
  return {
    nodeIndex: index, centBudget: policy.centBudget,
    scoreNumerator: wireInteger(score.n), scoreDenominator: wireInteger(score.d),
    exactScore: serialize(score), verificationWeightPercent: policy.verificationWeightPercent,
    rawEarnedCents: safeInteger(earned), carryInCents: safeInteger(carry),
    grantedIntegerGold: safeInteger(gold), orbSplits, carryOutCents: safeInteger(carryOut),
  };
}
export function finalizeLearningGoldCarry(carryInCents: number): {
  discardedCarryCents: number; carryOutCents: 0; grantedIntegerGold: 0;
} {
  integer(carryInCents, 'carryInCents', 0, 99);
  return { discardedCarryCents: carryInCents, carryOutCents: 0, grantedIntegerGold: 0 };
}
