import { FsrsCardRecordSchema, type FsrsCardRecord, type SubjectId } from '@pkg/contracts';
import { DefaultScheduler, type DefaultSchedulerCard, type Grade } from 'ts-fsrs';

export interface FsrsReviewInput {
  card?: FsrsCardRecord | null;
  familyId: string;
  subject: SubjectId;
  knowledgeNode: string;
  now: Date | string;
  rating: 1 | 2 | 3 | 4;
}
export function validDate(value: Date | string, name = 'date'): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`Invalid ${name}`);
  return date;
}
const schedulerPromise = DefaultScheduler({ version: 'FSRS-6', enableFuzz: false, enableShortTerm: false });
export async function scheduleFsrsReview(input: FsrsReviewInput): Promise<FsrsCardRecord> {
  const now = validDate(input.now, 'review time');
  if (![1, 2, 3, 4].includes(input.rating)) throw new RangeError('FSRS rating must be Again, Hard, Good, or Easy');
  if (!input.familyId.trim() || !input.knowledgeNode.trim()) throw new Error('Missing card identity');
  const scheduler = await schedulerPromise;
  let card = scheduler.newCard({ now, cardId: input.familyId });
  if (input.card) {
    const previous = FsrsCardRecordSchema.parse(input.card);
    if (previous.familyId !== input.familyId || previous.subject !== input.subject || previous.knowledgeNode !== input.knowledgeNode) throw new Error('FSRS card identity mismatch');
    const dueAt = validDate(previous.dueIso, 'card due');
    const lastReviewAt = previous.lastReviewIso === null ? null : validDate(previous.lastReviewIso, 'last review');
    if (lastReviewAt && lastReviewAt > now) throw new RangeError('Review precedes previous review');
    const scheduledDays = lastReviewAt ? Math.max(0, Math.round((dueAt.getTime() - lastReviewAt.getTime()) / 86_400_000)) : 0;
    card = {
      ...card, stability: previous.stability, difficulty: previous.difficulty,
      reps: previous.reps, lapses: previous.lapses, state: previous.state as 0 | 1 | 2 | 3,
      scheduleStatus: previous.state === 0 ? 'new' : previous.state === 2 ? 'review' : 'learning',
      dueAt, lastReviewAt, scheduledDays, learningStep: 0,
    } satisfies DefaultSchedulerCard<'FSRS-6'>;
  }
  const result = scheduler.review({ card, grade: input.rating as Grade, now }).card;
  return FsrsCardRecordSchema.parse({
    familyId: input.familyId, subject: input.subject, knowledgeNode: input.knowledgeNode,
    dueIso: result.dueAt.toISOString(), stability: result.stability, difficulty: result.difficulty,
    reps: result.reps, lapses: result.lapses, state: result.state,
    lastReviewIso: result.lastReviewAt?.toISOString() ?? null,
  });
}
