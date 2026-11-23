import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoursePackSchema, MODE_BUDGETS, type UserProfile } from '@pkg/contracts';
import { assertGoldConservation, createGame, createRng, randomInt, type SeatState } from '@pkg/game-core';
import { buildMatchStudyBlueprint, settleLearningNodeGold } from '@pkg/learning-core';
import type { CreateMatchInput } from '../src/lobby/lobbyService.js';
import type { MatchStartInput } from '../src/ranking/rankingService.js';
import { MatchRoom, type MatchRuntime } from '../src/rooms/matchRoom.js';

const PACK = CoursePackSchema.parse(JSON.parse(readFileSync(new URL('../../../content/courses/compiled/math-core-starter.json', import.meta.url), 'utf8')));
const SEED = 4;
const HUMAN_IDS = ['first-human', 'second-human'] as const;
const BOT_DIFFICULTIES = ['novice', 'standard', 'veteran'] as const;
const BOT_RANGES = {
  novice: { time: [55, 86], score: [48, 64] },
  standard: { time: [45, 76], score: [66, 82] },
  veteran: { time: [36, 68], score: [78, 94] },
} as const;
const TIMELINE = MODE_BUDGETS.modes.quick.timeline;
const FIRST_LEARNING_PHASE = TIMELINE.findIndex(event => event.kind === 'learning');
const STARTED_AT = Date.parse('2030-01-01T00:00:00Z');

async function startLearning(timeScale: number) {
  vi.useFakeTimers();
  vi.setSystemTime(STARTED_AT);
  const room = new MatchRoom();
  room.game = createGame('quick', SEED);
  room['gameSeed'] = SEED;
  room.packs = [PACK];
  room.input = { durationMode: 'quick', queueType: 'casual', sharedSubject: 'math' } as CreateMatchInput;
  room.start = { matchId: 'learning-barrier', coursePackVersion: PACK.manifest.coursePackVersion } as MatchStartInput;
  room.phaseIndex = FIRST_LEARNING_PHASE - 1;
  const persistNode = vi.fn().mockResolvedValue({ rewardPointsGranted: 0, attemptIds: [] });
  room.runtime = { timeScale, learning: { persistNode } } as unknown as MatchRuntime;
  const startEvidence = { now: new Date() };
  const blueprint = buildMatchStudyBlueprint({ mode: 'quick', packs: room.packs, subject: 'math', seed: SEED, ...startEvidence });
  for (const [index, userId] of HUMAN_IDS.entries()) {
    room['humans'].set(userId, { seatId: room.game.seats[index]!.id, profile: { userId } as UserProfile });
    room['studies'].set(userId, { blueprint, startEvidence, arcIndex: -1, usedQuestionIds: new Set(), attempts: [] });
    room['settlements'].set(userId, []);
    room['wrong'].set(userId, new Set());
    room['learningTotals'].set(userId, { rewardPointsGranted: 0, attemptIds: [] });
  }
  const bots = room.game.seats.slice(HUMAN_IDS.length);
  for (const [index, seat] of bots.entries()) {
    seat.isBot = true;
    seat.botDifficulty = BOT_DIFFICULTIES[index % BOT_DIFFICULTIES.length]!;
    seat.learningChargeCents = 73;
  }
  await room['transition']();
  expect(room.phase).toBe('learning');
  const durationMs = Math.max(1, TIMELINE[FIRST_LEARNING_PHASE]!.duration * 1000 * timeScale);
  expect(room.deadlineEpochMs).toBe(STARTED_AT + durationMs);
  return { room, bots, persistNode };
}

function finishIntro(room: MatchRoom, userId: string) {
  const progress = room['lessons'].get(userId)!;
  expect(progress.bundle.steps[progress.step]!.kind).toBe('material');
  room['learningCommand'](userId, { action: 'advance' });
  const questions = progress.bundle.questions;
  expect(questions.length).toBeGreaterThan(0);
  for (const question of questions) {
    expect(question).toMatchObject({ stepRole: 'resource_check', questionType: 'single_choice' });
    room['learningCommand'](userId, { action: 'submit', questionId: question.questionId, submission: question.answerSpec });
  }
  expect(progress).toMatchObject({ complete: true, readyToProceed: true, settled: true });
}

function expectedBotResult(seat: SeatState, seatIndex: number, durationMs: number) {
  const rng = createRng(`${SEED}:bot-learning:0:${seatIndex}`);
  const { time, score } = BOT_RANGES[seat.botDifficulty];
  const timePercent = time[0] + randomInt(rng, time[1] - time[0] + 1);
  const scorePercent = score[0] + randomInt(rng, score[1] - score[0] + 1);
  const quality = { numerator: String(scorePercent), denominator: '100' };
  const gold = settleLearningNodeGold({ mode: 'quick', blockIndex: 0, carryInCents: seat.learningChargeCents,
    gradedUnits: [{ stepRole: 'resource_check', weight: 1, quality }, { stepRole: 'verification', weight: 1, quality }] });
  return { seat, offset: Math.ceil(durationMs * timePercent / 100), gold };
}

function learningEntries(seat: SeatState) {
  return seat.goldLedger.filter(entry => entry.reason === 'learning');
}

function expectBotSettled({ seat, gold }: ReturnType<typeof expectedBotResult>) {
  expect(learningEntries(seat)).toEqual([{ reason: 'learning', amount: gold.grantedIntegerGold }]);
  expect(seat.learningChargeCents).toBe(gold.carryOutCents);
  expect(seat.learningGoldOrbs).toEqual(gold.orbSplits);
  assertGoldConservation(seat);
}

describe('authoritative room learning barrier', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it.each([0.5, 0.03125])('settles each seat on completion and opens resources only when all 8 are done (timeScale=%s)', async (timeScale) => {
    const { room, bots, persistNode } = await startLearning(timeScale);
    const [, second] = HUMAN_IDS;
    const [firstSeat, secondSeat] = room.game.seats;
    const deadline = room.deadlineEpochMs;
    const expectedBots = bots.map((seat, index) => expectedBotResult(seat, HUMAN_IDS.length + index, deadline - STARTED_AT));
    const offsets = [...new Set(expectedBots.map(bot => bot.offset))].sort((a, b) => a - b);

    finishIntro(room, HUMAN_IDS[0]);
    expect(room['snapshot'](HUMAN_IDS[0])).toMatchObject({ phase: 'learning', deadlineEpochMs: deadline,
      learning: { readyHumansCount: 1, totalHumansCount: 8 }, resourceSettlement: { grantedIntegerGold: 7 } });
    expect(learningEntries(firstSeat!)).toEqual([{ reason: 'learning', amount: 7 }]);
    expect(persistNode).toHaveBeenCalledTimes(1);
    const shopIndex = firstSeat!.shop.findIndex(unit => unit !== null);
    expect(room['applyCommand'](firstSeat!.id, { type: 'BUY_CARD', shopIndex })).toMatchObject({ ok: true });
    expect(firstSeat!.shop[shopIndex]).toBeNull();
    const unit = firstSeat!.units.find(unit => unit.location.zone === 'bench')!;
    const to = { zone: 'board', row: 0, col: 0 } as const;
    expect(room['applyCommand'](firstSeat!.id, { type: 'MOVE_UNIT', instanceId: unit.instanceId, to })).toMatchObject({ ok: true });
    expect(unit.location).toEqual(to);
    expect(room.phase).toBe('learning');
    expect(room['applyCommand'](secondSeat!.id, { type: 'BUY_XP' })).toEqual({ ok: false, reason: 'STRATEGY_PHASE_REQUIRED' });
    finishIntro(room, second);
    await vi.advanceTimersByTimeAsync(1);
    expect(room.phase).toBe('learning');
    expect(room.deadlineEpochMs).toBe(deadline);

    for (const offset of offsets) {
      await vi.advanceTimersByTimeAsync(STARTED_AT + offset - Date.now() - 1);
      expect(room.phase).toBe('learning');
      expect(room.deadlineEpochMs).toBe(deadline);
      for (const bot of expectedBots.filter(bot => bot.offset >= offset)) {
        expect(learningEntries(bot.seat)).toEqual([]);
        expect(bot.seat.learningChargeCents).toBe(73);
      }
      await vi.advanceTimersByTimeAsync(1);
      expectedBots.filter(bot => bot.offset <= offset).forEach(expectBotSettled);
      if (offset !== offsets.at(-1)) {
        expect(room['snapshot'](HUMAN_IDS[0])).toMatchObject({ phase: 'learning',
          learning: { readyHumansCount: 2 + expectedBots.filter(bot => bot.offset <= offset).length, totalHumansCount: 8 } });
      }
    }
    await vi.advanceTimersByTimeAsync(1);
    expect(room.phase).toBe('resource');
    expect(room.phaseIndex).toBe(FIRST_LEARNING_PHASE + 1);
    expect(room.nodeIndex).toBe(0);
    expect(Date.now()).toBeLessThan(deadline);
    expect(persistNode).toHaveBeenCalledTimes(2);
    for (const userId of HUMAN_IDS) expect(room['settlements'].get(userId)).toHaveLength(1);
    expectedBots.forEach(expectBotSettled);
    expect(room.failure).toBeNull();
  });

  it.each([
    { status: 'bots already settled', timeScale: 0.5, botsDone: true },
    { status: 'bot timers round up to the deadline', timeScale: 0.000001, botsDone: false },
  ])('settles unfinished seats once at the nominal deadline ($status)', async ({ timeScale, botsDone }) => {
    const { room, bots, persistNode } = await startLearning(timeScale);
    const [done, pending] = HUMAN_IDS;
    finishIntro(room, done);
    const pendingSeat = room.game.seats[1]!;
    pendingSeat.learningChargeCents = 42;
    const deadline = room.deadlineEpochMs;
    const expectedBots = bots.map((seat, index) => expectedBotResult(seat, HUMAN_IDS.length + index, deadline - STARTED_AT));

    await vi.advanceTimersByTimeAsync(deadline - Date.now() - 1);
    expect(room['snapshot'](pending)).toMatchObject({ phase: 'learning', deadlineEpochMs: deadline,
      learning: { complete: false, readyHumansCount: botsDone ? 7 : 1, totalHumansCount: 8 }, resourceSettlement: null });
    expect(room['settlements'].get(pending)).toEqual([]);
    expect(persistNode).toHaveBeenCalledTimes(1);
    if (botsDone) expectedBots.forEach(expectBotSettled);
    else for (const bot of bots) expect(learningEntries(bot)).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(room['snapshot'](pending)).toMatchObject({ phase: 'resource', learning: { complete: false },
      resourceSettlement: { nodeIndex: 0 } });
    expect(room['settlements'].get(pending)).toEqual([expect.objectContaining({
      nodeIndex: 0, rawEarnedCents: 0, grantedIntegerGold: 0, carryInCents: 42, carryOutCents: 42,
    })]);
    expect(room['settlements'].get(done)).toHaveLength(1);
    expect(learningEntries(pendingSeat)).toEqual([]);
    expect(pendingSeat.learningChargeCents).toBe(42);
    expect(persistNode).toHaveBeenCalledTimes(2);
    expectedBots.forEach(expectBotSettled);
    expect(room.failure).toBeNull();
  });
});
