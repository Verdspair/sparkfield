import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CoursePackSchema } from '@pkg/contracts';
import { buildPersonalizedLessonBundle, gradeQuestionSubmission } from '@pkg/learning-core';
import { LearningService } from '../src/learning/learningService.js';
import type { AppDatabase } from '../src/db/client.js';

const pack = CoursePackSchema.parse(JSON.parse(readFileSync(new URL('../../../content/courses/compiled/english-core-starter.json', import.meta.url), 'utf8')));
const answerFor = (id: string) => {
  const q = pack.items.find((item) => item.questionId === id)!;
  return q.questionType === 'short_fill' ? q.answerSpec.split('|')[0]! : q.answerSpec;
};

describe('direct remediation is review-only and never rewrites scored evidence', () => {
  it('advances skipped resources through correction and verifies with one persistence call', async () => {
    const service = new LearningService({} as AppDatabase);
    const bundle = buildPersonalizedLessonBundle({ packs: [pack], mode: 'standard', nodeIndex: 0,
      queueType: 'solo', selectedSubjects: ['english'], now: new Date() });
    const check = bundle.questions.find((q) => q.stepRole === 'resource_check')!;
    const submissions = Object.fromEntries(bundle.questions.filter((q) => q.stepRole !== 'verification')
      .map((q) => [q.questionId, { status: 'skipped' as const, answer: null }]));
    const frozenDenominators = structuredClone(bundle.frozenDenominators);
    const resourceBefore = gradeQuestionSubmission(check, submissions[check.questionId]);
    const sessions = (service as unknown as { sessions: Map<string, unknown> }).sessions;
    sessions.set('test', { id: 'test', userId: 'student', bundle, versions: {}, submissions,
      stepIndex: 3, expiresAt: Date.now() + 60_000 });
    const persist = vi.spyOn(service, 'persistNode').mockResolvedValue({ attemptIds: ['attempt'], wrongQuestionIds: [check.questionId],
      rewardPointsGranted: 1, alreadyPersisted: false, feedback: [] });
    const review = service.getDirect('student', 'test');
    expect(review.currentStep.kind).toBe('remediation');
    expect(review.currentStep.corrections.some((c) => c.questionId === check.questionId)).toBe(true);
    await expect(service.submitDirect('student', 'test', check.questionId, { answer: answerFor(check.questionId) })).rejects.toMatchObject({ code: 'QUESTION_NOT_IN_CURRENT_STEP' });
    const verification = await service.advanceDirect('student', 'test');
    expect(verification.currentStep.kind).toBe('verification');
    for (const q of verification.currentStep.questions) {
      await service.submitDirect('student', 'test', q.questionId, { status: 'submitted', answer: answerFor(q.questionId) });
    }
    const last = verification.currentStep.questions.at(-1)!;
    await service.submitDirect('student', 'test', last.questionId, { status: 'submitted', answer: answerFor(last.questionId) });
    await service.advanceDirect('student', 'test');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(service.getDirect('student', 'test').result?.rewardPointsGranted).toBe(1);
    expect(gradeQuestionSubmission(check, submissions[check.questionId])).toEqual(resourceBefore);
    expect(bundle.frozenDenominators).toEqual(frozenDenominators);
    expect(submissions[check.questionId]).toEqual({ status: 'skipped', answer: null });
  });
});
