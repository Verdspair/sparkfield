import { isDeepStrictEqual } from 'node:util';
import { sql, type Selectable, type Transaction } from 'kysely';
import { rating, rate, ordinal, type Rating } from 'openskill';
import { DurationModeSchema, FinalBoardSnapshotSchema, type DurationMode, type FinalBoardSnapshot,
  type ModeStandingSummary, type VersionLockTriplet } from '@pkg/contracts';
import type { AppDatabase } from '../db/client.js';
import type { Database, MatchesTable } from '../db/schema.js';
import { ServiceError } from '../db/errors.js';
import { grantRewardPointsInTx } from '../rewards/rewardsService.js';

type Db = AppDatabase | Transaction<Database>;
export interface MatchStartInput extends VersionLockTriplet {
  matchId: string; durationMode: DurationMode; queueType: 'ranked' | 'casual' | 'solo'; coursePackId?: string;
}
export interface MatchRatingParticipant {
  seatId: string; userId?: string | null; isBot: boolean; quarterPoints: number;
  finalBoardSnapshot: FinalBoardSnapshot; wrongQuestionIds: string[]; botRating?: Rating;
}
export interface MatchSettlementInput extends MatchStartInput { participants: MatchRatingParticipant[]; ranks: number[] }
export interface LeaderboardEntry { leaderboardRank: number; userId: string; nickname: string; tierLabel: string; rankScore: number }
export interface LeaderboardResult { entries: LeaderboardEntry[]; self: ModeStandingSummary; isEmpty: boolean; selfInTopN: boolean }
export function rankScoreForRating(value: Rating): number { return Math.max(0, Math.round(1000 + ordinal(value) * 100)); }
export function tierLabelForScore(score: number): string {
  if (score >= 2300) return '钻石'; if (score >= 1900) return '铂金'; if (score >= 1500) return '黄金';
  if (score >= 1100) return '白银'; return '青铜';
}
function assertSameVersionLock(match: Selectable<MatchesTable>, input: MatchStartInput): void {
  if (match.season_term_id !== input.seasonTermId || match.game_set_version !== input.gameSetVersion
    || match.course_pack_version !== input.coursePackVersion || match.duration_mode !== input.durationMode
    || match.queue_type !== input.queueType || match.course_pack_id !== (input.coursePackId ?? null)) throw new ServiceError('MATCH_VERSION_LOCK_CONFLICT');
}
function assertParticipants(input: MatchSettlementInput): void {
  DurationModeSchema.parse(input.durationMode);
  if (input.participants.length < 2 || input.participants.length > 8 || input.ranks.length !== input.participants.length) throw new ServiceError('INVALID_MATCH_PARTICIPANTS');
  if (!input.participants.some((p) => !p.isBot)) throw new ServiceError('MATCH_REQUIRES_HUMAN');
  const sorted = [...input.ranks].sort((a,b) => a-b);
  for (let i = 0; i < sorted.length; i++) {
    if (!Number.isInteger(sorted[i]) || sorted[i]! < 1 || (i === 0 && sorted[i] !== 1)
      || (i > 0 && sorted[i] !== sorted[i-1] && sorted[i] !== i+1)) throw new ServiceError('INVALID_COMPETITION_RANKS');
  }
  if (new Set(input.participants.map((p) => p.seatId)).size !== input.participants.length) throw new ServiceError('DUPLICATE_SEAT');
  const humans = input.participants.filter((p) => !p.isBot);
  if (new Set(humans.map((p) => p.userId)).size !== humans.length) throw new ServiceError('DUPLICATE_USER');
  for (const participant of input.participants) {
    if (!participant.seatId || (participant.isBot ? participant.userId != null : !participant.userId)) throw new ServiceError('INVALID_SEAT_IDENTITY');
    if (!Number.isSafeInteger(participant.quarterPoints) || participant.quarterPoints < 0) throw new ServiceError('INVALID_QUARTER_POINTS');
    FinalBoardSnapshotSchema.parse(participant.finalBoardSnapshot);
    if (!Array.isArray(participant.wrongQuestionIds) || participant.wrongQuestionIds.some((id) => typeof id !== 'string' || !id)) throw new ServiceError('INVALID_WRONG_QUESTION_IDS');
    if (participant.botRating && (!Number.isFinite(participant.botRating.mu) || !Number.isFinite(participant.botRating.sigma) || participant.botRating.sigma <= 0)) throw new ServiceError('INVALID_BOT_RATING');
  }
}
async function ensureMatch(tx: Transaction<Database>, input: MatchStartInput): Promise<Selectable<MatchesTable>> {
  DurationModeSchema.parse(input.durationMode);
  await sql`select pg_advisory_xact_lock(hashtextextended(${`match:${input.matchId}`},0))`.execute(tx);
  const season = await tx.selectFrom('season_terms').selectAll().where('id','=',input.seasonTermId).forShare().executeTakeFirst();
  if (!season) throw new ServiceError('SEASON_NOT_FOUND');
  if (season.rewards_settled) throw new ServiceError('SEASON_SETTLED');
  const existing = await tx.selectFrom('matches').selectAll().where('id','=',input.matchId).forUpdate().executeTakeFirst();
  if (existing) { assertSameVersionLock(existing,input); return existing; }
  if (!season.is_active || season.starts_at.getTime() > Date.now() || season.ends_at.getTime() <= Date.now()) throw new ServiceError('SEASON_NOT_OPEN_FOR_NEW_MATCHES');
  return tx.insertInto('matches').values({ id: input.matchId, season_term_id: input.seasonTermId,
    game_set_version: input.gameSetVersion, course_pack_version: input.coursePackVersion, course_pack_id: input.coursePackId ?? null,
    duration_mode: input.durationMode, queue_type: input.queueType, status: 'active', completed_at: null }).returningAll().executeTakeFirstOrThrow();
}
async function ownSummary(db: Db, seasonId: string, mode: DurationMode, userId: string): Promise<ModeStandingSummary> {
  const row = await db.selectFrom('mode_standings').selectAll().where('season_term_id','=',seasonId)
    .where('duration_mode','=',mode).where('user_id','=',userId).executeTakeFirst();
  if (!row || row.matches_played === 0) return { seasonTermId:seasonId,durationMode:mode,status:'unranked',tierLabel:'未定级',rankScore:null,leaderboardRank:null,matchesPlayed:0 };
  const higher = await db.selectFrom('mode_standings').select(sql<string>`count(*)`.as('count')).where('season_term_id','=',seasonId)
    .where('duration_mode','=',mode).where('matches_played','>',0).where('rank_score','>',row.rank_score).executeTakeFirstOrThrow();
  return { seasonTermId:seasonId,durationMode:mode,status:'ranked',tierLabel:row.tier_label,
    rankScore:row.rank_score,leaderboardRank:Number(higher.count)+1,matchesPlayed:row.matches_played };
}
export class RankingService {
  constructor(private readonly db: AppDatabase) {}
  async startMatch(input: MatchStartInput): Promise<void> { await this.db.transaction().execute(async (tx) => { await ensureMatch(tx,input); }); }
  async settleMatch(input: MatchSettlementInput): Promise<{matchId:string;alreadySettled:boolean}> {
    assertParticipants(input);
    return this.db.transaction().execute(async (tx) => {
      const match = await ensureMatch(tx,input);
      if (match.status === 'completed') {
        const stored = await tx.selectFrom('match_participants').selectAll().where('match_id','=',input.matchId).execute();
        if (stored.length !== input.participants.length || input.participants.some((p,i) => !stored.some((s) => s.seat_id === p.seatId && s.user_id === (p.userId ?? null)
          && s.is_bot === p.isBot && s.final_rank === input.ranks[i] && s.quarter_points === p.quarterPoints
          && isDeepStrictEqual(s.final_board_snapshot,FinalBoardSnapshotSchema.parse(p.finalBoardSnapshot))
          && isDeepStrictEqual(s.wrong_question_ids,p.wrongQuestionIds)))) throw new ServiceError('MATCH_SETTLEMENT_CONFLICT');
        return {matchId:input.matchId,alreadySettled:true};
      }
      const userIds = input.participants.filter((p) => !p.isBot).map((p) => p.userId!).sort();
      const users = await tx.selectFrom('users').select('id').where('id','in',userIds).orderBy('id').forUpdate().execute();
      if (users.length !== userIds.length) throw new ServiceError('USER_NOT_FOUND');
      const standings = await tx.selectFrom('mode_standings').selectAll().where('season_term_id','=',input.seasonTermId)
        .where('duration_mode','=',input.durationMode).where('user_id','in',userIds).execute();
      const previous = new Map(standings.map((s) => [s.user_id,s]));
      const teams = input.participants.map((p) => [p.isBot ? p.botRating ?? rating() : previous.get(p.userId!) ?? rating()]);
      const updated = rate(teams,{rank:input.ranks}); 
      for (let i=0;i<input.participants.length;i++) {
        const p = input.participants[i]!;
        await tx.insertInto('match_participants').values({ match_id:input.matchId,seat_id:p.seatId,user_id:p.userId ?? null,is_bot:p.isBot,
          final_rank:input.ranks[i]!,quarter_points:p.quarterPoints,final_board_snapshot:JSON.stringify(FinalBoardSnapshotSchema.parse(p.finalBoardSnapshot)),
          wrong_question_ids:JSON.stringify(p.wrongQuestionIds) }).execute();
        if (!p.isBot && input.queueType === 'ranked') {
          const value = updated[i]![0]!;
          const score = rankScoreForRating(value);
          const values = { season_term_id:input.seasonTermId,duration_mode:input.durationMode,user_id:p.userId!,
            mu:value.mu,sigma:value.sigma,ordinal:ordinal(value),rank_score:score,tier_label:tierLabelForScore(score),
            matches_played:(previous.get(p.userId!)?.matches_played ?? 0)+1,updated_at:new Date() };
          await tx.insertInto('mode_standings').values(values).onConflict((oc) => oc.columns(['season_term_id','duration_mode','user_id']).doUpdateSet(values)).execute();
        }
      }
      await tx.updateTable('matches').set({status:'completed',completed_at:new Date()}).where('id','=',input.matchId).execute();
      return {matchId:input.matchId,alreadySettled:false};
    });
  }
  async getStanding(seasonId:string,mode:DurationMode,userId:string):Promise<ModeStandingSummary> {
    DurationModeSchema.parse(mode); return ownSummary(this.db,seasonId,mode,userId);
  }
  async getLeaderboard(input:{seasonTermId:string;durationMode:DurationMode;userId:string;limit?:number}):Promise<LeaderboardResult> {
    DurationModeSchema.parse(input.durationMode);
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new ServiceError('INVALID_LEADERBOARD_LIMIT');
    return this.db.transaction().setIsolationLevel('repeatable read').execute(async (tx) => {
      const rows = await tx.selectFrom('mode_standings as s').innerJoin('users as u','u.id','s.user_id')
        .select(['u.id','u.nickname','s.tier_label','s.rank_score',sql<string>`rank() over (order by s.rank_score desc)`.as('place')])
        .where('s.season_term_id','=',input.seasonTermId).where('s.duration_mode','=',input.durationMode).where('s.matches_played','>',0)
        .orderBy('s.rank_score','desc').orderBy('u.id').limit(limit).execute();
      const entries = rows.map((r) => ({leaderboardRank:Number(r.place),userId:r.id,nickname:r.nickname,tierLabel:r.tier_label,rankScore:r.rank_score}));
      return { entries,self:await ownSummary(tx,input.seasonTermId,input.durationMode,input.userId),
        isEmpty:entries.length===0,selfInTopN:entries.some((e) => e.userId === input.userId) };
    });
  }
  async settleSeasonTermAndSoftReset(input:{oldSeasonId:string;newSeason:{id:string;label:string;startsAt:Date;endsAt:Date}}):Promise<{alreadySettled:boolean;awards:number}> {
    if (input.oldSeasonId === input.newSeason.id || input.newSeason.endsAt <= input.newSeason.startsAt) throw new ServiceError('INVALID_NEW_SEASON');
    return this.db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock(102026,2)`.execute(tx);
      const season = await tx.selectFrom('season_terms').selectAll().where('id','=',input.oldSeasonId).forUpdate().executeTakeFirst();
      if (!season) throw new ServiceError('SEASON_NOT_FOUND');
      if (season.rewards_settled) return {alreadySettled:true,awards:0};
      if (season.ends_at.getTime() > Date.now()) throw new ServiceError('SEASON_NOT_ENDED');
      const ongoing = await tx.selectFrom('matches').select('id').where('season_term_id','=',input.oldSeasonId).where('status','=','active').executeTakeFirst();
      if (ongoing) throw new ServiceError('SEASON_MATCHES_STILL_ACTIVE');
      const old = await tx.selectFrom('mode_standings').selectAll().where('season_term_id','=',input.oldSeasonId).orderBy('user_id').orderBy('duration_mode').execute();
      let awards=0;
      for (const standing of old) {
        const points = standing.rank_score >= 2300 ? 300 : standing.rank_score >= 1900 ? 200 : standing.rank_score >= 1500 ? 100 : 0;
        if (standing.matches_played>0 && points>0) {
          await grantRewardPointsInTx(tx,{userId:standing.user_id,points,reason:'season_rank_reward',
            idempotencyKey:`season_term:${input.oldSeasonId}:${standing.duration_mode}:${standing.user_id}`}); awards++;
        }
      }
      await tx.updateTable('season_terms').set({is_active:false,rewards_settled:true}).where('id','=',input.oldSeasonId).execute();
      const newSeason = await tx.insertInto('season_terms').values({id:input.newSeason.id,label:input.newSeason.label,
        starts_at:input.newSeason.startsAt,ends_at:input.newSeason.endsAt,is_active:true,rewards_settled:false})
        .onConflict((oc) => oc.column('id').doNothing()).returning('id').executeTakeFirst();
      if (!newSeason) throw new ServiceError('NEW_SEASON_ALREADY_EXISTS');
      for (const s of old) {
        const base=rating();
        const value={mu:base.mu+(s.mu-base.mu)*0.5,sigma:Math.max(s.sigma,base.sigma*0.8)};
        const score=rankScoreForRating(value);
        await tx.insertInto('mode_standings').values({season_term_id:input.newSeason.id,duration_mode:s.duration_mode,user_id:s.user_id,
          mu:value.mu,sigma:value.sigma,ordinal:ordinal(value),rank_score:score,tier_label:tierLabelForScore(score),matches_played:0}).execute();
      }
      return {alreadySettled:false,awards};
    });
  }
}
