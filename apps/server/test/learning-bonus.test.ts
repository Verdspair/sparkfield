import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoursePackSchema, MODE_BUDGETS, QuestionItemSchema, SEASON1_ITEMS, type UserProfile } from '@pkg/contracts';
import { assertItemConservation, createGame, grantVouchers } from '@pkg/game-core';
import { buildMatchStudyBlueprint, buildPersonalizedLessonBundle } from '@pkg/learning-core';
import type { MatchStartInput } from '../src/ranking/rankingService.js';
import { MatchRoom, type MatchRuntime } from '../src/rooms/matchRoom.js';

const results = [
  { userId: 'full-credit', correct: 3, score: 1500, gold: 15, carry: 0, tier: 'perfect', items: 1, vouchers: 2 },
  { userId: 'three-quarters', correct: 2, score: 1125, gold: 11, carry: 25, tier: 'good', items: 1, vouchers: 0 },
  { userId: 'two-fifths', correct: 1, score: 600, gold: 6, carry: 0, tier: 'base', items: 0, vouchers: 0 },
  { userId: 'full-bag', correct: 3, score: 1500, gold: 15, carry: 0, tier: 'perfect', items: 0, vouchers: 2 },
];

describe('individual learning rewards in a room', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('settles the same mastery quiz by seat, then skips prior grants at the resource sweep', async () => {
    vi.useFakeTimers();
    const room = new MatchRoom();
    room.game = createGame('quick', 4);
    room.game.round = 5;
    room.nodeIndex = 3;
    room.phase = 'learning';
    room.phaseIndex = MODE_BUDGETS.modes.quick.timeline.map(segment => segment.kind).lastIndexOf('learning');
    const persistNode = vi.fn().mockResolvedValue({ rewardPointsGranted: 0, attemptIds: [] });
    room.runtime = { timeScale: 1, learning: { persistNode } } as unknown as MatchRuntime;
    const pack = CoursePackSchema.parse(JSON.parse(readFileSync(new URL('../../../content/courses/compiled/math-core-starter.json', import.meta.url), 'utf8')));
    room.packs = [pack];
    room.start = { matchId: 'mastery-test', coursePackVersion: pack.manifest.coursePackVersion } as MatchStartInput;
    const options = { mode: 'quick', packs: [pack], subject: 'math', now: new Date() } as const;
    const studyBlueprint = buildMatchStudyBlueprint(options);
    const template = buildPersonalizedLessonBundle({ ...options, nodeIndex: room.nodeIndex, queueType: 'solo', selectedSubjects: ['math'], studyBlueprint });
    expect(template.arcMeta.stageKind).toBe('mastery');
    const questions = [8, 7, 5].map((weight, i) => QuestionItemSchema.parse({
      questionId: `verification-${i}`, familyId: 'mastery', subject: 'math', knowledgeNode: 'math',
      stepRole: 'verification', questionType: 'single_choice', assessmentKind: 'retrieval', allowMaterialReview: false,
      options: [{ key: 'A', text: 'Correct' }, { key: 'B', text: 'Incorrect' }],
      weight, stemMd: 'Select the correct answer.', answerSpec: 'A', explanationMd: 'The answer is A.', sourceLicense: 'original',
    }));
    const bundle = { ...template, questions };
    const tracked = results.map((expected, index) => {
      const { userId, correct } = expected;
      const seat = room.game.seats[index]!;
      room['humans'].set(userId, { seatId: seat.id, profile: { userId } as UserProfile });
      room['lessons'].set(userId, {
        bundle, submissions: Object.fromEntries(questions.map(({ questionId }, i) => [questionId, i < correct ? 'A' : 'B'])),
        step: bundle.steps.length, complete: true, readyToProceed: true, feedback: {}, settled: false,
      });
      room['settlements'].set(userId, []);
      room['wrong'].set(userId, new Set());
      room['learningTotals'].set(userId, { rewardPointsGranted: 0, attemptIds: [] });
      if (userId === 'full-credit') grantVouchers(seat, 1, room.game.round);
      if (userId === 'full-bag') {
        const fillers = Array(12 - seat.inventoryItems.length).fill(SEASON1_ITEMS.components[0]!.id);
        seat.inventoryItems.push(...fillers);
        room.game.itemComponentsGranted += fillers.length;
      }
      return { seat, expected, before: structuredClone(seat) };
    });

    room['settleUserLearning']('full-credit');
    room['settleUserLearning']('full-credit');
    expect(persistNode).toHaveBeenCalledTimes(1);
    await room['transition']();
    expect(room.phase).toBe('resource');
    expect(persistNode).toHaveBeenCalledTimes(tracked.length);
    expect(room.failure).toBeNull();

    for (const { seat, expected, before } of tracked) {
      const settlements = room['settlements'].get(expected.userId)!;
      expect(settlements).toHaveLength(1);
      const [settlement] = settlements;
      expect(settlement).toMatchObject({ rawEarnedCents: expected.score, grantedIntegerGold: expected.gold,
        carryOutCents: expected.carry, performanceTier: expected.tier, bonusRerollVouchers: expected.vouchers });
      const items = settlement!.bonusItemIds!;
      expect(items).toHaveLength(expected.items);
      expect(items.every(id => SEASON1_ITEMS.components.some(item => item.id === id))).toBe(true);
      expect(seat.inventoryItems).toEqual([...before.inventoryItems, ...items]);
      expect(seat.inventoryItems.length).toBeLessThanOrEqual(12);
      expect(seat.gold).toBe(before.gold + expected.gold);
      expect(seat.rerollVouchers).toBe(before.rerollVouchers + expected.vouchers);
      expect(seat.voucherRound).toBe(expected.vouchers ? room.game.round : null);
    }
    assertItemConservation(room.game);
  });
});
