import { describe, expect, it } from 'vitest';
import { gradeQuestionSubmission } from '../src/index.js';
import { question } from './fixtures.js';

const score = (numerator: string, denominator = '1') => ({ numerator, denominator });
describe('objective question grading', () => {
  it('grades single-choice keys, not option text or arrays', () => {
    const q = question();
    expect(gradeQuestionSubmission(q, 'A').quality).toEqual(score('1'));
    for (const value of ['B', 'first', ['A']]) expect(gradeQuestionSubmission(q, value).quality).toEqual(score('0'));
  });
  it.each([undefined, null, '', { status: 'skipped' as const, answer: 'A' }, { status: 'timed_out' as const, answer: 'A' }])('keeps omitted/skipped/timed-out work at zero: %j', (value) => {
    expect(gradeQuestionSubmission(question(), value)).toMatchObject({ quality: score('0'), isSkipped: true, isCorrect: false });
  });
  it('accepts envelopes but rejects mismatched question identity', () => {
    expect(gradeQuestionSubmission(question(), { questionId: 'q1', answer: 'A' }).isCorrect).toBe(true);
    expect(() => gradeQuestionSubmission(question(), { questionId: 'other', answer: 'A' })).toThrow('mismatch');
  });
  it('grades multi-choice as exact sets with a fixed half for a nonempty proper subset', () => {
    const q = question({ questionType: 'multi_choice', answerSpec: 'A|C', partialRubric: 'partial_all_no_wrong:0.5' });
    expect(gradeQuestionSubmission(q, ['C', 'A']).quality).toEqual(score('1'));
    expect(gradeQuestionSubmission(q, 'A').quality).toEqual(score('1', '2'));
    for (const value of [['A', 'B'], ['A', 'A'], [], ['D'], 'A|B|C']) expect(gradeQuestionSubmission(q, value).quality).toEqual(score('0'));
    expect(gradeQuestionSubmission({ ...q, partialRubric: '' }, ['A']).quality).toEqual(score('0'));
  });
  it('matching per_pair preserves the full frozen pair denominator', () => {
    const q = question({ questionType: 'matching', options: [], answerSpec: 'l1=r1;l2=r2;l3=r3',
      matchingPairs: [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r2' }, { left: 'l3', right: 'r3' }], partialRubric: 'per_pair' });
    expect(gradeQuestionSubmission(q, { l1: 'r1', l3: 'r3' }).quality).toEqual(score('2', '3'));
    expect(gradeQuestionSubmission(q, 'l1=r1;l2=r2;l3=r3').isCorrect).toBe(true);
    expect(gradeQuestionSubmission(q, 'l1=r1;l1=r1').quality).toEqual(score('0'));
    expect(gradeQuestionSubmission(q, { alien: 'r1', l1: 'r1' }).quality).toEqual(score('0'));
    expect(gradeQuestionSubmission({ ...q, partialRubric: '' }, { l1: 'r1' }).quality).toEqual(score('0'));
  });
  it('short-fill accepts only declared synonyms, with case/space/Unicode normalization', () => {
    const q = question({ questionType: 'short_fill', answerSpec: 'inspect|check|switch off' });
    for (const value of ['  CHECK ', 'ＩＮＳＰＥＣＴ', 'Switch   off']) expect(gradeQuestionSubmission(q, value).isCorrect).toBe(true);
    for (const value of ['checks', 'inspection', 'inspect check']) expect(gradeQuestionSubmission(q, value).isCorrect).toBe(false);
  });
  it('compares decimal numeric tolerance exactly and includes its boundary', () => {
    const q = question({ questionType: 'numeric', answerSpec: '0.3:0.2' });
    for (const value of ['0.1', '0.5', '.3', '3e-1']) expect(gradeQuestionSubmission(q, value).isCorrect).toBe(true);
    for (const value of ['0.5000000000000001', '0.0999999999999999', 'NaN', 'Infinity', '0x10', '3abc', '']) expect(gradeQuestionSubmission(q, value).isCorrect).toBe(false);
    expect(gradeQuestionSubmission(question({ questionType: 'numeric', answerSpec: '0.0000000000000000001:0' }), '1e-19').isCorrect).toBe(true);
  });
  it('requires explicit units when the numeric spec declares a unit', () => {
    const q = question({ questionType: 'numeric', answerSpec: '50:0.01:m2' });
    expect(gradeQuestionSubmission(q, '50 m2').isCorrect).toBe(true);
    expect(gradeQuestionSubmission(q, '50').isCorrect).toBe(false);
    expect(gradeQuestionSubmission(q, '50 cm2').isCorrect).toBe(false);
  });
  it('adds multi-step rubric shares as BigInt rationals without floating-point drift', () => {
    const q = question({ questionType: 'multi_step_numeric', answerSpec: 'x=1;y=2;z=3', stepsRubric: [
      { stepId: 'x', prompt: 'x', expected: 1, tolerance: 0, weightShare: 0.1 },
      { stepId: 'y', prompt: 'y', expected: 2, tolerance: 0, weightShare: 0.2 },
      { stepId: 'z', prompt: 'z', expected: 3, tolerance: 0, weightShare: 0.7 },
    ] });
    expect(gradeQuestionSubmission(q, { x: 1, y: 2 }).quality).toEqual(score('3', '10'));
    expect(gradeQuestionSubmission(q, 'x=1;y=2;z=3').quality).toEqual(score('1'));
    expect(gradeQuestionSubmission(q, { x: 1, unknown: 0 }).quality).toEqual(score('0'));
    expect(gradeQuestionSubmission(q, { status: 'timed_out', answer: { x: 1, y: 2, z: 3 } }).quality).toEqual(score('0'));
  });
  it('retains exact scores whose denominators exceed safe-number precision', () => {
    const q = question({ questionType: 'multi_step_numeric', answerSpec: 'x=1;y=2', stepsRubric: [
      { stepId: 'x', prompt: 'x', expected: 1, tolerance: 0, weightShare: 0.3333333333333333 },
      { stepId: 'y', prompt: 'y', expected: 2, tolerance: 0, weightShare: 0.6666666666666667 },
    ] });
    expect(gradeQuestionSubmission(q, { x: 1 }).quality).toEqual(score('3333333333333333', '10000000000000000'));
  });
  it('rejects invalid trusted answer keys/rubrics rather than inventing grades', () => {
    expect(() => gradeQuestionSubmission(question({ answerSpec: 'Z' }), 'Z')).toThrow();
    expect(() => gradeQuestionSubmission(question({ questionType: 'numeric', answerSpec: '1:-1' }), '1')).toThrow();
    expect(() => gradeQuestionSubmission(question({ questionType: 'multi_step_numeric', answerSpec: 'x=1', stepsRubric: [
      { stepId: 'x', prompt: 'x', expected: 1, tolerance: 0, weightShare: 0.3 },
    ] }), { x: 1 })).toThrow('exactly one');
  });
});
