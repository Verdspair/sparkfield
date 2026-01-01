import type { FsrsCardRecord } from '@pkg/contracts';
import { validDate } from './fsrs.js';

export interface RewardPointsTaskInput {
  userId: string;
  familyId: string;
  source: 'direct_learning' | 'match_learning' | 'offline_sync' | 'direct' | 'match' | 'offline';
  verifiedOnline: boolean;
  isMastered: boolean;
  now: Date | string;
  cardBeforeReview?: FsrsCardRecord | null;
  previouslyMastered?: boolean;
  grantedTaskKeys?: readonly string[] | ReadonlySet<string>;
  points?: number;
}
export type RewardPointsGrantReason = 'first_mastery' | 'due_review' | 'duplicate' | 'offline_unverified' | 'not_mastered' | 'not_due';
export interface RewardPointsTaskGrant {
  granted: boolean;
  taskKey: string | null;
  pointsDelta: number;
  reason: RewardPointsGrantReason;
}
export function evaluateRewardPointsTaskGrant(input: RewardPointsTaskInput): RewardPointsTaskGrant {
  if (!input.userId.trim() || !input.familyId.trim()) throw new Error('Missing reward-points identity');
  const now = validDate(input.now);
  const points = input.points ?? 1;
  if (!Number.isSafeInteger(points) || points < 0) throw new RangeError('Points must be a nonnegative safe integer');
  const no = (reason: RewardPointsGrantReason, taskKey: string | null = null): RewardPointsTaskGrant => ({ granted: false, taskKey, pointsDelta: 0, reason });
  if (!input.verifiedOnline || input.source === 'offline' || input.source === 'offline_sync') return no('offline_unverified');
  if (!input.isMastered) return no('not_mastered'); 
  const firstKey = JSON.stringify(['reward_learning', input.userId, input.familyId, 'first_mastery']);
  const keys = new Set(input.grantedTaskKeys ?? []);
  const previouslyMastered = input.previouslyMastered || keys.has(firstKey);
  let taskKey = firstKey;
  let reason: RewardPointsGrantReason = 'first_mastery';
  if (previouslyMastered) {
    const card = input.cardBeforeReview;
    if (!card || card.familyId !== input.familyId || card.state !== 2 || card.reps < 1 || !card.lastReviewIso) return no(keys.has(firstKey) ? 'duplicate' : 'not_due', firstKey);
    const due = validDate(card.dueIso, 'due time');
    const last = validDate(card.lastReviewIso, 'last review');
    if (due > now || now < last || due.getTime() - last.getTime() < 86_400_000) return no('not_due');
    taskKey = JSON.stringify(['reward_learning', input.userId, input.familyId, 'due_review', due.toISOString()]);
    reason = 'due_review';
  }
  if (keys.has(taskKey)) return no('duplicate', taskKey);
  return { granted: true, taskKey, pointsDelta: points, reason };
}
