import { DefaultScheduler } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { scheduleFsrsReview } from '../src/index.js';
import { card, NOW } from './fixtures.js';

const identity = { familyId: 'family1', subject: 'math' as const, knowledgeNode: 'n1' };
describe('installed ts-fsrs v6 adapter', () => {
  it('matches the native FSRS-6 scheduler, not a fixed-interval stub', async () => {
    const native = await DefaultScheduler({ version: 'FSRS-6', enableFuzz: false, enableShortTerm: false });
    const expected = native.review({ card: native.newCard({ now: NOW, cardId: identity.familyId }), now: NOW, grade: 3 }).card;
    const result = await scheduleFsrsReview({ ...identity, now: NOW, rating: 3 });
    expect(result).toMatchObject({ ...identity, dueIso: expected.dueAt.toISOString(), stability: expected.stability,
      difficulty: expected.difficulty, state: expected.state, reps: expected.reps, lapses: expected.lapses, lastReviewIso: NOW.toISOString() });
    expect(new Date(result.dueIso).getTime()).toBeGreaterThan(NOW.getTime());
    expect(result).toEqual(await scheduleFsrsReview({ ...identity, now: NOW, rating: 3 }));
  });
  it('different ratings change real memory state and due intervals', async () => {
    const again = await scheduleFsrsReview({ ...identity, now: NOW, rating: 1 });
    const easy = await scheduleFsrsReview({ ...identity, now: NOW, rating: 4 });
    expect(easy.stability).toBeGreaterThan(again.stability);
    expect(new Date(easy.dueIso).getTime()).toBeGreaterThan(new Date(again.dueIso).getTime());
  });
  it('round-trips persisted cards, increments reps/lapses, and does not mutate input', async () => {
    const previous = card(); const saved = structuredClone(previous);
    const result = await scheduleFsrsReview({ ...identity, card: previous, now: NOW, rating: 1 });
    expect(previous).toEqual(saved);
    expect(result.reps).toBe(previous.reps + 1);
    expect(result.lapses).toBe(previous.lapses + 1);
    const next = await scheduleFsrsReview({ ...identity, card: result, now: result.dueIso, rating: 3 });
    expect(next.reps).toBe(result.reps + 1);
    expect(next.lastReviewIso).toBe(result.dueIso);
  });
  it('rejects invalid dates, time travel, ratings, and mismatched card identities', async () => {
    await expect(scheduleFsrsReview({ ...identity, now: 'bad', rating: 3 })).rejects.toThrow();
    await expect(scheduleFsrsReview({ ...identity, now: NOW, rating: 0 as 3 })).rejects.toThrow('rating');
    await expect(scheduleFsrsReview({ ...identity, card: card({ familyId: 'other' }), now: NOW, rating: 3 })).rejects.toThrow('identity');
    await expect(scheduleFsrsReview({ ...identity, card: card(), now: '2026-01-01T00:00:00Z', rating: 3 })).rejects.toThrow('precedes');
  });
});
