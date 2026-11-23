import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODE_BUDGETS, type FsrsCardRecord } from '@pkg/contracts';
import { getRoundPairings } from '@pkg/game-core';
import * as learningCore from '@pkg/learning-core';
import { ENGLISH_STARTER_PACK } from '../src/content/starterPacks.js';
import { OfflineDirectLearningSession, OfflinePracticeMatchController } from '../src/offline/offlinePracticeController.js';
import { offlineDb } from '../src/platform/hostBridge.js';
import type { MatchLearningView } from '../src/api/matchSocket.js';

const answerFor = (id: string) => {
  const q = ENGLISH_STARTER_PACK.items.find((item) => item.questionId === id)!;
  return q.questionType === 'short_fill' ? q.answerSpec.split('|')[0]! : q.answerSpec;
};

async function advanceToLearning(local: OfflinePracticeMatchController, nodeIndex: number): Promise<MatchLearningView> {
  for (const _ of MODE_BUDGETS.modes[local.mode].timeline) {
    const view = local.getSnapshot();
    if (view.phase === 'learning' && view.nodeIndex === nodeIndex && view.learning) return view.learning;
    if (view.phase === 'battle') await vi.advanceTimersByTimeAsync(view.deadlineEpochMs - Date.now());
    else await local.skipCurrentPhaseWait();
  }
  throw new Error(`Learning slot ${nodeIndex} not found`);
}

function advancePastMaterial(local: OfflinePracticeMatchController): MatchLearningView {
  if (local.getSnapshot().learning?.currentStep === 'material') {
    expect(local.sendLearningAdvance()).toEqual({ ok: true });
  }
  return local.getSnapshot().learning!;
}

describe('offline learning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(offlineDb, 'transaction').mockImplementation((async (...args: unknown[]) =>
      (args.at(-1) as () => Promise<unknown>)()) as typeof offlineDb.transaction);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('opens offline preparation during waits and after the current choice is resolved', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const local = new OfflinePracticeMatchController({ mode: 'deep', subject: 'english', seed: 42,
      listeners: { onSnapshot: () => {} } });
    const toggleShop = () => local.sendCommand({ type: 'TOGGLE_LOCK_SHOP' });
    const blocked = { ok: false, reason: 'STRATEGY_PHASE_REQUIRED' };
    const advanceTo = async (phase: 'choice' | 'rest', round: number) => {
      for (const _ of MODE_BUDGETS.modes.deep.timeline) {
        const view = local.getSnapshot();
        if (view.phase === phase && view.round === round) return view;
        if (view.phase === 'battle') await vi.advanceTimersByTimeAsync(view.deadlineEpochMs - Date.now());
        else await local.skipCurrentPhaseWait();
      }
      throw new Error(`Phase ${phase} not found in round ${round}`);
    };
    try {
      await local.start();
      const entry = local.getSnapshot();
      expect(entry.phase).toBe('entry');
      expect(local.sendCommand({ type: 'BUY_CARD', shopIndex: entry.self.shop.findIndex((unit) => unit !== null) })).toEqual({ ok: true });
      const instanceId = local.getSnapshot().self.units.find((unit) => unit.location.zone === 'bench')!.instanceId;
      expect(local.sendCommand({ type: 'MOVE_UNIT', instanceId, to: { zone: 'board', row: 0, col: 0 } })).toEqual({ ok: true });
      await local.skipCurrentPhaseWait();
      expect(local.getSnapshot().phase).toBe('learning');
      expect(toggleShop()).toEqual(blocked);
      await local.skipCurrentPhaseWait();
      expect(local.getSnapshot().phase).toBe('resource');
      expect(toggleShop()).toEqual({ ok: true });

      const augment = await advanceTo('choice', 2);
      expect(augment.self.augmentOffer).not.toBeNull();
      expect(toggleShop()).toEqual(blocked);
      expect(local.sendCommand({ type: 'PICK_AUGMENT', slotIndex: 0 })).toEqual({ ok: true });
      expect(local.getSnapshot()).toMatchObject({ phase: 'choice', self: { augmentOffer: null } });
      expect(toggleShop()).toEqual({ ok: true });

      const anvil = await advanceTo('choice', 3);
      expect(anvil.self.anvils.length).toBeGreaterThan(0);
      for (const { instanceId: anvilInstanceId } of anvil.self.anvils) {
        expect(toggleShop()).toEqual(blocked);
        expect(local.sendCommand({ type: 'PICK_ANVIL_OPTION', anvilInstanceId, optionIndex: 0 })).toEqual({ ok: true });
      }
      expect(local.getSnapshot()).toMatchObject({ phase: 'choice', self: { anvils: [] } });
      expect(toggleShop()).toEqual({ ok: true });
      await advanceTo('rest', 4);
      expect(toggleShop()).toEqual({ ok: true });
    } finally { local.dispose(); }
  });

  it('waits through the whole offline round and rejects skipping the last battle', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    const onBattle = vi.fn();
    const local = new OfflinePracticeMatchController({ mode: 'quick', subject: 'english', seed: 42,
      listeners: { onSnapshot: () => {}, onBattle } });
    try {
      await local.start();
      while (local.getSnapshot().phase !== 'strategy') await local.skipCurrentPhaseWait();
      const game = local['game'];
      const [tankPair] = getRoundPairings('quick', game.round, game.seatOrder);
      for (const seat of game.seats) {
        seat.units = tankPair!.includes(seat.id)
          ? [{ ...seat.units[0]!, unitId: 'S01', bonusHp: 10_000, location: { zone: 'board', row: 0, col: 3 } }]
          : [];
      }
      await local.skipCurrentPhaseWait();
      const { phase, battle, deadlineEpochMs } = local.getSnapshot();
      expect(phase).toBe('battle');
      expect(battle).toMatchObject({ startedAtEpochMs: Date.now(), longestBattleMs: 45_000, overtimeAtMs: 30_000 });
      expect(onBattle).toHaveBeenCalledExactlyOnceWith(battle);
      expect(deadlineEpochMs - Date.now()).toBe(46_800);
      await local.skipCurrentPhaseWait();
      await vi.advanceTimersByTimeAsync(46_799);
      expect(local.getSnapshot().phase).toBe('battle');
      expect(game.settledRounds).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(local.getSnapshot()).toMatchObject({ phase: 'settlement', battle: null });
      expect(game.settledRounds).toEqual([1]);
    } finally { local.dispose(); }
  });

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
    const scoreBefore = learningCore.gradeQuestionSubmission(ENGLISH_STARTER_PACK.items.find((q) => q.questionId === check.questionId)!, resourceBefore);
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
    expect(learningCore.gradeQuestionSubmission(ENGLISH_STARTER_PACK.items.find((q) => q.questionId === check.questionId)!, internal.submissions[check.questionId])).toEqual(scoreBefore);
    expect(internal.submissions[check.questionId]).toEqual(resourceBefore);
    const written = add.mock.calls.length;
    const last = view.currentStep.questions.at(-1)!;
    await expect(local.submit(last.questionId, { status: 'submitted', answer: answerFor(last.questionId) })).rejects.toThrow();
    await local.advance();
    expect(add).toHaveBeenCalledTimes(written);
  });

  it('keeps offline match resource evidence frozen across review and settles it once', async () => {
    const family = ENGLISH_STARTER_PACK.items[0]!;
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([{
      familyId: family.familyId, subject: 'english', knowledgeNode: family.knowledgeNode,
      dueIso: '2024-01-01T00:00:00.000Z', lastReviewIso: '2023-12-30T00:00:00.000Z',
      stability: 2, difficulty: 5, reps: 2, lapses: 1, state: 2,
    }]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    const add = vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const local = new OfflinePracticeMatchController({ mode: 'deep', subject: 'english', nickname: '测试',
      seed: 42, listeners: { onSnapshot: () => {} } });
    const view = () => local.getSnapshot();
    try {
      expect(local.sendLearningAdvance()).toEqual({ ok: false, reason: 'LEARNING_WINDOW_CLOSED' });
      await local.start();
      await advanceToLearning(local, 0);
      const intro = advancePastMaterial(local);
      for (const q of intro.clientQuestions) {
        expect(local.sendLearningSubmit(q.questionId, { status: 'submitted', answer: 'not the answer' }).ok).toBe(true);
      }
      await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(intro.clientQuestions.length));
      add.mockClear();
      const adaptive = await advanceToLearning(local, 1);
      expect(adaptive.arcMeta).toMatchObject({ stageKind: 'remediate', adaptiveBranch: 'remediation_inserted', slotsPerArc: 3 });
      const assessment = advancePastMaterial(local);
      expect(assessment.currentStep).toBe('resource_check');
      expect(local.sendLearningAdvance()).toEqual({ ok: false, reason: 'STEP_REQUIRES_SUBMISSIONS' });
      const check = assessment.clientQuestions[0]!;
      for (const q of assessment.clientQuestions) {
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
      const verification = view().learning!.clientQuestions;
      for (const q of verification) {
        expect(local.sendLearningSubmit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) }).ok).toBe(true);
      }
      expect(internal.lessonProgress.bundle.frozenDenominators).toEqual(denominators);
      expect(internal.lessonProgress.submissions[check.questionId]).toEqual(original);
      await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(assessment.clientQuestions.length + verification.length));
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

  it('awards perfect mastery drops once and keeps vouchers usable in the strategy window', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const local = new OfflinePracticeMatchController({ mode: 'quick', subject: 'english', seed: 42,
      listeners: { onSnapshot: () => {} } });
    try {
      await local.start();
      const mastery = await advanceToLearning(local, 3);
      const before = local.getSnapshot().self;
      expect(mastery.arcMeta?.stageKind).toBe('mastery');
      const assessment = advancePastMaterial(local);
      expect(assessment.currentStep).toBe('verification');
      expect(assessment.clientQuestions.length).toBeGreaterThan(0);
      for (const q of assessment.clientQuestions) {
        expect(local.sendLearningSubmit(q.questionId, { status: 'submitted', answer: answerFor(q.questionId) }).ok).toBe(true);
      }
      const reward = local.getSnapshot();
      expect(reward.phase).toBe('resource');
      expect(reward.resourceSettlement).toMatchObject({ grantedIntegerGold: 15, rawEarnedCents: 1500, performanceTier: 'perfect', bonusRerollVouchers: 2 });
      const items = reward.resourceSettlement!.bonusItemIds!;
      expect(items).toHaveLength(1);
      expect(reward.self.inventoryItems).toEqual([...before.inventoryItems, ...items]);
      expect(reward.self.gold).toBe(before.gold + 15);
      expect(reward.self.rerollVouchers).toBe(before.rerollVouchers + 2);
      expect(reward.self.voucherRound).toBe(reward.round);

      local['phaseIndex'] -= 1;
      await local.skipCurrentPhaseWait();
      expect(local.getSnapshot().resourceSettlement).toEqual(reward.resourceSettlement);
      expect(local.getSnapshot().self).toEqual(reward.self);
      expect(local['settlements'].filter(result => result.nodeIndex === 3)).toHaveLength(1);

      while (local.getSnapshot().phase !== 'strategy') await local.skipCurrentPhaseWait();
      const prep = local.getSnapshot().self;
      expect(prep.rerollVouchers).toBe(reward.self.rerollVouchers);
      expect(local.sendCommand({ type: 'REFRESH_SHOP' })).toEqual({ ok: true });
      expect(local.getSnapshot().self).toMatchObject({ gold: prep.gold, rerollVouchers: prep.rerollVouchers - 1 });
    } finally {
      local.dispose();
    }
  });

  it('keeps the opening study inputs and limits attempts to the current arc', async () => {
    const startNode = ENGLISH_STARTER_PACK.manifest.knowledgeGraph[1]!.nodeId;
    const family = ENGLISH_STARTER_PACK.items.find((q) => q.knowledgeNode === startNode)!;
    const card: FsrsCardRecord = {
      familyId: family.familyId, subject: 'english', knowledgeNode: startNode,
      dueIso: '2024-01-01T00:00:00.000Z', lastReviewIso: '2023-12-30T00:00:00.000Z',
      stability: 2, difficulty: 5, reps: 2, lapses: 1, state: 2,
    };
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValueOnce([card]).mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const buildBlueprint = vi.spyOn(learningCore, 'buildMatchStudyBlueprint');
    const buildLesson = vi.spyOn(learningCore, 'buildPersonalizedLessonBundle');
    const local = new OfflinePracticeMatchController({ mode: 'standard', subject: 'english', seed: 42,
      learningStartSelections: { english: startNode }, listeners: { onSnapshot: () => {} } });
    const inputFor = (index: number) => buildLesson.mock.calls.find(([input]) => input.nodeIndex === index)![0];
    const selectedIds = (view: MatchLearningView) => view.steps.flatMap((step) => step.questionIds);
    try {
      await local.start();
      await local.start();
      expect(buildBlueprint).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        mode: 'standard', subject: 'english', seed: 42, cards: [card],
        progress: [{ subject: 'english', knowledgeNode: startNode }],
      }));

      const intro = await advanceToLearning(local, 0);
      const blueprint = intro.blueprint;
      expect(blueprint).toMatchObject({ arcCount: 4, slotsPerArc: 2 });
      expect(intro.arcMeta).toMatchObject({ arcIndex: 0, slotInArc: 0, stageKind: 'intro' });
      const wrong = advancePastMaterial(local).clientQuestions[0]!;
      const wrongGrade = local.sendLearningSubmit(wrong.questionId, { status: 'submitted', answer: 'not the answer' });
      expect(wrongGrade.feedback).toMatchObject({ isCorrect: false, isSkipped: false });

      expect(wrong).toMatchObject({ assessmentKind: 'application', allowMaterialReview: true });
      expect(wrong.materialMd).not.toBe('');
      const mastery = await advanceToLearning(local, 1);
      expect(mastery.blueprint).toEqual(blueprint);
      expect(mastery.arcMeta).toMatchObject({ arcIndex: 0, slotInArc: 1, stageKind: 'mastery' });
      expect(mastery.currentStep).toBe('verification');
      expect(mastery.steps.filter(step => step.active).map(step => step.kind)).toEqual(['verification']);
      expect(mastery.clientQuestions[0]).toMatchObject({ familyId: wrong.familyId, allowMaterialReview: false, materialMd: '' });
      expect(mastery.clientQuestions[0]!.questionId).not.toBe(wrong.questionId);
      expect(inputFor(1).usedQuestionIds).toEqual(selectedIds(intro));
      expect(inputFor(1).priorArcAttempts).toEqual([
        { questionId: wrong.questionId, familyId: wrong.familyId, isCorrect: false, slotInArc: 0 },
      ]);

      const nextArc = await advanceToLearning(local, 2);
      expect(nextArc.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 0, stageKind: 'intro' });
      expect(nextArc.blueprint).toEqual(blueprint);
      expect(inputFor(2).usedQuestionIds).toEqual([...new Set([intro, mastery].flatMap(selectedIds))]);
      expect(inputFor(2).priorArcAttempts).toEqual([]);
      const last = await advanceToLearning(local, 7);
      expect(last.arcMeta).toMatchObject({ arcIndex: 3, slotInArc: 1, stageKind: 'mastery' });
      expect(buildBlueprint).toHaveBeenCalledTimes(1);
      expect(buildLesson).toHaveBeenCalledTimes(8);
      const [opening] = buildBlueprint.mock.calls[0]!;
      for (const [input] of buildLesson.mock.calls) {
        expect(input.studyBlueprint).toBe(buildBlueprint.mock.results[0]!.value);
        expect(input.cards).toBe(opening.cards);
        expect(input.now).toBe(opening.now);
      }
    } finally {
      local.dispose();
    }
  });

  it('resets attempts but retains question IDs when a short deep-match arc ends', async () => {
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('local-card');
    vi.spyOn(offlineDb.offlineAttempts, 'add').mockResolvedValue(1);
    const buildLesson = vi.spyOn(learningCore, 'buildPersonalizedLessonBundle');
    const local = new OfflinePracticeMatchController({ mode: 'deep', subject: 'math', seed: 42,
      listeners: { onSnapshot: () => {} } });
    try {
      await local.start();
      const secondArc = await advanceToLearning(local, 4);
      expect(secondArc.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 0, slotsPerArc: 3 });
      const question = advancePastMaterial(local).clientQuestions[0]!;
      expect(local.sendLearningSubmit(question.questionId, { status: 'submitted', answer: 'not the answer' }).ok).toBe(true);

      const secondArcLast = await advanceToLearning(local, 6);
      expect(secondArcLast.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 2, stageKind: 'mastery' });
      expect(buildLesson.mock.lastCall?.[0].priorArcAttempts).toEqual([
        { questionId: question.questionId, familyId: question.familyId, isCorrect: false, slotInArc: 0 },
      ]);

      const thirdArc = await advanceToLearning(local, 7);
      expect(thirdArc.arcMeta).toMatchObject({ arcIndex: 2, slotInArc: 0, slotsPerArc: 3 });
      expect(buildLesson.mock.lastCall?.[0]).toMatchObject({
        usedQuestionIds: expect.arrayContaining([question.questionId]),
        priorArcAttempts: [],
      });

      const last = await advanceToLearning(local, 9);
      expect(last.arcMeta).toMatchObject({ arcIndex: 2, slotInArc: 2, stageKind: 'mastery' });
      expect(buildLesson).toHaveBeenCalledTimes(10);
    } finally {
      local.dispose();
    }
  });
});
