import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { ordinal, rate, rating } from 'openskill';
import { DEFAULT_TACTICIAN_ID, type CoursePack, type FinalBoardSnapshot, type FsrsCardRecord } from '@pkg/contracts';
import { createDatabase, type AppDatabase } from '../src/db/client.js';
import { DEFAULT_SEASON_TERM_ID, migrateDatabase } from '../src/db/migrate.js';
import { activateCoursePackVersion, getCoursePack, getPrivateFsrsCards, publishCoursePack,
  queryAnonymousCohortSubjectErrorRates, recordLearningAttempt, saveFsrsCard, storeQuestionIssueReport } from '../src/db/repositories.js';
import { AuthService, verifyPassword } from '../src/auth/authService.js';
import { RankingService, type MatchSettlementInput } from '../src/ranking/rankingService.js';
import { cancelOrderWithCompensation, getRewardPointsBalance, grantRewardPoints, listGiftCatalog,
  listRedemptionOrders, redeemGiftInSingleTx } from '../src/rewards/rewardsService.js';

const DATABASE_URL = 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const schema = `core_it_${randomUUID().replaceAll('-','')}`;
const adminDb = createDatabase(DATABASE_URL);
let db: AppDatabase;
let auth: AuthService;
let ranking: RankingService;
const seasonTerm = DEFAULT_SEASON_TERM_ID;
const password = 'real-postgres-password';
const board: FinalBoardSnapshot = { level: 7, activeTraits:[{traitName:'星际',count:3,activeTier:1}],
  chosenAugments:['silver-01'], units:[{unitId:'S01',star:3,items:['I01','I02'],row:2,col:4}] };
async function user(email?: string) {
  return auth.register({username:`u_${randomUUID().replaceAll('-','').slice(0,20)}`,nickname:'公开昵称',password,email});
}
async function gift(stock: number, points = 100) {
  const id=randomUUID();
  await db.insertInto('gift_catalog').values({id,title:'示例兑换物品',description:'不会履约',points_cost:points,stock_remaining:stock,is_sample_reward:true}).execute();
  return id;
}
function settlement(ids: string[], durationMode: 'quick'|'standard'|'deep' = 'quick'): MatchSettlementInput {
  return {matchId:randomUUID(),seasonTermId:seasonTerm,gameSetVersion:'S1',coursePackVersion:'1.0.0',durationMode,queueType:'ranked',
    ranks:[1,2,2,4,5,6,7,8],participants:Array.from({length:8},(_,i)=>({seatId:`seat-${i}`,isBot:i>=ids.length,
      userId:ids[i] ?? null,quarterPoints:i===1 || i===2 ? 32 : 40-i*4,finalBoardSnapshot:board,wrongQuestionIds:['math-q-01','eng-q-02']}))};
}
function pack(version: string): CoursePack {
  return {manifest:{packId:'math-integration',coursePackVersion:version,subject:'math',title:'数学测试包',syllabusTag:'local',
    contentSha256:'a'.repeat(64),itemCount:1,knowledgeGraph:[{nodeId:'n1',title:'基础',prerequisites:[]}],createdAtIso:'2026-09-01T00:00:00Z'},
    items:[{questionId:'q1',familyId:'f1',subject:'math',knowledgeNode:'n1',stepRole:'verification',questionType:'numeric',assessmentKind:'application',
      allowMaterialReview:true,materialMd:'资料',stemMd:'1+1=?',options:[],matchingPairs:[],stepsRubric:[],answerSpec:'2',partialRubric:'',hintMd:'',
      explanationMd:'相加',difficulty:1,weight:10,estSeconds:10,sourceLicense:'CC0',audioRefOptional:null}]};
}

beforeAll(async () => {
  const version=await sql<{version:string}>`show server_version`.execute(adminDb);
  expect(Object.values(version.rows[0] ?? {})[0]).toMatch(/^17\./);
  await sql.raw(`CREATE SCHEMA ${schema}`).execute(adminDb);
  const url=new URL(DATABASE_URL); url.searchParams.set('options',`-c search_path=${schema}`);
  db=createDatabase(url.toString());
  await migrateDatabase(db);
  await db.updateTable('season_terms').set({starts_at:new Date(Date.now()-86_400_000),ends_at:new Date(Date.now()+86_400_000)}).where('id','=',seasonTerm).execute();
  auth=new AuthService(db); ranking=new RankingService(db);
},30_000);
afterAll(async () => {
  if (db) await db.destroy();
  await sql.raw(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).execute(adminDb);
  await adminDb.destroy();
});

describe('real PostgreSQL 17 database, authentication and rewards',()=>{
  it('runs actual idempotent migrations and seeds only placeholder gifts without restocking',async()=>{
    await db.updateTable('gift_catalog').set({stock_remaining:3}).where('id','=','local-notebook').execute();
    await migrateDatabase(db);
    const gifts=await listGiftCatalog(db);
    expect(gifts).toHaveLength(3); expect(gifts.every(g=>g.isSampleReward)).toBe(true);
    expect(gifts.find(g=>g.giftId==='local-notebook')?.stockRemaining).toBe(3);
    const seeded=await db.selectFrom('season_terms').selectAll().where('id','=',seasonTerm).executeTakeFirstOrThrow();
    expect(seeded.label).toContain('赛季'); expect(seeded.rewards_settled).toBe(false);
  });
  it('adds the default tactician to an existing account without changing other profile settings', async () => {
    const person = await user();
    await db.updateTable('users').set({ avatar_frame_id: 'legacy-frame' }).where('id', '=', person.userId).execute();
    await sql`ALTER TABLE users DROP COLUMN preferred_tactician_id`.execute(db);
    await migrateDatabase(db);
    const session = await auth.login({ username: person.username, password });
    expect(session.profile).toMatchObject({ preferredTacticianId: DEFAULT_TACTICIAN_ID, avatarFrameId: 'legacy-frame', learningStartSelections: {} });
  });
  it('registers no-email and optional-email accounts; never creates fake addresses',async()=>{
    const noEmail=await user('   '), withEmail=await user('Person@example.test');
    const rows=await db.selectFrom('users').selectAll().where('id','in',[noEmail.userId,withEmail.userId]).execute();
    expect(rows.find(r=>r.id===noEmail.userId)?.email).toBeNull();
    expect(rows.find(r=>r.id===withEmail.userId)?.email).toBe('person@example.test');
    const nullRows=await db.selectFrom('users').select('id').where('id','=',noEmail.userId).where('email','is',null).execute();
    expect(nullRows).toHaveLength(1);
    expect(noEmail.nickname).toBe('公开昵称');expect(noEmail.username).not.toBe(noEmail.nickname);
    expect(noEmail.avatarFrameId).toBeNull();expect(noEmail.boardPlaqueId).toBeNull();
    const stored=rows.find(r=>r.id===noEmail.userId)!;
    expect(stored.password_hash).not.toContain(password);
    expect(await verifyPassword(password,stored.password_hash)).toBe(true);
    expect(await verifyPassword('bad-password',stored.password_hash)).toBe(false);
  });
  it('supersedes device A immediately and lets device B resume the same active seat',async()=>{
    const person=await user();
    const seat={roomCode:'ABCD12',matchId:'in-flight',seatId:'seat-1'};
    const seatAuth=new AuthService(db,(id)=>id===person.userId?seat:null);
    const a=await seatAuth.login({username:person.username,password});
    const b=await seatAuth.login({username:person.username,password});
    expect(b.sessionEpoch).toBe(a.sessionEpoch+1);expect(b.token.startsWith(`${b.sessionEpoch}.`)).toBe(true);
    expect(b.activeSeat).toEqual(seat);
    await expect(seatAuth.authenticate(a.token)).rejects.toMatchObject({code:'SESSION_SUPERSEDED'});
    let wrote=false;
    await expect(seatAuth.withAuthenticatedSession(a.token,()=>{wrote=true;})).rejects.toMatchObject({code:'SESSION_SUPERSEDED'});
    expect(wrote).toBe(false);
    expect((await seatAuth.authenticate(b.token)).userId).toBe(person.userId);
    await seatAuth.withAuthenticatedSession(b.token,(session)=>{expect(session.userId).toBe(person.userId);});
    expect(await seatAuth.getActiveSeat(b.token)).toEqual(seat);
    const sessions=await db.selectFrom('user_sessions').select('token_hash').where('user_id','=',person.userId).execute();
    expect(sessions.every(s=>s.token_hash!==a.token && s.token_hash!==b.token)).toBe(true);
    await seatAuth.logout(b.token);await expect(seatAuth.authenticate(b.token)).rejects.toMatchObject({code:'SESSION_INVALID'});
  });
  it('serializes six simultaneous real logins into exactly one active epoch',async()=>{
    const person=await user();
    const sessions=await Promise.all(Array.from({length:6},()=>auth.login({username:person.username,password})));
    expect(new Set(sessions.map(s=>s.sessionEpoch)).size).toBe(6);
    const verified=await Promise.allSettled(sessions.map(s=>auth.authenticate(s.token)));
    expect(verified.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(sessions.find(s=>s.sessionEpoch===Math.max(...sessions.map(s=>s.sessionEpoch)))?.sessionEpoch).toBe(7);
    for(const result of verified) if(result.status==='rejected') expect(result.reason).toMatchObject({code:'SESSION_SUPERSEDED'});
  });
  it('requires verified admin identity to reset a no-email password and invalidates old sessions',async()=>{
    const admin=await user(), target=await user(),member=await user();
    await db.updateTable('users').set({role:'admin'}).where('id','=',admin.userId).execute();
    const adminSession=await auth.login({username:admin.username,password});
    const old=await auth.login({username:target.username,password});
    await expect(auth.adminResetPassword({adminToken:adminSession.token,userId:target.userId,newPassword:'reset-123',identityVerified:false})).rejects.toMatchObject({code:'IDENTITY_VERIFICATION_REQUIRED'});
    const memberSession=await auth.login({username:member.username,password});
    await expect(auth.adminResetPassword({adminToken:memberSession.token,userId:target.userId,newPassword:'reset-123',identityVerified:true})).rejects.toMatchObject({code:'FORBIDDEN'});
    await auth.adminResetPassword({adminToken:adminSession.token,userId:target.userId,newPassword:'reset-123',identityVerified:true});
    await expect(auth.authenticate(old.token)).rejects.toMatchObject({code:'SESSION_SUPERSEDED'});
    await expect(auth.login({username:target.username,password})).rejects.toMatchObject({code:'INVALID_CREDENTIALS'});
    expect((await auth.login({username:target.username,password:'reset-123'})).userId).toBe(target.userId);
    const row=await db.selectFrom('users').select(['email','session_epoch']).where('id','=',target.userId).executeTakeFirstOrThrow();
    expect(row.email).toBeNull();expect(row.session_epoch).toBe(old.sessionEpoch+2);
    const emailUser=await user('bound@example.test');
    await expect(auth.adminResetPassword({adminToken:adminSession.token,userId:emailUser.userId,newPassword:'reset-123',identityVerified:true})).rejects.toMatchObject({code:'EMAIL_ACCOUNT_RESET_NOT_SUPPORTED'});
  });
  it('settles real OpenSkill competition ties, keeps three mode ladders isolated and never ranks bots',async()=>{
    const people=await Promise.all(Array.from({length:7},()=>user()));
    const payload=settlement(people.map(p=>p.userId));
    const initial=await ranking.getLeaderboard({seasonTermId:seasonTerm,durationMode:'standard',userId:people[0]!.userId});
    expect(initial).toMatchObject({isEmpty:true,self:{status:'unranked',rankScore:null,leaderboardRank:null}});
    await ranking.startMatch(payload);await ranking.settleMatch(payload);
    expect(await ranking.settleMatch(payload)).toMatchObject({alreadySettled:true});
    const expected=rate(Array.from({length:8},()=>[rating()]),{rank:[1,2,2,4,5,6,7,8]});
    const rows=await db.selectFrom('mode_standings').selectAll().where('season_term_id','=',seasonTerm).where('duration_mode','=','quick').where('user_id','in',people.map(p=>p.userId)).execute();
    expect(rows).toHaveLength(7);
    for(let i=0;i<7;i++){
      const row=rows.find(r=>r.user_id===people[i]!.userId)!;
      expect(row.mu).toBeCloseTo(expected[i]![0]!.mu,10);expect(row.sigma).toBeCloseTo(expected[i]![0]!.sigma,10);
      expect(row.ordinal).toBeCloseTo(ordinal(expected[i]![0]!),10);expect(row.matches_played).toBe(1);
    }
    expect(rows.find(r=>r.user_id===people[1]!.userId)?.mu).toBe(rows.find(r=>r.user_id===people[2]!.userId)?.mu);
    const outside=await ranking.getLeaderboard({seasonTermId:seasonTerm,durationMode:'quick',userId:people[6]!.userId,limit:1});
    expect(outside.self).toMatchObject({status:'ranked',matchesPlayed:1});expect(outside.self.rankScore).not.toBeNull();
    expect(outside.self.leaderboardRank).toBeGreaterThan(1);expect(outside.selfInTopN).toBe(false);expect(outside.isEmpty).toBe(false);
    expect(Object.keys(outside.entries[0]!).sort()).toEqual(['leaderboardRank','nickname','rankScore','tierLabel','userId']);
    const untouched=await ranking.getStanding(seasonTerm,'deep',people[0]!.userId);
    expect(untouched).toMatchObject({status:'unranked',rankScore:null,leaderboardRank:null});
    await ranking.settleMatch(settlement(people.map(p=>p.userId),'deep'));
    expect((await ranking.getStanding(seasonTerm,'quick',people[0]!.userId)).matchesPlayed).toBe(1);
    expect((await ranking.getStanding(seasonTerm,'deep',people[0]!.userId)).matchesPlayed).toBe(1);
    expect((await ranking.getStanding(seasonTerm,'standard',people[0]!.userId)).rankScore).toBeNull();
    const bots=await db.selectFrom('match_participants').selectAll().where('match_id','=',payload.matchId).where('is_bot','=',true).execute();
    expect(bots).toHaveLength(1);expect(bots[0]?.user_id).toBeNull();
  });
  it('stores exact first-version final boards and wrong-question JSONB and preserves tied final ranks',async()=>{
    const person=await user();const payload=settlement([person.userId]);
    await ranking.settleMatch(payload);
    const stored=await db.selectFrom('match_participants').selectAll().where('match_id','=',payload.matchId).where('user_id','=',person.userId).executeTakeFirstOrThrow();
    expect(stored.final_board_snapshot).toEqual(board);expect(stored.wrong_question_ids).toEqual(['math-q-01','eng-q-02']);
    const types=await sql<{board_type:string;wrong_type:string}>`select pg_typeof(final_board_snapshot)::text as board_type,pg_typeof(wrong_question_ids)::text as wrong_type from match_participants where match_id=${payload.matchId} limit 1`.execute(db);
    expect(types.rows[0]).toEqual({board_type:'jsonb',wrong_type:'jsonb'});
    const ties=await db.selectFrom('match_participants').select('seat_id').where('match_id','=',payload.matchId).where('final_rank','=',2).execute();
    expect(ties).toHaveLength(2);
    await expect(db.updateTable('matches').set({game_set_version:'S2'}).where('id','=',payload.matchId).execute()).rejects.toThrow('immutable match version lock');
  });
  it('excludes casual/solo matches from long-term standings and rejects illegal forced tie breaks',async()=>{
    const person=await user();const payload=settlement([person.userId]);payload.queueType='solo';
    await ranking.settleMatch(payload);
    expect((await ranking.getStanding(seasonTerm,'quick',person.userId)).status).toBe('unranked');
    const invalid=settlement([person.userId]);invalid.ranks=[1,2,2,3,5,6,7,8];
    await expect(ranking.settleMatch(invalid)).rejects.toMatchObject({code:'INVALID_COMPETITION_RANKS'});
  });
  it('publishes immutable packs, atomically switches/rolls back versions and keeps running-match locks',async()=>{
    const p1=pack('1.0.0'),p2=pack('1.1.0');await publishCoursePack(db,p1,true);
    const person=await user();const payload=settlement([person.userId]);payload.coursePackId=p1.manifest.packId;
    await ranking.startMatch(payload);
    await publishCoursePack(db,p2,true);
    expect((await getCoursePack(db,p1.manifest.packId)).manifest.coursePackVersion).toBe('1.1.0');
    expect((await getCoursePack(db,p1.manifest.packId,'1.0.0')).manifest.coursePackVersion).toBe('1.0.0');
    await ranking.settleMatch(payload);
    const locked=await db.selectFrom('matches').selectAll().where('id','=',payload.matchId).executeTakeFirstOrThrow();
    expect(locked.course_pack_version).toBe('1.0.0');
    await activateCoursePackVersion(db,p1.manifest.packId,'1.0.0');
    expect((await getCoursePack(db,p1.manifest.packId)).manifest.coursePackVersion).toBe('1.0.0');
    const changed=structuredClone(p1);changed.items[0]!.stemMd='tampered';
    await expect(publishCoursePack(db,changed)).rejects.toMatchObject({code:'IMMUTABLE_PACK_VERSION_CONFLICT'});
    await expect(db.updateTable('course_packs').set({content_sha256:'b'.repeat(64)}).where('pack_id','=',p1.manifest.packId).execute()).rejects.toThrow('immutable course pack');
  });
  it('persists private FSRS, issue reports and class×subject anonymous error rates with distinct-member suppression',async()=>{
    const people=await Promise.all(Array.from({length:3},()=>user()));
    await db.updateTable('users').set({cohort_group:'Class A'}).where('id','in',people.map(p=>p.userId)).execute();
    const card:FsrsCardRecord={familyId:'f1',subject:'math',knowledgeNode:'n1',dueIso:new Date().toISOString(),stability:2,difficulty:3,reps:2,lapses:0,state:2,lastReviewIso:null};
    await saveFsrsCard(db,people[0]!.userId,card);expect(await getPrivateFsrsCards(db,people[0]!.userId)).toEqual([card]);
    expect(await getPrivateFsrsCards(db,people[1]!.userId)).toEqual([]);
    const makeAttempt=(userId:string,subject:'math'|'english',correct:boolean)=>recordLearningAttempt(db,{userId,questionId:'q1',familyId:'f1',subject,coursePackVersion:'1.0.0',knowledgeNode:'n1',isCorrect:correct,answer:'2',isOfflineUnverified:false});
    const attempt=await makeAttempt(people[0]!.userId,'math',false);
    await makeAttempt(people[1]!.userId,'math',true);await makeAttempt(people[2]!.userId,'math',false);
    for(let i=0;i<4;i++) await makeAttempt(people[0]!.userId,'english',false);
    const rows=await queryAnonymousCohortSubjectErrorRates(db,{cohortGroup:'Class A'});
    expect(rows.find(r=>r.subject==='math')).toMatchObject({suppressed:false,sampleSize:3,attemptCount:3,wrongRate:2/3});
    expect(rows.find(r=>r.subject==='english')).toMatchObject({suppressed:true,sampleSize:null,attemptCount:null,wrongRate:null});
    expect(rows.every(r=>!('userId' in r) && !('nickname' in r))).toBe(true);
    const report={questionId:'q1',packVersion:'1.0.0',attemptRef:attempt,reasonCode:'ambiguous_stem' as const,detailOptional:'条件不全'};
    const reportId=await storeQuestionIssueReport(db,people[0]!.userId,report);
    expect((await db.selectFrom('question_issue_reports').selectAll().where('id','=',reportId).executeTakeFirstOrThrow()).detail_optional).toBe('条件不全');
    await expect(storeQuestionIssueReport(db,people[1]!.userId,report)).rejects.toMatchObject({code:'ATTEMPT_NOT_FOUND'});
  });
  it('rejects persisted offline awards, deduplicates cross-entry task quotas and prevents ledger edits/deletes',async()=>{
    const person=await user();
    const attemptId=await recordLearningAttempt(db,{userId:person.userId,questionId:'offline-q',familyId:'offline-f',subject:'math',coursePackVersion:'1.0.0',knowledgeNode:'n1',isCorrect:true,answer:2,isOfflineUnverified:true});
    await expect(grantRewardPoints(db,{userId:person.userId,points:10,reason:'learning',idempotencyKey:randomUUID(),isOfflineUnverified:true})).rejects.toMatchObject({code:'OFFLINE_UNVERIFIED_NOT_REWARDABLE'});
    await expect(grantRewardPoints(db,{userId:person.userId,points:10,reason:'learning',idempotencyKey:randomUUID(),attemptId})).rejects.toMatchObject({code:'OFFLINE_UNVERIFIED_NOT_REWARDABLE'});
    await expect(db.insertInto('reward_points_ledger').values({id:randomUUID(),user_id:person.userId,points_delta:10,
      reason:'direct_illegal_offline_award',idempotency_key:randomUUID(),related_order_id:null,related_attempt_id:attemptId,compensates_ledger_id:null}).execute()).rejects.toThrow('offline unverified attempts cannot mint reward points');
    const key=randomUUID();const input={userId:person.userId,points:100,reason:'learning',idempotencyKey:key,taskQuota:{taskKey:'family-1',quotaWindow:'due-cycle-1'}};
    const [a,b]=await Promise.all([grantRewardPoints(db,input),grantRewardPoints(db,input)]);expect(a.id).toBe(b.id);
    const otherEntry=await grantRewardPoints(db,{...input,idempotencyKey:randomUUID()});expect(otherEntry.id).toBe(a.id);
    expect(await getRewardPointsBalance(db,person.userId)).toBe(100);
    await expect(db.updateTable('reward_points_ledger').set({points_delta:10000}).where('id','=',a.id).execute()).rejects.toThrow('append-only history');
    await expect(db.deleteFrom('reward_points_ledger').where('id','=',a.id).execute()).rejects.toThrow('append-only history');
    await expect(db.deleteFrom('reward_task_quotas').where('user_id','=',person.userId).execute()).rejects.toThrow('append-only history');
  });
  it('locks the real user row against concurrent double-spending, even with different request keys',async()=>{
    const person=await user(),giftId=await gift(10);
    await grantRewardPoints(db,{userId:person.userId,points:100,reason:'test_award',idempotencyKey:randomUUID()});
    const requests=await Promise.allSettled(Array.from({length:16},()=>redeemGiftInSingleTx(db,{userId:person.userId,giftId,idempotencyKey:randomUUID()})));
    expect(requests.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    for(const result of requests) if(result.status==='rejected') expect(result.reason).toMatchObject({code:'INSUFFICIENT_POINTS'});
    expect(await getRewardPointsBalance(db,person.userId)).toBe(0);
    expect((await db.selectFrom('gift_catalog').selectAll().where('id','=',giftId).executeTakeFirstOrThrow()).stock_remaining).toBe(9);
    expect(await listRedemptionOrders(db,person.userId)).toHaveLength(1);
  });
  it('handles 24 real PostgreSQL contenders for the last item, idempotent retries and append-only compensation',async()=>{
    const people=await Promise.all(Array.from({length:24},()=>user()));const giftId=await gift(1);
    await Promise.all(people.map(p=>grantRewardPoints(db,{userId:p.userId,points:200,reason:'test_award',idempotencyKey:randomUUID()})));
    const keys=people.map(()=>randomUUID());
    const results=await Promise.allSettled(people.map((p,i)=>redeemGiftInSingleTx(db,{userId:p.userId,giftId,idempotencyKey:keys[i]!})));
    const wins=results.flatMap((r,i)=>r.status==='fulfilled'?[{order:r.value,user:people[i]!,key:keys[i]!}]:[]);
    expect(wins).toHaveLength(1);const winner=wins[0]!;
    for(const result of results) if(result.status==='rejected') expect(result.reason).toMatchObject({code:'OUT_OF_STOCK'});
    const inventory=()=>db.selectFrom('gift_catalog').selectAll().where('id','=',giftId).executeTakeFirstOrThrow();
    expect((await inventory()).stock_remaining).toBe(0);
    const balances=await Promise.all(people.map(p=>getRewardPointsBalance(db,p.userId)));
    expect(balances.reduce((sum,balance)=>sum+balance,0)).toBe(24*200-100);
    expect(balances.filter(balance=>balance===100)).toHaveLength(1);
    const retries=await Promise.all(Array.from({length:16},()=>redeemGiftInSingleTx(db,{userId:winner.user.userId,giftId,idempotencyKey:winner.key})));
    expect(retries.every(o=>o.orderId===winner.order.orderId)).toBe(true);
    expect((await inventory()).stock_remaining).toBe(0);expect(await getRewardPointsBalance(db,winner.user.userId)).toBe(100);
    const total=await db.selectFrom('redemption_orders').select(sql<string>`count(*)`.as('count')).where('gift_id','=',giftId).executeTakeFirstOrThrow();expect(Number(total.count)).toBe(1);
    const cancelled=await Promise.all(Array.from({length:8},()=>cancelOrderWithCompensation(db,{userId:winner.user.userId,orderId:winner.order.orderId})));
    expect(cancelled.every(o=>o.status==='cancelled_compensated')).toBe(true);
    expect((await inventory()).stock_remaining).toBe(1);expect(await getRewardPointsBalance(db,winner.user.userId)).toBe(200);
    const ledger=await db.selectFrom('reward_points_ledger').selectAll().where('related_order_id','=',winner.order.orderId).orderBy('points_delta').execute();
    expect(ledger.map(l=>l.points_delta)).toEqual([-100,100]);expect(ledger[1]?.compensates_ledger_id).toBe(ledger[0]?.id);
    expect((await redeemGiftInSingleTx(db,{userId:winner.user.userId,giftId,idempotencyKey:winner.key})).status).toBe('cancelled_compensated');
    expect((await inventory()).stock_remaining).toBe(1);
  },30_000);
  it('coalesces same-key concurrent successful redemption requests into exactly one debit and order',async()=>{
    const person=await user(),giftId=await gift(4),key=randomUUID();
    await grantRewardPoints(db,{userId:person.userId,points:300,reason:'test_award',idempotencyKey:randomUUID()});
    const orders=await Promise.all(Array.from({length:12},()=>redeemGiftInSingleTx(db,{userId:person.userId,giftId,idempotencyKey:key})));
    expect(new Set(orders.map(o=>o.orderId)).size).toBe(1);expect(await getRewardPointsBalance(db,person.userId)).toBe(200);
    expect((await db.selectFrom('gift_catalog').selectAll().where('id','=',giftId).executeTakeFirstOrThrow()).stock_remaining).toBe(3);
    const other=await user();await expect(redeemGiftInSingleTx(db,{userId:other.userId,giftId,idempotencyKey:key})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_CONFLICT'});
  });
  it('settles an ended seasonTerm once, waits for in-flight matches, soft-resets only competitive ratings and keeps learning/points',async()=>{
    const person=await user();const payload=settlement([person.userId]);await ranking.startMatch(payload);
    await saveFsrsCard(db,person.userId,{familyId:'persist',subject:'math',knowledgeNode:'n1',dueIso:new Date().toISOString(),stability:1,difficulty:3,reps:1,lapses:0,state:2,lastReviewIso:null});
    await grantRewardPoints(db,{userId:person.userId,points:75,reason:'learning',idempotencyKey:randomUUID()});
    await db.updateTable('season_terms').set({ends_at:new Date(Date.now()-1000)}).where('id','=',seasonTerm).execute();
    const input={oldSeasonId:seasonTerm,newSeason:{id:'NEXT-SEASON-TERM',label:'新赛季',startsAt:new Date(),endsAt:new Date(Date.now()+180*86_400_000)}};
    await expect(ranking.settleSeasonTermAndSoftReset(input)).rejects.toMatchObject({code:'SEASON_MATCHES_STILL_ACTIVE'});
    await ranking.settleMatch(payload); 
    await db.updateTable('mode_standings').set({rank_score:2400,tier_label:'钻石'}).where('user_id','=',person.userId).where('season_term_id','=',seasonTerm).execute();
    const old=await db.selectFrom('mode_standings').selectAll().where('user_id','=',person.userId).where('season_term_id','=',seasonTerm).executeTakeFirstOrThrow();
    const result=await ranking.settleSeasonTermAndSoftReset(input);expect(result.alreadySettled).toBe(false);expect(result.awards).toBeGreaterThan(0);
    expect(await getRewardPointsBalance(db,person.userId)).toBe(375);
    expect((await ranking.getStanding('NEXT-SEASON-TERM','quick',person.userId))).toMatchObject({status:'unranked',rankScore:null,leaderboardRank:null});
    const next=await db.selectFrom('mode_standings').selectAll().where('user_id','=',person.userId).where('season_term_id','=','NEXT-SEASON-TERM').executeTakeFirstOrThrow();
    expect(next.mu).toBeCloseTo(rating().mu+(old.mu-rating().mu)*0.5);expect(next.matches_played).toBe(0);
    expect(await getPrivateFsrsCards(db,person.userId)).toHaveLength(1);
    expect(await ranking.settleSeasonTermAndSoftReset(input)).toEqual({alreadySettled:true,awards:0});
    expect(await getRewardPointsBalance(db,person.userId)).toBe(375);
    await expect(ranking.settleMatch(settlement([person.userId]))).rejects.toMatchObject({code:'SEASON_SETTLED'});
  });
});
