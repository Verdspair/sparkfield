import type { QuestionItem } from '@pkg/contracts';
import { add, compare, decimal, ONE, rational, serialize, ZERO, type Rational, type RationalScore } from './rational.js';

export type QuestionAnswer = string | number | readonly string[] | Readonly<Record<string, string | number>>;
export interface QuestionSubmission {
  answer?: QuestionAnswer | null;
  status?: 'submitted' | 'skipped' | 'timed_out';
  questionId?: string;
  hintUsed?: boolean;
}
export type SubmissionInput = QuestionSubmission | QuestionAnswer | null | undefined;
export interface QuestionGrade {
  questionId: string;
  quality: RationalScore;
  isCorrect: boolean;
  isSkipped: boolean;
  stepResults: readonly { stepId: string; isCorrect: boolean; earnedShare: RationalScore }[];
}
function normalize(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase(); }
function text(value: unknown): string | null {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? String(value).trim() : null;
}
function parseEntries(value: unknown): Map<string, string> | null {
  if (typeof value === 'string') {
    const entries = new Map<string, string>();
    for (const part of value.split(';')) {
      const at = part.indexOf('=');
      if (at < 1) return null;
      const key = part.slice(0, at).trim(); const val = part.slice(at + 1).trim();
      if (!val || entries.has(key)) return null;
      entries.set(key, val);
    }
    return entries;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, v]) => text(v) === null)) return null;
  return new Map(entries.map(([k, v]) => [k.trim(), text(v)!]));
}
function numericCorrect(value: unknown, expected: string | number, tolerance: string | number, unit?: string): boolean {
  const tol = decimal(tolerance);
  if (tol.n < 0n) throw new RangeError('Negative numeric tolerance');
  const exp = decimal(expected);
  let input = text(value);
  if (input === null) return false;
  if (unit) {
    const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.+)$/u.exec(input);
    if (!match || normalize(match[2]!) !== normalize(unit)) return false;
    input = match[1]!;
  }
  try {
    const actual = decimal(input);
    const delta = rational(actual.n * exp.d - exp.n * actual.d, actual.d * exp.d);
    return compare({ n: delta.n < 0n ? -delta.n : delta.n, d: delta.d }, tol) <= 0;
  } catch { return false; }
}
function choices(value: unknown): string[] | null {
  const values = typeof value === 'string' ? value.split(/[|,;]/u).map((v) => v.trim()) : Array.isArray(value) ? value : null;
  if (!values || values.some((v) => typeof v !== 'string' || !v.trim())) return null;
  const keys = values.map((v: string) => v.trim());
  return new Set(keys).size === keys.length ? keys : null;
}

export function gradeQuestionSubmission(question: QuestionItem, submission?: SubmissionInput): QuestionGrade {
  let answer: unknown = submission;
  let skipped = submission === undefined || submission === null;
  if (submission && typeof submission === 'object' && !Array.isArray(submission)
      && ('answer' in submission || 'status' in submission || 'questionId' in submission)) {
    const s = submission as QuestionSubmission;
    if (s.questionId !== undefined && s.questionId !== question.questionId) throw new Error('Submission questionId mismatch');
    skipped = s.status === 'skipped' || s.status === 'timed_out' || s.answer == null;
    answer = s.answer;
  }
  if (typeof answer === 'string' && !answer.trim()) skipped = true;
  let quality = ZERO;
  const stepResults: { stepId: string; isCorrect: boolean; earnedShare: RationalScore }[] = [];
  switch (question.questionType) {
    case 'single_choice': {
      const expected = question.answerSpec.trim();
      if (!question.options.some((o) => o.key === expected)) throw new Error('Invalid single-choice answer key');
      if (!skipped && text(answer) === expected) quality = ONE;
      break;
    }
    case 'multi_choice': {
      const expected = choices(question.answerSpec);
      if (!expected?.length || expected.some((key) => !question.options.some((o) => o.key === key))) throw new Error('Invalid multi-choice answer key');
      const selected = choices(answer);
      if (!skipped && selected?.length && selected.every((v) => expected.includes(v))) {
        if (selected.length === expected.length) quality = ONE;
        else if (question.partialRubric === 'partial_all_no_wrong:0.5' || question.partialRubric === 'half') quality = rational(1n, 2n);
      }
      break;
    }
    case 'matching': {
      const expected = question.matchingPairs.length
        ? new Map(question.matchingPairs.map((p) => [p.left, p.right])) : parseEntries(question.answerSpec);
      if (!expected?.size || (question.matchingPairs.length && expected.size !== question.matchingPairs.length)) throw new Error('Invalid matching answer key');
      const selected = parseEntries(answer);
      if (!skipped && selected && [...selected.keys()].every((key) => expected.has(key))) {
        let correct = 0n;
        for (const [left, right] of expected) if (selected.get(left) === right) correct++;
        quality = correct === BigInt(expected.size) ? ONE : question.partialRubric === 'per_pair' ? rational(correct, BigInt(expected.size)) : ZERO;
      }
      break;
    }
    case 'short_fill': {
      const synonyms = question.answerSpec.split('|').map(normalize).filter(Boolean);
      if (!synonyms.length) throw new Error('Empty short-fill answer key');
      const value = text(answer);
      if (!skipped && value !== null && synonyms.includes(normalize(value))) quality = ONE;
      break;
    }
    case 'numeric': {
      const parts = question.answerSpec.split(':');
      if (parts.length > 3 || !parts[0]?.trim() || (parts.length > 1 && !parts[1]?.trim())) throw new Error('Invalid numeric answer key');
      decimal(parts[0]); const tol = decimal(parts[1] ?? '0');
      if (tol.n < 0n) throw new Error('Negative numeric tolerance');
      if (!skipped && numericCorrect(answer, parts[0], parts[1] ?? '0', parts[2])) quality = ONE;
      break;
    }
    case 'multi_step_numeric': {
      if (!question.stepsRubric.length) throw new Error('Missing steps rubric');
      const seen = new Set<string>();
      const selected = parseEntries(answer);
      let total = ZERO;
      for (const step of question.stepsRubric) {
        if (seen.has(step.stepId)) throw new Error('Duplicate rubric stepId');
        seen.add(step.stepId);
        const share = decimal(step.weightShare);
        if (share.n <= 0n || compare(share, ONE) > 0 || decimal(step.tolerance).n < 0n) throw new Error('Invalid rubric share or tolerance');
        decimal(step.expected);
        total = add(total, share);
      }
      if (compare(total, ONE) !== 0) throw new Error('Step rubric shares must sum to exactly one');
      const valid = !skipped && selected && [...selected.keys()].every((key) => seen.has(key));
      for (const step of question.stepsRubric) {
        const correct = !!valid && numericCorrect(selected.get(step.stepId), step.expected, step.tolerance);
        const earned = correct ? decimal(step.weightShare) : ZERO;
        quality = add(quality, earned);
        stepResults.push({ stepId: step.stepId, isCorrect: correct, earnedShare: serialize(earned) });
      }
      break;
    }
    default: throw new Error('Unsupported objective question type');
  }
  return { questionId: question.questionId, quality: serialize(quality), isCorrect: compare(quality, ONE) === 0, isSkipped: skipped, stepResults };
}
