import { describe, expect, it } from 'vitest';
import { evaluateRewardPointsTaskGrant, type RewardPointsTaskInput } from '../src/index.js';
import { card, NOW } from './fixtures.js';

const input: RewardPointsTaskInput = { userId: 'u1', familyId: 'family1', source: 'direct_learning', verifiedOnline: true, isMastered: true, now: NOW };
describe('reward points shared task ledger policy', () => {
  it('grants first mastery once across entry points and modes', () => {
    const first = evaluateRewardPointsTaskGrant(input);
    expect(first).toMatchObject({ granted: true, pointsDelta: 1, reason: 'first_mastery' });
    expect(evaluateRewardPointsTaskGrant({ ...input, source: 'match_learning', grantedTaskKeys: [first.taskKey!] })).toMatchObject({ granted: false, pointsDelta: 0, reason: 'duplicate' });
    expect(evaluateRewardPointsTaskGrant({ ...input, userId: 'u2' }).taskKey).not.toBe(first.taskKey);
    expect(evaluateRewardPointsTaskGrant({ ...input, familyId: 'another' }).taskKey).not.toBe(first.taskKey);
    expect(evaluateRewardPointsTaskGrant({ ...input, source: 'match_learning' }).taskKey).toBe(first.taskKey);
  });
  it('grants a normally due FSRS review once per due cycle, shared across sources', () => {
    const first = evaluateRewardPointsTaskGrant(input);
    const due = { ...input, previouslyMastered: true, cardBeforeReview: card(), grantedTaskKeys: [first.taskKey!], points: 5 };
    const review = evaluateRewardPointsTaskGrant(due);
    expect(review).toMatchObject({ granted: true, pointsDelta: 5, reason: 'due_review' });
    expect(evaluateRewardPointsTaskGrant({ ...due, source: 'match', grantedTaskKeys: new Set([first.taskKey!, review.taskKey!]) })).toMatchObject({ granted: false, pointsDelta: 0, reason: 'duplicate' });
    const later = evaluateRewardPointsTaskGrant({ ...due, now: '2026-05-20T12:00:00Z', cardBeforeReview: card({ lastReviewIso: NOW.toISOString(), dueIso: '2026-05-20T12:00:00Z' }) });
    expect(later.granted).toBe(true); expect(later.taskKey).not.toBe(review.taskKey);
  });
  it('does not grant future, early, intra-day, new-card, or mismatched-family cycles', () => {
    for (const c of [card({ dueIso: '2026-05-11T12:00:00Z' }), card({ lastReviewIso: '2026-05-10T11:59:00Z' }), card({ state: 1 }), card({ state: 0 }), card({ familyId: 'other' })]) {
      expect(evaluateRewardPointsTaskGrant({ ...input, previouslyMastered: true, cardBeforeReview: c })).toMatchObject({ granted: false, pointsDelta: 0 });
    }
  });
  it('does not mint offline/unverified records and never debits on forgetting', () => {
    for (const offline of [{ verifiedOnline: false }, { source: 'offline_sync' as const }, { source: 'offline' as const }]) {
      expect(evaluateRewardPointsTaskGrant({ ...input, ...offline })).toMatchObject({ granted: false, pointsDelta: 0, reason: 'offline_unverified' });
    }
    expect(evaluateRewardPointsTaskGrant({ ...input, isMastered: false, previouslyMastered: true })).toMatchObject({ granted: false, pointsDelta: 0, reason: 'not_mastered' });
    expect(() => evaluateRewardPointsTaskGrant({ ...input, points: -1 })).toThrow();
  });
  it('does not alias delimiter-containing user and family identities', () => {
    expect(evaluateRewardPointsTaskGrant({ ...input, userId: 'a:b', familyId: 'c' }).taskKey)
      .not.toBe(evaluateRewardPointsTaskGrant({ ...input, userId: 'a', familyId: 'b:c' }).taskKey);
  });
});
