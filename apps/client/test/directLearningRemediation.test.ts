import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gradeQuestionSubmission } from '@pkg/learning-core';
import { ENGLISH_STARTER_PACK } from '../src/content/starterPacks.js';
import { OfflineDirectLearningSession, OfflinePracticeMatchController } from '../src/offline/offlinePracticeController.js';
import { offlineDb } from '../src/platform/hostBridge.js';
import type { MatchRoomSnapshot } from '../src/api/matchSocket.js';

const answerFor = (id: string) => {
  const q = ENGLISH_STARTER_PACK.items.find((item) => item.questionId === id)!;
  return q.questionType === 'short_fill' ? q.answerSpec.split('|')[0]! : q.answerSpec;
};

describe('offline direct remediation preserves frozen scored evidence', () => {
  beforeEach(() => {
    vi.spyOn(offlineDb, 'transaction').mockImplementation((async (...args: unknown[]) =>
      (args.at(-1) as () => Promise<unknown>)()) as typeof offlineDb.transaction);
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps a skipped resource answer through correction and only persists completion once', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    const add = vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const local = await OfflineDirectLearningSession.create({ subject: 'english', mode: 'standard' });
    let view = await local.advance();
    for (const q of view.currentStep.questions) {
      await local.submit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) });
    }
    view = await local.advance();
    const check = view.currentStep.questions[0]!;
    for (const q of view.currentStep.questions) {
      await local.submit(q.questionId, { status: 'skipped', answer: null });
    }
    const internal = local as unknown as {
      submissions: Record<string, { status: 'submitted' | 'skipped'; answer: string | null }>;
    };
    const resourceBefore = structuredClone(internal.submissions[check.questionId]);
    const scoreBefore = gradeQuestionSubmission(ENGLISH_STARTER_PACK.items.find((q) => q.questionId === check.questionId)!, resourceBefore);
    view = await local.advance();
    expect(view.currentStep.kind).toBe('remediation');
    expect(view.currentStep.corrections.some((c) => c.questionId === check.questionId)).toBe(true);
    await expect(local.submit(check.questionId, { status: 'submitted', answer: answerFor(check.questionId) })).rejects.toThrow();
    expect(internal.submissions[check.questionId]).toEqual(resourceBefore);
    view = await local.advance();
    expect(view.currentStep.kind).toBe('verification');
    for (const q of view.currentStep.questions) {
      view = (await local.submit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) })).session;
    }
    expect(view.completed).toBe(true);
    expect(view.result?.rewardPointsGranted).toBe(0);
    expect(gradeQuestionSubmission(ENGLISH_STARTER_PACK.items.find((q) => q.questionId === check.questionId)!, internal.submissions[check.questionId])).toEqual(scoreBefore);
    expect(internal.submissions[check.questionId]).toEqual(resourceBefore);
    const written = add.mock.calls.length;
    const last = view.currentStep.questions.at(-1)!;
    await expect(local.submit(last.questionId, { status: 'submitted', answer: answerFor(last.questionId) })).rejects.toThrow();
    await local.advance();
    expect(add).toHaveBeenCalledTimes(written);
  });

  it('keeps offline match resource evidence frozen across review and settles it once', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    const add = vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    let snapshot: MatchRoomSnapshot | null = null;
    const local = new OfflinePracticeMatchController({ mode: 'standard', subject: 'english', nickname: '测试',
      listeners: { onSnapshot: (next) => { snapshot = next; } } });
    const view = () => snapshot!;
    try {
      expect(local.sendLearningAdvance()).toEqual({ ok: false, reason: 'LEARNING_WINDOW_CLOSED' });
      await local.start();
      for (let guard = 0; view().phase !== 'learning' && guard < 10; guard++) await local.skipCurrentPhaseWait();
      expect(view().phase).toBe('learning');
      expect(local.sendLearningAdvance()).toEqual({ ok: true });
      while (view().learning?.currentStep === 'practice') {
        const q = view().learning!.clientQuestions[0]!;
        expect(local.sendLearningSubmit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) }).ok).toBe(true);
      }
      expect(local.sendLearningAdvance()).toEqual({ ok: false, reason: 'STEP_REQUIRES_SUBMISSIONS' });
      const check = view().learning!.clientQuestions[0]!;
      while (view().learning?.currentStep === 'resource_check') {
        const q = view().learning!.clientQuestions[0]!;
        expect(local.sendLearningSubmit(q.questionId, { status: 'skipped', answer: null }).ok).toBe(true);
      }
      expect(view().learning?.currentStep).toBe('remediation');
      const internal = local as unknown as { lessonProgress: { bundle: { frozenDenominators: unknown }; submissions: Record<string, unknown> } };
      const original = structuredClone(internal.lessonProgress.submissions[check.questionId]);
      const denominators = structuredClone(internal.lessonProgress.bundle.frozenDenominators);
      expect(local.sendLearningSubmit(check.questionId, { status: 'submitted', answer: answerFor(check.questionId) }).ok).toBe(false);
      expect(internal.lessonProgress.submissions[check.questionId]).toEqual(original);
      expect(local.sendLearningAdvance()).toEqual({ ok: true });
      expect(view().learning?.currentStep).toBe('verification');
      while (!view().learning?.complete) {
        const q = view().learning!.clientQuestions[0]!;
        expect(local.sendLearningSubmit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) }).ok).toBe(true);
      }
      expect(internal.lessonProgress.bundle.frozenDenominators).toEqual(denominators);
      expect(internal.lessonProgress.submissions[check.questionId]).toEqual(original);
      await local.skipCurrentPhaseWait();
      const settlement = view().resourceSettlement;
      const written = add.mock.calls.length;
      expect(view().phase).toBe('resource');
      expect(settlement).toBeTruthy();
      expect(written).toBeGreaterThan(0);
      expect(local.sendLearningAdvance().ok).toBe(false);
      expect(local.sendLearningSubmit(check.questionId, { status: 'submitted', answer: answerFor(check.questionId) }).ok).toBe(false);
      expect(view().resourceSettlement).toEqual(settlement);
      expect(add).toHaveBeenCalledTimes(written);
    } finally {
      local.dispose();
    }
  });
});
