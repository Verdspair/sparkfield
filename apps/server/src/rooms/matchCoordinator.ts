import { randomUUID } from 'node:crypto';
import { matchMaker } from '@colyseus/core';
import { CoursePackSchema, type CoursePack, type DurationMode, type UserProfile } from '@pkg/contracts';
import type { BotDifficulty } from '@pkg/game-core';
import { sql } from 'kysely';
import { ServiceError } from '../db/errors.js';
import type { CreateMatchInput, MatchCreationResult } from '../lobby/lobbyService.js';
import { MatchRoom, type MatchRoomOptions, type MatchRuntime } from './matchRoom.js';

export interface MatchmakingScoreOptions { recentAttemptLimit?:number;lookbackDays?:number;learningWeight?:number;rankingWeight?:number }
export interface MatchCoordinatorOptions extends Omit<MatchRuntime,'register'|'unregister'> {
  roomType?:string;
  matchmakingScore?:MatchmakingScoreOptions;
  onMatchEnded?:(roomId:string,userIds:readonly string[])=>void;
}
export function botDifficultyForMatch(score: number | null | undefined, accuracy: number | null | undefined): BotDifficulty {
  if ((score ?? 1000) < 1200 || (accuracy ?? 0.6) < 0.45) return 'novice';
  return (score ?? 1000) < 1550 ? 'standard' : 'veteran';
}
export class MatchCoordinator {
  private readonly rooms=new Map<string,MatchRoom>();
  private readonly users=new Map<string,MatchRoom>();
  private readonly pending=new Set<string>();
  readonly capability=Symbol('trusted-match-coordinator');
  readonly runtime:MatchRuntime;
  readonly roomType:string;
  constructor(private readonly options:MatchCoordinatorOptions) {
    if(!Number.isFinite(options.timeScale)||options.timeScale<=0)throw new Error('Invalid timeScale');
    if(!Number.isFinite(options.reconnectProtectionMs)||options.reconnectProtectionMs<0)throw new Error('Invalid reconnectProtectionMs');
    this.roomType=options.roomType??'authoritative_match';
    this.runtime={...options,register:room=>{
      this.rooms.set(room.roomId,room);for(const human of room.input.humans)this.users.set(human.userId,room);
    },unregister:room=>{
      this.rooms.delete(room.roomId);
      const userIds:string[]=[];
      for(const human of room.input.humans) {
        userIds.push(human.userId);
        if(this.users.get(human.userId)===room)this.users.delete(human.userId);
      }
      this.options.onMatchEnded?.(room.roomId,userIds);
    }};
  }
  async createMatch(input:CreateMatchInput):Promise<MatchCreationResult> {
    if(!input.humans.length||input.humans.length>8)throw new ServiceError('INVALID_HUMAN_COUNT');
    for(const human of input.humans) {
      if(this.pending.has(human.userId)||this.getActiveSeat(human.userId))throw new ServiceError('MATCH_IN_PROGRESS');
    }
    for(const human of input.humans)this.pending.add(human.userId);
    try {
      const {db}=this.options;
      const season=await db.selectFrom('season_terms').selectAll().where('is_active','=',true).executeTakeFirst();
      if(!season)throw new ServiceError('SEASON_NOT_FOUND');
      const rows=await db.selectFrom('course_packs').select('pack_json').where('is_active','=',true).orderBy('pack_id').execute();
      const packs:CoursePack[]=rows.map(row=>CoursePackSchema.parse(row.pack_json));
      const subjectPack=packs.find(pack=>pack.manifest.subject===input.sharedSubject);
      if(!subjectPack)throw new ServiceError('COURSE_PACK_NOT_FOUND');
      const start={matchId:randomUUID(),seasonTermId:season.id,gameSetVersion:'season1-v1',
        coursePackId:subjectPack.manifest.packId,coursePackVersion:subjectPack.manifest.coursePackVersion,
        durationMode:input.durationMode,queueType:input.queueType};
      const humanIds=input.humans.map(h=>h.userId);
      const recent=await db.selectFrom('learning_attempts').select(sql<number>`avg(case when is_correct then 1.0 else 0.0 end)::float8`.as('accuracy'))
        .where('user_id','in',humanIds).where('is_offline_unverified','=',false).where('created_at','>',new Date(Date.now()-30*86_400_000)).executeTakeFirst();
      const standings=await db.selectFrom('mode_standings').select(sql<number>`avg(rank_score)::float8`.as('score'))
        .where('season_term_id','=',season.id).where('duration_mode','=',input.durationMode).where('user_id','in',humanIds).executeTakeFirst();
      const botDifficulty=botDifficultyForMatch(standings?.score,recent?.accuracy);
      const options:MatchRoomOptions={runtime:this.runtime,capability:this.capability,expectedCapability:this.capability,input,start,packs,botDifficulty};
      const listing=await matchMaker.createRoom(this.roomType,options);
      const room=this.rooms.get(listing.roomId);if(!room)throw new Error('MATCH_ROOM_NOT_REGISTERED');
      return {roomId:listing.roomId,matchId:start.matchId,
        seatIds:Object.fromEntries(input.humans.map(h=>[h.userId,room.seatFor(h.userId)!]))};
    } finally {for(const human of input.humans)this.pending.delete(human.userId);}
  }
  async scoreCandidate(profile:UserProfile,mode:DurationMode):Promise<number> {
    const config=this.options.matchmakingScore??{};
    const limit=config.recentAttemptLimit??50,days=config.lookbackDays??30;
    if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isFinite(days)||days<=0)throw new Error('Invalid matchmaking evidence window');
    const recent=this.options.db.selectFrom('learning_attempts').select('is_correct').where('user_id','=',profile.userId)
      .where('is_offline_unverified','=',false).where('created_at','>',new Date(Date.now()-days*86_400_000))
      .where(sql<boolean>`answer_json->>'stepRole' is distinct from 'practice'`)
      .where(sql<boolean>`answer_json->'submission'->>'hintUsed' is distinct from 'true'`)
      .orderBy('created_at','desc').limit(limit).as('recent');
    const [accuracy,standing]=await Promise.all([
      this.options.db.selectFrom(recent).select(sql<number>`avg(case when is_correct then 1.0 else 0.0 end)::float8`.as('accuracy')).executeTakeFirst(),
      this.options.db.selectFrom('mode_standings as s').innerJoin('season_terms as season','season.id','s.season_term_id')
        .select('s.rank_score').where('season.is_active','=',true).where('s.user_id','=',profile.userId)
        .where('s.duration_mode','=',mode).where('s.matches_played','>',0).executeTakeFirst(),
    ]);
    const score=(standing?.rank_score??1000)*(config.rankingWeight??1)+((accuracy?.accuracy??0.5)-0.5)*(config.learningWeight??400);
    if(!Number.isFinite(score))throw new Error('Invalid matchmaking score weights');return score;
  }
  getActiveSeat(userId:string):unknown|null { return this.users.get(userId)?.activeSeat(userId)??null; }
  async resolveActiveSeat(userId:string):Promise<unknown|null> {const room=this.users.get(userId);await room?.supersede(userId);return this.getActiveSeat(userId);}
  canReturn(userId:string):boolean {const room=this.users.get(userId);return !this.pending.has(userId)&&(!room||room.completed||!!room.failure);}
  isMatchAlive(roomId:string,userId:string):boolean {
    const room=this.rooms.get(roomId);
    return Boolean(room&&!room.completed&&!room.failure&&room.seatFor(userId));
  }
  getRoom(roomId:string):MatchRoom|undefined {return this.rooms.get(roomId);}
}
