import { describe, expect, it } from 'vitest';
import { activateLessonRemediation, buildPersonalizedLessonBundle, type PersonalizedLessonInput } from '../src/index.js';
import { card, NOW, pack } from './fixtures.js';

const options = (overrides: Partial<PersonalizedLessonInput> = {}): PersonalizedLessonInput => ({
  packs: [pack()], mode: 'quick', nodeIndex: 0, queueType: 'solo', selectedSubjects: ['math'], now: NOW, ...overrides,
});
describe('personalized frozen five-step lessons', () => {
  it('builds the five ordered steps from mode phase budgets and freezes answer-bearing server instances', () => {
    const p = pack(); const bundle = buildPersonalizedLessonBundle(options({ packs: [p] }));
    expect(bundle.steps.map((s) => s.kind)).toEqual(['material', 'practice', 'resource_check', 'remediation', 'verification']);
    expect(bundle.steps.map((s) => s.plannedSeconds)).toEqual([10, 15, 15, 10, 10]);
    expect(bundle.plannedSeconds).toBe(60); expect(bundle.verificationWeightPercent).toBe(30);
    expect(bundle.frozenDenominators).toEqual({ resourceCheckWeight: '10', verificationWeight: '10' });
    expect(bundle.steps[3]!.active).toBe(false);
    expect(bundle.steps[3]!.corrections).toEqual([]);
    expect(Object.isFrozen(bundle.questions)).toBe(true);
    expect(Object.isFrozen(bundle.questions[0]!.options)).toBe(true);
    const original = bundle.questions[0]!.stemMd;
    p.items.find((q) => q.questionId === bundle.questions[0]!.questionId)!.stemMd = 'changed source';
    expect(bundle.questions[0]!.stemMd).toBe(original);
    expect(JSON.stringify(bundle.clientQuestions)).not.toContain('HIDDEN_KEY_EXPLANATION');
  });
  it('starts a new account at its self-selected progress, not obligatorily at the first node', () => {
    const bundle = buildPersonalizedLessonBundle(options({ packs: [pack('math', ['n1', 'n2'])],
      progress: [{ subject: 'math', knowledgeNode: 'n2', familiarity: 'familiar' }] }));
    expect(bundle.questions.every((q) => q.knowledgeNode === 'n2')).toBe(true);
    expect(() => buildPersonalizedLessonBundle(options({ progress: [{ subject: 'math', knowledgeNode: 'missing' }] }))).toThrow('progress');
  });
  it('does not silently advance into a locked future chapter', () => {
    const bundle = buildPersonalizedLessonBundle(options({ packs: [pack('math', ['n1', 'n2'])] }));
    expect(bundle.questions.every((q) => q.knowledgeNode === 'n1')).toBe(true);
  });
  it('uses overdue FSRS state/retrievability for review even outside the current chapter', () => {
    const bundle = buildPersonalizedLessonBundle(options({ packs: [pack('math', ['n1', 'n2'])],
      progress: [{ subject: 'math', knowledgeNode: 'n2' }], cards: [card({ familyId: 'math_n1_f2', stability: 0.2 })] }));
    expect(bundle.questions.every((q) => q.familyId === 'math_n1_f2')).toBe(true);
    expect(bundle.selectionEvidence[0]).toMatchObject({ due: true });
    expect(bundle.selectionEvidence[0]!.retrievability).toBeLessThan(0.9);
  });
  it('responds to independent accuracy, hint dependence, and correction evidence without a fixed review quota', () => {
    const base = buildPersonalizedLessonBundle(options());
    const weak = buildPersonalizedLessonBundle(options({ recentPerformance: [
      { familyId: 'math_n1_f1', independentAccuracy: 0.1, hintRate: 0.9, remediationAccuracy: 0.2 },
    ] }));
    expect(base.questions[0]!.familyId).toBe('math_n1_f2');
    expect(weak.questions.every((q) => q.familyId === 'math_n1_f1')).toBe(true);
  });
  it('ranked requires exactly the room subject; casual/solo may select both subjects', () => {
    expect(() => buildPersonalizedLessonBundle(options({ queueType: 'ranked', selectedSubjects: ['math', 'english'], rankedSubject: 'math' }))).toThrow('Ranked');
    expect(() => buildPersonalizedLessonBundle(options({ queueType: 'ranked', rankedSubject: 'english' }))).toThrow('Ranked');
    const ranked = buildPersonalizedLessonBundle(options({ queueType: 'ranked', rankedSubject: 'math' }));
    expect(ranked.subjects).toEqual(['math']);
    for (const queueType of ['casual', 'solo'] as const) {
      const bundle = buildPersonalizedLessonBundle(options({ packs: [pack(), pack('english')], queueType, selectedSubjects: ['math', 'english'] }));
      expect(new Set(bundle.questions.map((q) => q.subject))).toEqual(new Set(['math', 'english']));
    }
  });
  it('activates corrections only after observed error/skip or final missing submission, never reselects questions', () => {
    const bundle = buildPersonalizedLessonBundle(options());
    const correctAnswers = Object.fromEntries(bundle.questions.map((q) => [q.questionId, 'A']));
    expect(activateLessonRemediation(bundle, correctAnswers, true).steps[3]!.active).toBe(false);
    expect(activateLessonRemediation(bundle, {}, false).steps[3]!.active).toBe(false);
    for (const role of ['practice', 'verification']) {
      const q = bundle.questions.find((q) => q.stepRole === role)!;
      expect(activateLessonRemediation(bundle, { [q.questionId]: 'B' }).steps[3]!.active).toBe(false);
    }
    const resource = bundle.questions.find((q) => q.stepRole === 'resource_check')!;
    const wrong = activateLessonRemediation(bundle, { [resource.questionId]: 'B' });
    expect(wrong.steps[3]!.active).toBe(true);
    expect(wrong.steps[3]!.questionIds).toEqual([resource.questionId]);
    expect(wrong.steps[3]!.corrections[0]!.explanationMd).toBe('HIDDEN_KEY_EXPLANATION');
    expect(wrong.questions).toBe(bundle.questions);
    expect(wrong.frozenDenominators).toBe(bundle.frozenDenominators);
    const finalMissing = activateLessonRemediation(bundle, {}, true);
    expect(finalMissing.steps[3]!.questionIds).toHaveLength(bundle.questions.filter((q) => q.stepRole === 'resource_check').length);
    const initial = buildPersonalizedLessonBundle(options({ submissions: {}, assessmentComplete: true }));
    expect(initial.steps[3]!.active).toBe(true);
  });
  it('does not reuse consumed question instances and fails loudly if required variants run out', () => {
    const first = buildPersonalizedLessonBundle(options());
    const next = buildPersonalizedLessonBundle(options({ usedQuestionIds: first.questions.map((q) => q.questionId) }));
    expect(next.questions.every((q) => !first.questions.some((old) => old.questionId === q.questionId))).toBe(true);
    expect(() => buildPersonalizedLessonBundle(options({ usedQuestionIds: pack().items.map((q) => q.questionId) }))).toThrow('Insufficient');
  });
  it('rejects invalid scope, rates, and duplicate/question identities', () => {
    expect(() => buildPersonalizedLessonBundle(options({ selectedSubjects: [] }))).toThrow();
    expect(() => buildPersonalizedLessonBundle(options({ recentPerformance: [{ familyId: 'f1', independentAccuracy: 2, hintRate: 0 }] }))).toThrow();
    const p = pack(); p.items.push(p.items[0]!);
    expect(() => buildPersonalizedLessonBundle(options({ packs: [p] }))).toThrow('Duplicate');
    expect(() => buildPersonalizedLessonBundle(options({ cards: [card({ familyId: 'math_n1_f1', subject: 'english' })] }))).toThrow('scope');
  });
});
