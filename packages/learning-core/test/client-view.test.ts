import { ClientQuestionViewSchema } from '@pkg/contracts';
import { describe, expect, it } from 'vitest';
import { toClientQuestionView } from '../src/index.js';
import { question } from './fixtures.js';

describe('client answer-key boundary', () => {
  it('uses an allow-list, including nested options and step prompts', () => {
    const q = question({ questionType: 'multi_step_numeric', answerSpec: 'HIDDEN_KEY_ANSWER',
      partialRubric: 'HIDDEN_KEY_PARTIAL', stepsRubric: [{ stepId: 'x', prompt: 'Find x', expected: 987654321, tolerance: 0.12345, weightShare: 1 }] });
    const contaminated = { ...q, futureServerAnswer: 'HIDDEN_KEY_FUTURE', options: [{ key: 'A', text: 'Visible option', expected: 'HIDDEN_KEY_NESTED' }] };
    const view = toClientQuestionView(contaminated);
    const json = JSON.stringify(view);
    for (const hidden_key of ['HIDDEN_KEY_ANSWER', 'HIDDEN_KEY_PARTIAL', 'HIDDEN_KEY_EXPLANATION', 'HIDDEN_KEY_FUTURE', 'HIDDEN_KEY_NESTED', '987654321', '0.12345']) expect(json).not.toContain(hidden_key);
    expect(view.stepsRubric).toEqual([{ stepId: 'x', prompt: 'Find x', weightShare: 1 }]);
    expect(ClientQuestionViewSchema.parse(view)).toEqual(view);
  });
  it('does not return paired matching answers, and independent right choices do not retain answer order', () => {
    const view = toClientQuestionView(question({ questionType: 'matching', answerSpec: 'first=z;second=a',
      matchingPairs: [{ left: 'first', right: 'z' }, { left: 'second', right: 'a' }] }));
    expect(view).not.toHaveProperty('matchingPairs');
    expect(view.matchingLeft).toEqual(['first', 'second']);
    expect(view.matchingRight).toEqual(['a', 'z']);
  });
  it('strips definitions for retrieval and hints for scored phases, but keeps required stems', () => {
    const q = question({ assessmentKind: 'retrieval', allowMaterialReview: false, stemMd: 'Required passage/data', materialMd: 'HIDDEN_KEY_DEFINITION' });
    const view = toClientQuestionView({ ...q, hintMd: 'HIDDEN_KEY_HINT' });
    expect(view.materialMd).toBe(''); expect(view.hintMd).toBe(''); expect(view.stemMd).toBe(q.stemMd);
    expect(toClientQuestionView({ ...q, allowMaterialReview: true }).materialMd).toBe('');
    const practice = toClientQuestionView(question({ stepRole: 'practice', hintMd: 'Practice hint' }));
    expect(practice.hintMd).toBe('Practice hint');
    expect(practice.materialMd).toBe('Reference formula');
  });
  it('returns independent objects that cannot mutate the trusted question', () => {
    const q = question(); const view = toClientQuestionView(q);
    view.options[0]!.key = 'mutated';
    expect(q.options[0]!.key).toBe('A');
  });
});
