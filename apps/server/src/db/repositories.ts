import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { CoursePackSchema, FsrsCardRecordSchema, QuestionIssueReportSchema, type CoursePack,
  type FsrsCardRecord, type QuestionIssueReport, type SubjectId } from '@pkg/contracts';
import type { AppDatabase } from './client.js';
import type { JsonValue } from './schema.js';
import { ServiceError } from './errors.js';

export async function publishCoursePack(db: AppDatabase, input: CoursePack, activate = false): Promise<void> {
  const pack = CoursePackSchema.parse(input);
  await db.transaction().execute(async (tx) => {
    const { packId, coursePackVersion, contentSha256, subject } = pack.manifest;
    await sql`select pg_advisory_xact_lock(hashtextextended(${`pack:${packId}`},0))`.execute(tx);
    const existing = await tx.selectFrom('course_packs').selectAll().where('pack_id','=',packId)
      .where('course_pack_version','=',coursePackVersion).executeTakeFirst();
    if (existing) {
      const same = await tx.selectFrom('course_packs').select('pack_id').where('pack_id','=',packId)
        .where('course_pack_version','=',coursePackVersion).where('pack_json','=',sql<JsonValue>`${JSON.stringify(pack)}::jsonb`).executeTakeFirst();
      if (!same || existing.content_sha256 !== contentSha256) throw new ServiceError('IMMUTABLE_PACK_VERSION_CONFLICT');
    } else {
      await tx.insertInto('course_packs').values({ pack_id: packId, course_pack_version: coursePackVersion,
        pack_json: JSON.stringify(pack), content_sha256: contentSha256, subject, is_active: false }).execute();
    }
    if (activate) {
      await tx.updateTable('course_packs').set({is_active:false}).where('pack_id','=',packId).where('is_active','=',true).execute();
      await tx.updateTable('course_packs').set({is_active:true}).where('pack_id','=',packId).where('course_pack_version','=',coursePackVersion).execute();
    }
  });
}
export async function activateCoursePackVersion(db: AppDatabase, packId: string, version: string): Promise<void> {
  await db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`pack:${packId}`},0))`.execute(tx);
    const target = await tx.selectFrom('course_packs').select('pack_id').where('pack_id','=',packId).where('course_pack_version','=',version).executeTakeFirst();
    if (!target) throw new ServiceError('COURSE_PACK_NOT_FOUND');
    await tx.updateTable('course_packs').set({is_active:false}).where('pack_id','=',packId).where('is_active','=',true).execute();
    await tx.updateTable('course_packs').set({is_active:true}).where('pack_id','=',packId).where('course_pack_version','=',version).execute();
  });
}
export async function getCoursePack(db: AppDatabase, packId: string, version?: string): Promise<CoursePack> {
  let query = db.selectFrom('course_packs').select('pack_json').where('pack_id','=',packId);
  query = version ? query.where('course_pack_version','=',version) : query.where('is_active','=',true);
  const row = await query.executeTakeFirst();
  if (!row) throw new ServiceError('COURSE_PACK_NOT_FOUND');
  return CoursePackSchema.parse(row.pack_json);
}
export async function saveFsrsCard(db: AppDatabase, userId: string, input: FsrsCardRecord): Promise<void> {
  const card = FsrsCardRecordSchema.parse(input);
  await db.insertInto('learning_fsrs_cards').values({ user_id: userId, family_id: card.familyId, subject: card.subject,
    knowledge_node: card.knowledgeNode, state_json: JSON.stringify(card), due_at: card.dueIso })
    .onConflict((oc) => oc.columns(['user_id','family_id','subject']).doUpdateSet({ state_json: JSON.stringify(card),
      due_at: card.dueIso, knowledge_node: card.knowledgeNode, updated_at: new Date() })).execute();
}
export async function getPrivateFsrsCards(db: AppDatabase, userId: string, dueBefore?: Date): Promise<FsrsCardRecord[]> {
  let query = db.selectFrom('learning_fsrs_cards').select('state_json').where('user_id','=',userId);
  if (dueBefore) query = query.where('due_at','<=',dueBefore);
  return (await query.orderBy('due_at').execute()).map((row) => row.state_json);
}
export interface LearningAttemptInput {
  id?: string; userId: string; questionId: string; familyId: string; subject: SubjectId;
  coursePackVersion: string; knowledgeNode: string; isCorrect: boolean; answer: JsonValue; isOfflineUnverified: boolean;
}
export async function recordLearningAttempt(db: AppDatabase, input: LearningAttemptInput): Promise<string> {
  const id = input.id ?? randomUUID();
  await db.insertInto('learning_attempts').values({ id, user_id: input.userId, question_id: input.questionId,
    family_id: input.familyId, subject: input.subject, course_pack_version: input.coursePackVersion,
    knowledge_node: input.knowledgeNode, is_correct: input.isCorrect, answer_json: JSON.stringify(input.answer),
    is_offline_unverified: input.isOfflineUnverified }).execute();
  return id;
}
export async function storeQuestionIssueReport(db: AppDatabase, userId: string, input: QuestionIssueReport): Promise<string> {
  const report = QuestionIssueReportSchema.parse(input);
  const attempt = await db.selectFrom('learning_attempts').select('id').where('id','=',report.attemptRef)
    .where('user_id','=',userId).where('question_id','=',report.questionId).where('course_pack_version','=',report.packVersion).executeTakeFirst();
  if (!attempt) throw new ServiceError('ATTEMPT_NOT_FOUND');
  const id = randomUUID();
  await db.insertInto('question_issue_reports').values({ id, user_id: userId, question_id: report.questionId,
    pack_version: report.packVersion, attempt_ref: report.attemptRef, reason_code: report.reasonCode,
    detail_optional: report.detailOptional ?? null }).execute();
  return id;
}
export interface AnonymousCohortSubjectErrorRate {
  cohortGroup: string; subject: SubjectId; suppressed: boolean;
  sampleSize: number | null; attemptCount: number | null; wrongRate: number | null;
}
export async function queryAnonymousCohortSubjectErrorRates(db: AppDatabase, options: { cohortGroup?: string; subject?: SubjectId } = {}): Promise<AnonymousCohortSubjectErrorRate[]> {
  let query = db.selectFrom('learning_attempts as a').innerJoin('users as u','u.id','a.user_id')
    .select(['u.cohort_group','a.subject', sql<string>`count(distinct a.user_id)`.as('sample_size'),
      sql<string>`count(*)`.as('attempt_count'), sql<number>`avg(case when a.is_correct then 0.0 else 1.0 end)::float8`.as('wrong_rate')])
    .where('u.cohort_group','is not',null).where('a.is_offline_unverified','=',false);
  if (options.cohortGroup) query = query.where('u.cohort_group','=',options.cohortGroup);
  if (options.subject) query = query.where('a.subject','=',options.subject);
  const rows = await query.groupBy(['u.cohort_group','a.subject']).orderBy('u.cohort_group').orderBy('a.subject').execute();
  return rows.map((row) => {
    const suppressed = Number(row.sample_size) < 3;
    return { cohortGroup: row.cohort_group!, subject: row.subject, suppressed,
      sampleSize: suppressed ? null : Number(row.sample_size), attemptCount: suppressed ? null : Number(row.attempt_count),
      wrongRate: suppressed ? null : row.wrong_rate };
  });
}
