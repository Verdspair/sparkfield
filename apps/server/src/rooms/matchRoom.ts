import { randomUUID } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import { z } from 'zod';
import { CommunicationClientSendSchema, ConfigurableCommunicationPolicy, DEFAULT_TACTICIAN_ID, FinalBoardSnapshotSchema, GameCommandSchema, getMatchChoiceKind, MODE_BUDGETS,
  type CommunicationGovernancePolicy, type CoursePack, type GameCommand, type LessonStepKind,
  type MatchPhaseKind, type ModeStandingSummary, type UserProfile } from '@pkg/contracts';
import { activateLessonRemediation, buildPersonalizedLessonBundle, finalizeLearningGoldCarry,
  gradeFrozenLearningUnits, gradeQuestionSubmission, settleLearningNodeGold,
  type LearningGoldSettlement, type PersonalizedLessonBundle, type SubmissionInput } from '@pkg/learning-core';
import { applyGameCommand, applyLearningGoldGrant, beginNextRound, computeActiveTraits, createGame,
  decideBotPrepCommands, finalPlacements, finalizePrepDeadline, resolveRoundBattles, settleRound,
  type GameState, type ResolvedRound, type SeatState } from '@pkg/game-core';
import type { AuthService, AuthenticatedSession } from '../auth/authService.js';
import type { AppDatabase } from '../db/client.js';
import { ServiceError } from '../db/errors.js';
import { getPrivateFsrsCards } from '../db/repositories.js';
import type { LearningService } from '../learning/learningService.js';
import type { CreateMatchInput } from '../lobby/lobbyService.js';
import type { MatchStartInput, RankingService } from '../ranking/rankingService.js';

export interface MatchRuntime {
  db: AppDatabase; auth: AuthService; ranking: RankingService; learning: LearningService;
  timeScale: number; reconnectProtectionMs: number; gameSeed?:number; communicationPolicy?: CommunicationGovernancePolicy;
  register(room: MatchRoom): void; unregister(room: MatchRoom): void;
}
export interface MatchRoomOptions {
  runtime: MatchRuntime;
  capability: symbol;
  expectedCapability: symbol;
  input: CreateMatchInput;
  start: MatchStartInput;
  packs: CoursePack[];
  botDifficulty: SeatState['botDifficulty'];
}
interface LearningProgress {
  bundle: PersonalizedLessonBundle; submissions: Record<string, SubmissionInput>;
  step: number; complete: boolean; feedback: Record<string, unknown>; settled: boolean;
}
interface Binding { token: string; userId: string; epoch: number; seatId: string }
const STEPS: LessonStepKind[] = ['material','practice','resource_check','remediation','verification'];
const CHOICE_COMMANDS = new Set(['PICK_AUGMENT','REROLL_AUGMENT_SLOT','PICK_ANVIL_OPTION']);
const LearningMessage = z.object({requestId:z.string().max(100).optional(), action:z.enum(['advance','submit']),
  questionId:z.string().optional(), submission:z.unknown().optional()}).strict();

export class MatchRoom extends Room {
  runtime!: MatchRuntime;
  input!: CreateMatchInput;
  start!: MatchStartInput;
  packs!: CoursePack[];
  game!: GameState;
  phase: MatchPhaseKind = 'entry';
  phaseIndex = -1;
  nodeIndex = -1;
  deadlineEpochMs = 0;
  completed = false;
  failure: string | null = null;
  private readonly humans = new Map<string, {profile:UserProfile;seatId:string}>();
  private readonly bindings = new Map<string, Binding>();
  private readonly controllers = new Map<string, string>();
  private readonly disconnectedAt = new Map<string, number>();
  private readonly lessons = new Map<string, LearningProgress>();
  private readonly wrong = new Map<string, Set<string>>();
  private readonly settlements = new Map<string, LearningGoldSettlement[]>();
  private readonly sendTimes = new Map<string, number[]>();
  private readonly communicationIds = new Map<string, Set<string>>();
  private readonly summaries = new Map<string, unknown>();
  private readonly standingsBefore = new Map<string,ModeStandingSummary>();
  private readonly responses = new Map<string, {phaseIndex:number;value:object}>();
  private readonly persistence = new Set<Promise<void>>();
  private readonly learningTotals = new Map<string,{rewardPointsGranted:number;attemptIds:string[]}>();
  private pendingBattle: ResolvedRound | null = null;
  private sequence: Promise<unknown> = Promise.resolve();
  private timeout?: ReturnType<typeof setTimeout>;
  private guardTimer?: ReturnType<typeof setTimeout>;
  private policy!: CommunicationGovernancePolicy;
  private disposed = false;

  async onCreate(options: MatchRoomOptions): Promise<void> {
    if (typeof options.capability !== 'symbol' || options.capability !== options.expectedCapability || !options.runtime) {
      throw new ServerError(403, 'COORDINATOR_ONLY');
    }
    this.autoDispose = false; this.maxClients = 24; this.patchRate = null; this.maxMessagesPerSecond = 80;
    this.runtime = options.runtime; this.input = options.input; this.start = options.start; this.packs = options.packs;
    this.policy = this.runtime.communicationPolicy ?? new ConfigurableCommunicationPolicy();
    this.game = createGame(this.input.durationMode, this.runtime.gameSeed ?? parseInt(randomUUID().slice(0,8),16));
    for (let i=0;i<this.game.seats.length;i++) {
      const seat=this.game.seats[i]!; const profile=this.input.humans[i];
      seat.botDifficulty=options.botDifficulty; seat.isBot=!profile;
      if (profile) { this.humans.set(profile.userId,{profile,seatId:seat.id});
        this.wrong.set(profile.userId,new Set()); this.settlements.set(profile.userId,[]);
        this.disconnectedAt.set(profile.userId,Date.now());
        this.learningTotals.set(profile.userId,{rewardPointsGranted:0,attemptIds:[]}); }
    }
    await this.runtime.ranking.startMatch(this.start);
    if(this.input.queueType==='ranked')await Promise.all([...this.humans.keys()].map(async userId=>{
      this.standingsBefore.set(userId,await this.runtime.ranking.getStanding(this.start.seasonTermId,this.game.mode,userId));
    }));
    this.runtime.register(this);
    this.onMessage('snapshot', (client) => { void this.run(client,'snapshot_result',undefined,()=>({ok:true})); });
    this.onMessage('command', (client, message: unknown) => {
      const requestId=this.requestId(message), receivedAt=Date.now(), receivedPhaseIndex=this.phaseIndex;
      void this.run(client,'command_result',requestId,(session,binding)=> {
        if(receivedAt>=this.deadlineEpochMs || receivedPhaseIndex!==this.phaseIndex)throw new ServiceError('PHASE_WINDOW_CLOSED');
        const object=z.object({requestId:z.string().max(100).optional(),command:GameCommandSchema}).strict().parse(message);
        const result=this.applyCommand(binding.seatId,object.command);
        if (!result.ok) throw new ServiceError(result.reason ?? 'COMMAND_REJECTED');
        return {ok:true};
      });
    });
    this.onMessage('learning', (client,message:unknown) => { void this.run(client,'learning_result',this.requestId(message),
      (session)=>this.learningCommand(session.userId,LearningMessage.parse(message))); });
    this.onMessage('communicate',(client,message:unknown)=> { void this.run(client,'communication_result',this.requestId(message),
      (session)=>this.communicate(session,message)); });
    await this.transition();
  }
  private requestId(message:unknown): string | undefined {
    return message && typeof message==='object' && 'requestId' in message && typeof message.requestId==='string'
      ? message.requestId.slice(0,100) : undefined;
  }
  private enqueue<T>(operation:()=>Promise<T>|T):Promise<T> {
    const next=this.sequence.then(operation); this.sequence=next.catch(()=>undefined); return next;
  }
  private async run(client:Client,type:string,requestId:string|undefined,
    command:(session:AuthenticatedSession,binding:Binding)=>unknown|Promise<unknown>):Promise<void> {
    const receivedAt=Date.now();
    await this.enqueue(async()=> {
      try {
        const binding=this.bindings.get(client.sessionId);
        if (!binding) throw new ServiceError('SESSION_INVALID');
        const result=await this.runtime.auth.withAuthenticatedSession(binding.token,async(session)=> {
          if (this.controllers.get(session.userId)!==client.sessionId) throw new ServiceError('SESSION_SUPERSEDED');
          if (session.userId!==binding.userId || session.sessionEpoch!==binding.epoch) throw new ServiceError('SESSION_SUPERSEDED');
          const key=requestId?`${session.userId}:${type}:${requestId}`:null;
          const cached=key?this.responses.get(key):undefined;
          if(cached) {
            if(['command_result','learning_result'].includes(type) &&
              (cached.phaseIndex!==this.phaseIndex || receivedAt>=this.deadlineEpochMs))throw new ServiceError('PHASE_WINDOW_CLOSED');
            return cached.value;
          }
          const value=await command(session,binding);
          if(key) {this.responses.set(key,{phaseIndex:this.phaseIndex,value:value as object});if(this.responses.size>2000)this.responses.delete(this.responses.keys().next().value!);}
          return value;
        });
        client.send(type,{requestId,...result as object});
        this.sendSnapshot(client,binding.userId);
      } catch(error) {
        client.send(type,{requestId,ok:false,reason:this.errorCode(error)});
      }
    });
  }
  private errorCode(error:unknown):string {
    if (error instanceof ServiceError) return error.code;
    if (error instanceof z.ZodError) return 'INVALID_MESSAGE';
    return error instanceof Error ? error.message : 'INTERNAL_ERROR';
  }
  async onAuth(_client:Client,options:unknown):Promise<AuthenticatedSession & {token:string}> {
    const {token}=z.object({token:z.string().min(1)}).parse(options);
    const session=await this.runtime.auth.authenticate(token);
    if (!this.humans.has(session.userId)) throw new ServerError(403,'SEAT_NOT_FOUND');
    return {...session,token};
  }
  async onJoin(client:Client,_options:unknown,auth:AuthenticatedSession & {token:string}):Promise<void> {
    await this.enqueue(()=>this.runtime.auth.withAuthenticatedSession(auth.token,(session)=> {
      const human=this.humans.get(session.userId); if (!human) throw new ServiceError('SEAT_NOT_FOUND');
      const previous=this.controllers.get(session.userId);
      if (previous && previous!==client.sessionId) this.clients.find(c=>c.sessionId===previous)?.send('session_superseded',{reason:'SESSION_SUPERSEDED'});
      const stale=[...this.bindings].filter(([,b])=>b.userId===session.userId).sort((a,b)=>b[1].epoch-a[1].epoch);
      for(const [sessionId] of stale.slice(1)) {this.clients.find(c=>c.sessionId===sessionId)?.leave(4001);this.bindings.delete(sessionId);}
      this.bindings.set(client.sessionId,{token:auth.token,userId:session.userId,epoch:session.sessionEpoch,seatId:human.seatId});
      this.controllers.set(session.userId,client.sessionId); this.disconnectedAt.delete(session.userId);
      this.sendSnapshot(client,session.userId);
    }));
  }
  async onDrop(client:Client):Promise<void> {
    const binding=this.bindings.get(client.sessionId);
    if(!binding || this.controllers.get(binding.userId)!==client.sessionId)return;
    this.controllers.delete(binding.userId);this.disconnectedAt.set(binding.userId,Date.now());
    this.scheduleProtectionCheck();
    await this.allowReconnection(client,this.runtime.reconnectProtectionMs/1000).catch(()=>undefined);
  }
  async onReconnect(client:Client):Promise<void> {
    await this.enqueue(async()=> {
      const binding=this.bindings.get(client.sessionId);
      if(!binding)throw new ServerError(4001,'SESSION_SUPERSEDED');
      await this.runtime.auth.withAuthenticatedSession(binding.token,(session)=> {
        const controller=this.controllers.get(session.userId);
        if(session.userId!==binding.userId || session.sessionEpoch!==binding.epoch ||
          (controller && controller!==client.sessionId))throw new ServerError(4001,'SESSION_SUPERSEDED');
        this.controllers.set(session.userId,client.sessionId);this.disconnectedAt.delete(session.userId);
        this.sendSnapshot(client,session.userId);
      });
    });
  }
  onLeave(client:Client):void {
    const binding=this.bindings.get(client.sessionId); this.bindings.delete(client.sessionId);
    if (binding && this.controllers.get(binding.userId)===client.sessionId) {
      this.controllers.delete(binding.userId); this.disconnectedAt.set(binding.userId,Date.now());
      this.scheduleProtectionCheck();
    }
  }
  async supersede(userId:string):Promise<void> {
    const current=this.controllers.get(userId), binding=current?this.bindings.get(current):undefined;
    if(!current || !binding)return;
    try {await this.runtime.auth.authenticate(binding.token);return;} catch(error) {
      if(!(error instanceof ServiceError) || !['SESSION_SUPERSEDED','SESSION_EXPIRED','SESSION_INVALID'].includes(error.code))throw error;
    }
    if(this.controllers.get(userId)===current) {
      this.clients.find(c=>c.sessionId===current)?.send('session_superseded',{reason:'SESSION_SUPERSEDED'});
      this.controllers.delete(userId);this.disconnectedAt.set(userId,Date.now());this.scheduleProtectionCheck();
    }
  }
  seatFor(userId:string):string|undefined { return this.humans.get(userId)?.seatId; }
  activeSeat(userId:string):unknown|null {
    if (!this.humans.has(userId) || this.completed || this.failure) return null;
    return this.snapshot(userId);
  }
  private allowedChoice(command:GameCommand):boolean {
    const label=MODE_BUDGETS.modes[this.game.mode].timeline[this.phaseIndex]?.label ?? '';
    const kind=getMatchChoiceKind(this.phase,label);
    return kind==='augment' ? ['PICK_AUGMENT','REROLL_AUGMENT_SLOT'].includes(command.type)
      : kind==='anvil' && command.type==='PICK_ANVIL_OPTION';
  }
  private applyCommand(seatId:string,command:GameCommand):{ok:boolean;reason?:string} {
    if(this.failure||this.disposed||this.completed)return {ok:false,reason:'MATCH_NOT_ACTIVE'};
    const seat=this.game.seats.find(s=>s.id===seatId)!;
    if (command.type==='SET_LINEUP_PLAN') {seat.lineupPlan=[...command.unitIds]; return {ok:true};}
    if (CHOICE_COMMANDS.has(command.type)) {
      if (!this.allowedChoice(command)) return {ok:false,reason:'CHOICE_WINDOW_REQUIRED'};
    } else if (this.phase!=='strategy') return {ok:false,reason:'STRATEGY_PHASE_REQUIRED'};
    return applyGameCommand(this.game,seatId,command);
  }
  private normalizeStep(progress:LearningProgress):void {
    while(progress.step<STEPS.length) {
      const kind=STEPS[progress.step]!; const step=progress.bundle.steps[progress.step]!;
      if (!step.active || (kind!=='material' && kind!=='remediation' && step.questionIds.length===0)) {progress.step++;continue;}
      break;
    }
    progress.complete=progress.step>=STEPS.length;
  }
  private learningCommand(userId:string,message:z.infer<typeof LearningMessage>):unknown {
    if(this.failure||this.disposed||this.completed)throw new ServiceError('MATCH_NOT_ACTIVE');
    if (this.phase!=='learning' || Date.now()>=this.deadlineEpochMs) throw new ServiceError('LEARNING_WINDOW_CLOSED');
    const progress=this.lessons.get(userId); if (!progress) throw new ServiceError('LESSON_NOT_FOUND');
    this.normalizeStep(progress); if (progress.complete) throw new ServiceError('LEARNING_ALREADY_COMPLETE');
    const kind=STEPS[progress.step]!; const step=progress.bundle.steps[progress.step]!;
    if (message.action==='advance') {
      if (kind!=='material' && kind!=='remediation') throw new ServiceError('STEP_REQUIRES_SUBMISSIONS');
      progress.step++; this.normalizeStep(progress); return {ok:true,complete:progress.complete};
    }
    if (!message.questionId || !step.questionIds.includes(message.questionId)) throw new ServiceError('QUESTION_NOT_IN_CURRENT_STEP');
    if (Object.hasOwn(progress.submissions,message.questionId)) throw new ServiceError('SUBMISSION_LOCKED');
    const question=progress.bundle.questions.find(q=>q.questionId===message.questionId)!;
    const submission=message.submission as SubmissionInput ?? {status:'skipped'};
    const answer=z.union([z.string().max(10000),z.number().finite(),z.array(z.string().max(1000)).max(100),
      z.record(z.string(),z.union([z.string().max(1000),z.number().finite()]))]);
    const wrapped=z.object({answer:answer.nullable().optional(),status:z.enum(['submitted','skipped','timed_out']).optional(),
      questionId:z.literal(question.questionId).optional(),hintUsed:z.boolean().optional()}).strict();
    const isWrapper=submission && typeof submission==='object' && !Array.isArray(submission)
      && ['answer','status','questionId','hintUsed'].some(key=>key in submission);
    const parsed=(isWrapper?wrapped.parse(submission):answer.nullable().parse(submission)) as SubmissionInput;
    if(question.stepRole!=='practice' && parsed && typeof parsed==='object' && !Array.isArray(parsed)
      && 'hintUsed' in parsed && parsed.hintUsed===true)throw new ServiceError('SCORED_QUESTION_HINT_FORBIDDEN');
    const grade=gradeQuestionSubmission(question,parsed);
    progress.submissions[question.questionId]=structuredClone(parsed);
    const feedback={...grade,explanationMd:question.explanationMd}; progress.feedback[question.questionId]=feedback;
    if (!grade.isCorrect) this.wrong.get(userId)!.add(question.questionId);
    if (step.questionIds.every(id=>Object.hasOwn(progress.submissions,id))) {
      if (kind==='resource_check') progress.bundle=activateLessonRemediation(progress.bundle,progress.submissions,true);
      progress.step++; this.normalizeStep(progress);
    }
    return {ok:true,feedback,complete:progress.complete};
  }
  private communicate(session:AuthenticatedSession,raw:unknown):unknown {
    const message=CommunicationClientSendSchema.parse(raw);
    if (message.channel!=='match' || message.targetId!==this.roomId) throw new ServiceError('COMMUNICATION_TARGET_INVALID');
    if (message.kind==='text' ? !this.policy.allowTextChat : !this.policy.allowSignalsAndEmotes) throw new ServiceError('COMMUNICATION_DISABLED');
    const seen=this.communicationIds.get(session.userId) ?? new Set<string>();
    if (seen.has(message.clientMsgId)) throw new ServiceError('DUPLICATE_MESSAGE');
    const now=Date.now(), times=(this.sendTimes.get(session.userId) ?? []).filter(t=>now-t<this.policy.rateLimitWindowMs);
    if (times.length>=this.policy.maxMessagesPerWindow) throw new ServiceError('COMMUNICATION_RATE_LIMIT');
    const filtered=this.policy.filterTextPayload(message.payload); if(!filtered.allowed) throw new ServiceError('COMMUNICATION_FILTERED');
    times.push(now);this.sendTimes.set(session.userId,times);seen.add(message.clientMsgId);
    if(seen.size>100)seen.delete(seen.values().next().value!); this.communicationIds.set(session.userId,seen);
    const envelope={msgId:randomUUID(),channel:'match',targetId:this.roomId,kind:message.kind,payload:filtered.sanitized,
      senderUserId:session.userId,senderNickname:session.profile.nickname,createdAtEpochMs:now};
    for(const client of this.clients) {const binding=this.bindings.get(client.sessionId);
      if(binding && this.controllers.get(binding.userId)===client.sessionId && !this.policy.isSenderBlocked(binding.userId,session.userId))client.send('communication',envelope);}
    return {ok:true,msgId:envelope.msgId};
  }
  private scheduleProtectionCheck():void {
    if(this.guardTimer)clearTimeout(this.guardTimer);
    if(this.disposed || !['strategy','choice'].includes(this.phase))return;
    const pending=[...this.disconnectedAt.values()].map(t=>t+this.runtime.reconnectProtectionMs-Date.now()).filter(t=>t>0);
    if(!pending.length)return;
    this.guardTimer=setTimeout(()=>{void this.enqueue(()=>{this.runBots();this.broadcastSnapshots();this.scheduleProtectionCheck();});},Math.min(...pending)+1);
  }
  private runBots():void {
    if(!['strategy','choice'].includes(this.phase) || this.game.phase!=='prep')return;
    for(const seat of this.game.seats) {
      const human=[...this.humans].find(([,h])=>h.seatId===seat.id);
      if(human) {const disconnected=this.disconnectedAt.get(human[0]);
        if(disconnected===undefined || Date.now()-disconnected<this.runtime.reconnectProtectionMs)continue;}
      for(const command of decideBotPrepCommands(this.game,seat.id,seat.botDifficulty))this.applyCommand(seat.id,command);
    }
  }
  private async transition():Promise<void> {
    if(this.disposed || this.failure)return;
    const timeline=MODE_BUDGETS.modes[this.game.mode].timeline;
    this.phaseIndex++;
    if(this.phaseIndex>=timeline.length) {this.broadcast('match_complete',{matchId:this.start.matchId});
      this.clock.setTimeout(()=>{void this.disconnect();},300_000);return;}
    const event=timeline[this.phaseIndex]!; this.phase=event.kind as MatchPhaseKind;
    if(this.game.phase!=='finished' && this.game.settledRounds.includes(this.game.round) &&
      ['learning','strategy','choice'].includes(this.phase)) {
      const postBattleChoice=this.phase==='choice' && /战后|PVE.*补给|PVE.*选择/u.test(event.label);
      if(!postBattleChoice)beginNextRound(this.game);
      else this.game.phase='prep';
    }
    if(this.phase==='learning') {
      this.nodeIndex++; this.lessons.clear();
      for(const [userId,human] of this.humans) {
        const prefs=this.input.humanPrefs[userId]; const subject=this.input.queueType==='ranked'?this.input.sharedSubject:prefs?.subject ?? this.input.sharedSubject;
        const bundle=buildPersonalizedLessonBundle({packs:this.packs,mode:this.game.mode,nodeIndex:this.nodeIndex,
          queueType:this.input.queueType,selectedSubjects:[subject],rankedSubject:this.input.sharedSubject,now:new Date(),
          cards:await getPrivateFsrsCards(this.runtime.db,userId),
          progress:Object.entries(human.profile.learningStartSelections).map(([subject,knowledgeNode])=>({subject:subject as 'english'|'math',knowledgeNode:knowledgeNode!}))});
        const progress:LearningProgress={bundle,submissions:{},step:0,complete:false,feedback:{},settled:false};
        this.normalizeStep(progress);this.lessons.set(userId,progress);
      }
    } else if(this.phase==='resource') {
      for(const [userId,progress] of this.lessons) {
        if(progress.settled)continue;
        const seat=this.game.seats.find(s=>s.id===this.humans.get(userId)!.seatId)!;
        const settlement=settleLearningNodeGold({mode:this.game.mode,blockIndex:this.nodeIndex,
          gradedUnits:gradeFrozenLearningUnits(progress.bundle.questions,progress.submissions),carryInCents:seat.learningChargeCents});
        applyLearningGoldGrant(seat,settlement.grantedIntegerGold,settlement.carryOutCents);
        seat.learningGoldOrbs=[...settlement.orbSplits]; progress.settled=true;
        this.settlements.get(userId)!.push(settlement);
        for(const question of progress.bundle.questions) {
          if(!gradeQuestionSubmission(question,progress.submissions[question.questionId]).isCorrect)this.wrong.get(userId)!.add(question.questionId);
        }
        const persistedNodeIndex=this.nodeIndex;
        let pending:Promise<void>;
        pending=this.runtime.learning.persistNode(userId,progress.bundle,progress.submissions,{
          source:'match_learning',coursePackVersion:this.start.coursePackVersion,
          questionVersions:Object.fromEntries(this.packs.flatMap(p=>p.items.map(q=>[q.questionId,p.manifest.coursePackVersion]))),
          idempotencyKey:`match:${this.start.matchId}:${userId}:node:${this.nodeIndex}`}).then(persisted=>{
            const total=this.learningTotals.get(userId)!;total.rewardPointsGranted+=persisted.rewardPointsGranted;
            total.attemptIds.push(...persisted.attemptIds);
            const controller=this.controllers.get(userId);
            if(controller)this.clients.find(client=>client.sessionId===controller)?.send('learning_persisted',{
              nodeIndex:persistedNodeIndex,rewardPointsGranted:persisted.rewardPointsGranted,attemptIds:persisted.attemptIds});
          }).catch(error=>{this.fail(error);}).finally(()=>{this.persistence.delete(pending);});
        this.persistence.add(pending);
      }
    } else if(this.phase==='strategy' || this.phase==='choice') {
      this.runBots();
    } else if(this.phase==='battle') {
      finalizePrepDeadline(this.game); this.pendingBattle=resolveRoundBattles(this.game);
      this.broadcast('battle',{round:this.game.round,battles:this.pendingBattle.battles});
    } else if(this.phase==='settlement') {
      if(!this.pendingBattle)throw new Error('MISSING_BATTLE');
      settleRound(this.game,this.pendingBattle.outcomes);this.pendingBattle=null;
    } else if(this.phase==='exit') await this.finish();
    if(this.failure)return;
    this.deadlineEpochMs=Date.now()+Math.max(1,event.duration*1000*this.runtime.timeScale);
    this.broadcastSnapshots();this.scheduleProtectionCheck();
    this.timeout=setTimeout(()=>{void this.enqueue(()=>this.transition()).catch(error=>this.fail(error));},Math.max(1,this.deadlineEpochMs-Date.now()));
  }
  private async finish():Promise<void> {
    await Promise.all(this.persistence);if(this.failure)throw new Error(this.failure);
    const placements=finalPlacements(this.game.seats);
    const participants=this.game.seats.map(seat=>{
      const human=[...this.humans].find(([,h])=>h.seatId===seat.id);
      return {seatId:seat.id,userId:human?.[0] ?? null,isBot:!human,quarterPoints:seat.victoryPoints,
        finalBoardSnapshot:FinalBoardSnapshotSchema.parse({level:seat.level,activeTraits:computeActiveTraits(seat.units),chosenAugments:[...seat.chosenAugments],
          units:seat.units.flatMap(u=>u.location.zone==='board'?[{unitId:u.unitId,star:u.star,items:[...u.items],row:u.location.row,col:u.location.col}]:[])}),
        wrongQuestionIds:human?[...this.wrong.get(human[0])!]:[]};
    });
    await this.runtime.ranking.settleMatch({...this.start,participants,
      ranks:participants.map(p=>placements.find(x=>x.seatId===p.seatId)!.place)});
    this.completed=true;
    for(const [userId,human] of this.humans) {
      const seat=this.game.seats.find(s=>s.id===human.seatId)!;
      const carry=finalizeLearningGoldCarry(seat.learningChargeCents);seat.learningChargeCents=0;
      const standing=this.input.queueType==='ranked'
        ? await this.runtime.ranking.getStanding(this.start.seasonTermId,this.game.mode,userId).catch(()=>null):null;
      const before=this.standingsBefore.get(userId)??null;
      const summary={competitive:{matchId:this.start.matchId,queueType:this.input.queueType,placements,
        seatId:human.seatId,place:placements.find(p=>p.seatId===human.seatId)!.place,quarterPoints:seat.victoryPoints,
        standing,standingBefore:before,rankScoreDelta:standing?.rankScore!=null && before?.rankScore!=null ? standing.rankScore-before.rankScore:null,
        standingStatus:this.input.queueType!=='ranked'?'not_applicable':standing?'confirmed':'pending_verification',
        finalBoardSnapshot:participants.find(p=>p.seatId===human.seatId)!.finalBoardSnapshot},
        learning:{wrongQuestionIds:[...this.wrong.get(userId)!],nodes:this.settlements.get(userId),...this.learningTotals.get(userId),...carry}};
      this.summaries.set(userId,summary);
      const controller=this.controllers.get(userId);if(controller)this.clients.find(c=>c.sessionId===controller)?.send('summary',summary);
    }
    this.completed=true;
  }
  private snapshot(userId:string):Record<string,unknown> {
    const human=this.humans.get(userId)!;const progress=this.lessons.get(userId);
    const current=progress && !progress.complete?STEPS[progress.step]:null;
    return {roomId:this.roomId,matchId:this.start.matchId,mode:this.game.mode,queueType:this.input.queueType,
      phase:this.phase,phaseIndex:this.phaseIndex,deadlineEpochMs:this.deadlineEpochMs,
      remainingSeconds:Math.max(0,(this.deadlineEpochMs-Date.now())/(1000*this.runtime.timeScale)),
      round:this.game.round,nodeIndex:this.nodeIndex,versionLock:{seasonTermId:this.start.seasonTermId,
        gameSetVersion:this.start.gameSetVersion,coursePackVersion:this.start.coursePackVersion},
      seatId:human.seatId,self:structuredClone(this.game.seats.find(s=>s.id===human.seatId)),
      seats:this.game.seats.map(seat=>{const identity=[...this.humans.values()].find(h=>h.seatId===seat.id);
        return {seatId:seat.id,nickname:identity?.profile.nickname ?? `领航员 ${seat.id.slice(5)}`,level:seat.level,
          tacticianId:identity?.profile.preferredTacticianId ?? DEFAULT_TACTICIAN_ID,
          units:seat.units.filter(u=>u.location.zone==='board'),victoryPoints:seat.victoryPoints,
          ...(this.input.queueType==='solo'?{isBot:seat.isBot}:{}),chosenAugments:seat.chosenAugments};}),
      battle:this.phase==='battle' && this.pendingBattle?{round:this.game.round,battles:this.pendingBattle.battles}:null,
      learning:progress?{nodeIndex:this.nodeIndex,currentStep:current,complete:progress.complete,
        clientQuestions:progress.bundle.clientQuestions.filter(q=>q.stepRole===current),
        steps:progress.bundle.steps.map((step,index)=>({kind:step.kind,active:step.active,plannedSeconds:step.plannedSeconds,
          questionIds:step.questionIds,materials:index===progress.step?step.materials:[],
          corrections:index===progress.step?step.corrections:[]})),
        submittedQuestionIds:Object.keys(progress.submissions),feedback:progress.feedback}:null,
      resourceSettlement:this.settlements.get(userId)?.at(-1) ?? null,summary:this.summaries.get(userId) ?? null,
      completed:this.completed,failure:this.failure};
  }
  private sendSnapshot(client:Client,userId:string):void {client.send('snapshot',this.snapshot(userId));}
  private broadcastSnapshots():void {
    for(const client of this.clients) {const binding=this.bindings.get(client.sessionId);
      if(binding && this.controllers.get(binding.userId)===client.sessionId)this.sendSnapshot(client,binding.userId);}
  }
  private fail(error:unknown):void {
    if(this.failure || this.disposed)return;
    this.failure=this.errorCode(error);if(this.timeout)clearTimeout(this.timeout);if(this.guardTimer)clearTimeout(this.guardTimer);
    this.broadcast('match_error',{reason:this.failure,competitiveResultVoided:!this.completed});this.broadcastSnapshots();
    void this.runtime.db.updateTable('matches').set({status:'completed',completed_at:new Date()})
      .where('id','=',this.start.matchId).where('status','=','active').execute().catch(()=>undefined);
    this.clock.setTimeout(()=>{void this.disconnect();},60_000);
  }
  async onDispose():Promise<void> {
    this.disposed=true;if(this.timeout)clearTimeout(this.timeout);if(this.guardTimer)clearTimeout(this.guardTimer);
    await Promise.all(this.persistence);
    if(!this.completed)await this.runtime.db.updateTable('matches').set({status:'completed',completed_at:new Date()})
      .where('id','=',this.start.matchId).where('status','=','active').execute();
    this.runtime.unregister(this);
  }
}
