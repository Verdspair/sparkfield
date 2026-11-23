import { randomUUID } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import { z } from 'zod';
import { CommunicationClientSendSchema, ConfigurableCommunicationPolicy, DEFAULT_TACTICIAN_ID, FinalBoardSnapshotSchema, GameCommandSchema, getMatchChoiceKind, MODE_BUDGETS,
  type CommunicationGovernancePolicy, type CoursePack, type GameCommand,
  type MatchPhaseKind, type MatchStudyBlueprint, type ModeStandingSummary, type SubjectId, type UserProfile } from '@pkg/contracts';
import { activateLessonRemediation, buildMatchStudyBlueprint, buildPersonalizedLessonBundle, evaluateLearningBonusDrops, finalizeLearningGoldCarry, roomSlotBonusStage,
  formatCorrectAnswerDisplay, gradeFrozenLearningUnits, gradeQuestionSubmission, locateMatchStudySlot, settleLearningNodeGold,
  type ArcAttempt, type GradedLearningUnit, type LearningGoldSettlement, type MatchStudyBlueprintInput, type PersonalizedLessonBundle,
  type RecentLearningPerformance, type SubmissionInput } from '@pkg/learning-core';
import { applyGameCommand, applyLearningBonusGrant, applyLearningGoldGrant, BATTLE_REGULAR_MS, beginNextRound, computeActiveTraits, computeRoundBattleDurationMs, createGame, createRng,
  decideBotPrepCommands, finalPlacements, finalizePrepDeadline, longestBattleElapsedMs, randomInt, resolveRoundBattles, settleRound,
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
  step: number; complete: boolean; readyToProceed: boolean; feedback: Record<string, unknown>; settled: boolean;
}
interface MatchStudyState {
  blueprint: MatchStudyBlueprint;
  startEvidence: Pick<MatchStudyBlueprintInput,'now'|'cards'|'progress'|'recentPerformance'>;
  arcIndex: number;
  usedQuestionIds: Set<string>;
  attempts: ArcAttempt[];
}
interface Binding { token: string; userId: string; epoch: number; seatId: string }
interface PendingBattle {
  payload: Pick<ResolvedRound,'round'|'battles'> & {
    overtimeAtMs: number; longestBattleMs: number; startedAtEpochMs: number; timeScale: number;
  };
  outcomes: ResolvedRound['outcomes'];
}
const CHOICE_COMMANDS = new Set(['PICK_AUGMENT','REROLL_AUGMENT_SLOT','PICK_ANVIL_OPTION']);
const LearningMessage = z.object({requestId:z.string().max(100).optional(), action:z.enum(['advance','submit']),
  questionId:z.string().optional(), submission:z.unknown().optional()}).strict();

interface BotLearningPlan {
  completionPercent: number;
  gradedUnits: GradedLearningUnit[];
  botLearningDone: boolean;
}

const BOT_LEARNING_RANGES = {
  novice: { completion: [55, 86], score: [48, 64] },
  standard: { completion: [45, 76], score: [66, 82] },
  veteran: { completion: [36, 68], score: [78, 94] },
} as const;

function createBotLearningPlan(seed: number, nodeIndex: number, seatIndex: number, difficulty: SeatState['botDifficulty']): BotLearningPlan {
  const rng = createRng(`${seed >>> 0}:bot-learning:${nodeIndex}:${seatIndex}`);
  const { completion, score } = BOT_LEARNING_RANGES[difficulty];
  const completionPercent = completion[0] + randomInt(rng, completion[1] - completion[0] + 1);
  const scorePercent = score[0] + randomInt(rng, score[1] - score[0] + 1);
  const quality = { numerator: String(scorePercent), denominator: '100' };
  return {
    completionPercent,
    gradedUnits: [
      { stepRole: 'resource_check', weight: 1, quality },
      { stepRole: 'verification', weight: 1, quality },
    ],
    botLearningDone: false,
  };
}

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
  private readonly botLearningPlans = new Map<string, BotLearningPlan>();
  private readonly botLearningTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private gameSeed = 0;
  private readonly studies = new Map<string, MatchStudyState>();
  private readonly wrong = new Map<string, Set<string>>();
  private readonly settlements = new Map<string, LearningGoldSettlement[]>();
  private readonly sendTimes = new Map<string, number[]>();
  private readonly communicationIds = new Map<string, Set<string>>();
  private readonly summaries = new Map<string, unknown>();
  private readonly standingsBefore = new Map<string,ModeStandingSummary>();
  private readonly responses = new Map<string, {phaseIndex:number;value:object}>();
  private readonly persistence = new Set<Promise<void>>();
  private readonly learningTotals = new Map<string,{rewardPointsGranted:number;attemptIds:string[]}>();
  private pendingBattle: PendingBattle | null = null;
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
    const seed=this.runtime.gameSeed ?? parseInt(randomUUID().slice(0,8),16);
    const now=new Date();
    this.gameSeed = seed;
    this.game = createGame(this.input.durationMode,seed);
    for (let i=0;i<this.game.seats.length;i++) {
      const seat=this.game.seats[i]!; const profile=this.input.humans[i];
      seat.botDifficulty=options.botDifficulty; seat.isBot=!profile;
      if (profile) { this.humans.set(profile.userId,{profile,seatId:seat.id});
        this.wrong.set(profile.userId,new Set()); this.settlements.set(profile.userId,[]);
        this.disconnectedAt.set(profile.userId,Date.now());
        this.learningTotals.set(profile.userId,{rewardPointsGranted:0,attemptIds:[]}); }
    }
    await Promise.all([...this.humans].map(async ([userId,human])=>{
      const prefs=this.input.humanPrefs[userId];
      const subject=this.input.queueType==='ranked'?this.input.sharedSubject:prefs?.subject ?? this.input.sharedSubject;
      const knowledgeNode=prefs?.learningStartSelections[subject] ?? human.profile.learningStartSelections[subject];
      const [cards,recentPerformance]=await Promise.all([getPrivateFsrsCards(this.runtime.db,userId),
        this.recentStudyPerformance(userId,subject)]);
      const startEvidence={now,cards,recentPerformance,progress:knowledgeNode?[{subject,knowledgeNode}]:[]};
      const blueprint=buildMatchStudyBlueprint({packs:this.packs,mode:this.game.mode,subject,seed,...startEvidence});
      this.studies.set(userId,{blueprint,startEvidence,arcIndex:-1,usedQuestionIds:new Set(),attempts:[]});
    }));
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
  private async recentStudyPerformance(userId:string,subject:SubjectId):Promise<RecentLearningPerformance[]> {
    const recent=await this.runtime.db.selectFrom('learning_attempts').select(['family_id','is_correct','answer_json'])
      .where('user_id','=',userId).where('subject','=',subject).where('is_offline_unverified','=',false)
      .orderBy('created_at','desc').orderBy('id','desc').limit(100).execute();
    const groups=new Map<string,{attempts:number;independent:number;correct:number;hinted:number}>();
    for(const row of recent) {
      const payload=row.answer_json;
      if(!payload || typeof payload!=='object' || Array.isArray(payload))continue;
      const submission=payload.submission;
      const wrapped=submission && typeof submission==='object' && !Array.isArray(submission)
        && ('answer' in submission || 'status' in submission || 'questionId' in submission);
      const answer=wrapped?submission.answer:submission;
      if(answer==null || (typeof answer==='string' && !answer.trim()) ||
        (wrapped && (submission.status==='skipped' || submission.status==='timed_out')))continue;
      const group=groups.get(row.family_id) ?? {attempts:0,independent:0,correct:0,hinted:0};
      group.attempts++;
      if(wrapped && submission.hintUsed===true)group.hinted++;
      else if(payload.stepRole==='resource_check' || payload.stepRole==='verification') {
        group.independent++;
        if(row.is_correct)group.correct++;
      }
      groups.set(row.family_id,group);
    }
    return [...groups].map(([familyId,group])=>({familyId,
      independentAccuracy:group.independent?group.correct/group.independent:0.5,hintRate:group.hinted/group.attempts}));
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
  private choiceKind() {
    return getMatchChoiceKind(this.phase,MODE_BUDGETS.modes[this.game.mode].timeline[this.phaseIndex]?.label ?? '');
  }
  private allowedChoice(command:GameCommand):boolean {
    const kind=this.choiceKind();
    return kind==='augment' ? ['PICK_AUGMENT','REROLL_AUGMENT_SLOT'].includes(command.type)
      : kind==='anvil' && command.type==='PICK_ANVIL_OPTION';
  }
  private canActInStrategy(seat:SeatState):boolean {
    if (this.game.phase!=='prep') return false;
    if (['entry','resource','rest','strategy'].includes(this.phase)) return true;
    if (this.phase==='choice') {
      return this.choiceKind()==='augment' ? !seat.augmentOffer : seat.anvils.length===0;
    }
    if (this.phase==='learning') {
      if (seat.isBot) return this.botLearningPlans.get(seat.id)?.botLearningDone ?? false;
      const human=[...this.humans].find(([,h])=>h.seatId===seat.id);
      return Boolean(human && this.lessons.get(human[0])?.complete);
    }
    return false;
  }
  private applyCommand(seatId:string,command:GameCommand):{ok:boolean;reason?:string} {
    if(this.failure||this.disposed||this.completed)return {ok:false,reason:'MATCH_NOT_ACTIVE'};
    const seat=this.game.seats.find(s=>s.id===seatId)!;
    if (command.type==='SET_LINEUP_PLAN') {seat.lineupPlan=[...command.unitIds]; return {ok:true};}
    if (CHOICE_COMMANDS.has(command.type)) {
      if (!this.allowedChoice(command)) return {ok:false,reason:'CHOICE_WINDOW_REQUIRED'};
    } else if (!this.canActInStrategy(seat)) return {ok:false,reason:'STRATEGY_PHASE_REQUIRED'};
    return applyGameCommand(this.game,seatId,command);
  }
  private normalizeStep(progress:LearningProgress):void {
    while(progress.step<progress.bundle.steps.length) {
      const step=progress.bundle.steps[progress.step]!;
      if (!step.active || (step.kind!=='material' && step.kind!=='remediation' && step.questionIds.length===0)) {progress.step++;continue;}
      break;
    }
    progress.complete=progress.step>=progress.bundle.steps.length;
  }
  private grantLearningSettlement(
    seat: SeatState, gradedUnits: readonly GradedLearningUnit[], studyBlueprint?: MatchStudyBlueprint,
  ): LearningGoldSettlement {
    const gold = settleLearningNodeGold({
      mode: this.game.mode,
      blockIndex: this.nodeIndex,
      gradedUnits,
      studyBlueprint,
      carryInCents: seat.learningChargeCents,
    });
    const bonus = evaluateLearningBonusDrops(gold.exactScore, roomSlotBonusStage(this.game.mode, this.nodeIndex));
    const settlement = {
      ...gold,
      ...applyLearningBonusGrant(this.game, seat, this.nodeIndex, bonus),
      performanceTier: bonus.performanceTier,
    };
    applyLearningGoldGrant(seat, settlement.grantedIntegerGold, settlement.carryOutCents);
    seat.learningGoldOrbs = [...settlement.orbSplits];
    return settlement;
  }

  private settleBotLearning(seat: SeatState): boolean {
    const plan = this.botLearningPlans.get(seat.id);
    if (!plan || plan.botLearningDone) return false;
    this.grantLearningSettlement(seat, plan.gradedUnits);
    plan.botLearningDone = true;
    return true;
  }

  private clearBotLearningTimers(): void {
    for (const timer of this.botLearningTimers.values()) clearTimeout(timer);
    this.botLearningTimers.clear();
  }

  private settleUserLearning(userId:string):void {
    const progress=this.lessons.get(userId);
    if(!progress || progress.settled)return;
    const seat=this.game.seats.find(s=>s.id===this.humans.get(userId)!.seatId)!;
    const settlement = this.grantLearningSettlement(
      seat, gradeFrozenLearningUnits(progress.bundle.questions, progress.submissions), progress.bundle.blueprint,
    );
    progress.settled = true;
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
  private onUserLearningCompleted(userId:string,progress:LearningProgress):void {
    const alreadyReady = progress.readyToProceed;
    progress.readyToProceed = true;
    this.settleUserLearning(userId);
    this.maybeFinishLearningEarly();
    if (!alreadyReady) this.broadcastSnapshots(userId);
  }
  private startBotLearning(phaseStartedAtMs: number): void {
    const phaseIndex = this.phaseIndex;
    const durationMs = this.deadlineEpochMs - phaseStartedAtMs;
    this.botLearningPlans.clear();
    for (const [seatIndex, seat] of this.game.seats.entries()) {
      if (!seat.isBot) continue;
      const plan = createBotLearningPlan(this.gameSeed, this.nodeIndex, seatIndex, seat.botDifficulty);
      this.botLearningPlans.set(seat.id, plan);
      const completesAtMs = phaseStartedAtMs + durationMs * plan.completionPercent / 100;
      const timer = setTimeout(() => {
        void this.enqueue(() => this.completeBotLearning(phaseIndex, seat)).catch(error => this.fail(error));
      }, Math.max(1, Math.ceil(completesAtMs - Date.now())));
      this.botLearningTimers.set(seat.id, timer);
    }
  }

  private completeBotLearning(phaseIndex: number, seat: SeatState): void {
    if (this.disposed || this.failure || this.completed || this.phaseIndex !== phaseIndex || Date.now() >= this.deadlineEpochMs) return;
    this.botLearningTimers.delete(seat.id);
    if (!this.settleBotLearning(seat)) return;
    if (this.canActInStrategy(seat) && Date.now() < this.deadlineEpochMs) {
      for (const command of decideBotPrepCommands(this.game, seat.id, seat.botDifficulty)) {
        if (Date.now() >= this.deadlineEpochMs) break;
        this.applyCommand(seat.id, command);
      }
    }
    this.maybeFinishLearningEarly();
    this.broadcastSnapshots();
  }

  private maybeFinishLearningEarly(): void {
    if (this.disposed || this.failure || this.completed || this.phase !== 'learning') return;
    const allHumansDone = [...this.humans.keys()].every(uid => this.lessons.get(uid)?.complete);
    const allBotsDone = this.game.seats.every(seat => !seat.isBot || this.botLearningPlans.get(seat.id)?.botLearningDone);
    if (!allHumansDone || !allBotsDone) return;
    this.deadlineEpochMs = Date.now();
    this.schedulePhaseTransition(0);
  }

  private learningCommand(userId:string,message:z.infer<typeof LearningMessage>):unknown {
    if(this.failure||this.disposed||this.completed)throw new ServiceError('MATCH_NOT_ACTIVE');
    if (this.phase!=='learning' || Date.now()>=this.deadlineEpochMs) throw new ServiceError('LEARNING_WINDOW_CLOSED');
    const progress=this.lessons.get(userId); if (!progress) throw new ServiceError('LESSON_NOT_FOUND');
    this.normalizeStep(progress);
    if (progress.complete) {
      if (message.action==='advance') {
        this.onUserLearningCompleted(userId,progress);
        return {ok:true,complete:true,readyToProceed:true};
      }
      throw new ServiceError('LEARNING_ALREADY_COMPLETE');
    }
    const step=progress.bundle.steps[progress.step]!; const {kind}=step;
    if (message.action==='advance') {
      if (kind!=='material' && kind!=='remediation') throw new ServiceError('STEP_REQUIRES_SUBMISSIONS');
      progress.step++; this.normalizeStep(progress);
      if (progress.complete) this.onUserLearningCompleted(userId,progress);
      return {ok:true,complete:progress.complete,readyToProceed:progress.readyToProceed};
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
    if (!grade.isSkipped) this.studies.get(userId)!.attempts.push({questionId:question.questionId,
      familyId:question.familyId,isCorrect:grade.isCorrect,slotInArc:progress.bundle.arcMeta.slotInArc});
    const feedback={...grade,explanationMd:question.explanationMd,correctAnswerDisplay:formatCorrectAnswerDisplay(question)}; progress.feedback[question.questionId]=feedback;
    if (!grade.isCorrect) this.wrong.get(userId)!.add(question.questionId);
    if (step.questionIds.every(id=>Object.hasOwn(progress.submissions,id))) {
      if (kind==='resource_check') progress.bundle=activateLessonRemediation(progress.bundle,progress.submissions,true);
      progress.step++; this.normalizeStep(progress);
      if (progress.complete) this.onUserLearningCompleted(userId,progress);
    }
    return {ok:true,feedback,complete:progress.complete,readyToProceed:progress.readyToProceed};
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
  private schedulePhaseTransition(delayMs: number): void {
    if (this.timeout) clearTimeout(this.timeout);
    const phaseIndex = this.phaseIndex;
    this.timeout = setTimeout(() => {
      void this.enqueue(() => phaseIndex === this.phaseIndex ? this.transition() : undefined).catch(error => this.fail(error));
    }, delayMs);
  }

  private clearPhaseTimers(): void {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.timeout = undefined;
    this.guardTimer = undefined;
    this.clearBotLearningTimers();
  }

  private async transition():Promise<void> {
    if(this.disposed || this.failure)return;
    this.clearPhaseTimers();
    if (this.phase === 'learning') {
      for (const userId of this.lessons.keys()) this.settleUserLearning(userId);
      for (const seat of this.game.seats) if (seat.isBot) this.settleBotLearning(seat);
    }
    const timeline=MODE_BUDGETS.modes[this.game.mode].timeline;
    this.phaseIndex++;
    if(this.phaseIndex>=timeline.length) {this.broadcast('match_complete',{matchId:this.start.matchId});
      this.clock.setTimeout(()=>{void this.disconnect();},300_000);return;}
    const event=timeline[this.phaseIndex]!; this.phase=event.kind as MatchPhaseKind;
    let phaseDurationMs=event.duration*1000;
    let phaseStartedAtMs: number | undefined;
    if(this.game.phase!=='finished' && this.game.settledRounds.includes(this.game.round) &&
      ['learning','strategy','choice','rest'].includes(this.phase)) {
      const keepRoundPrep=this.phase==='rest' || (this.phase==='choice' && /战后|PVE.*补给|PVE.*选择/u.test(event.label));
      if(!keepRoundPrep)beginNextRound(this.game);
      else this.game.phase='prep';
    }
    if(this.phase==='learning') {
      this.nodeIndex++; this.lessons.clear();
      for(const [userId,study] of this.studies) {
        const {arcIndex}=locateMatchStudySlot(study.blueprint,this.nodeIndex);
        if(arcIndex!==study.arcIndex) {
          study.arcIndex=arcIndex;study.attempts.length=0;
        }
        const bundle=buildPersonalizedLessonBundle({packs:this.packs,mode:this.game.mode,nodeIndex:this.nodeIndex,
          queueType:this.input.queueType,selectedSubjects:[study.blueprint.subject],rankedSubject:this.input.sharedSubject,
          ...study.startEvidence,studyBlueprint:study.blueprint,usedQuestionIds:[...study.usedQuestionIds],priorArcAttempts:[...study.attempts]});
        for(const question of bundle.questions)study.usedQuestionIds.add(question.questionId);
        const progress:LearningProgress={bundle,submissions:{},step:0,complete:false,readyToProceed:false,feedback:{},settled:false};
        this.normalizeStep(progress);this.lessons.set(userId,progress);
      }
    } else if(this.phase==='strategy' || this.phase==='choice') {
      this.runBots();
    } else if(this.phase==='battle') {
      finalizePrepDeadline(this.game);
      const {round,battles,outcomes}=resolveRoundBattles(this.game);
      phaseDurationMs=computeRoundBattleDurationMs(battles);
      const longestBattleMs=longestBattleElapsedMs(battles);
      phaseStartedAtMs=Date.now();
      this.pendingBattle={outcomes,payload:{round,battles,overtimeAtMs:BATTLE_REGULAR_MS,
        longestBattleMs,startedAtEpochMs:phaseStartedAtMs,timeScale:this.runtime.timeScale}};
    } else if(this.phase==='settlement') {
      if(!this.pendingBattle)throw new Error('MISSING_BATTLE');
      settleRound(this.game,this.pendingBattle.outcomes);this.pendingBattle=null;
    } else if(this.phase==='exit') await this.finish();
    if(this.disposed || this.failure)return;
    const startedAtMs = phaseStartedAtMs ?? Date.now();
    this.deadlineEpochMs = startedAtMs + Math.max(1, phaseDurationMs * this.runtime.timeScale);
    this.schedulePhaseTransition(Math.max(1, Math.ceil(this.deadlineEpochMs - Date.now())));
    if (this.phase === 'learning') {
      this.startBotLearning(startedAtMs);
      for (const [userId, progress] of this.lessons) {
        if (progress.complete) this.onUserLearningCompleted(userId, progress);
      }
    }
    if(this.phase==='battle' && this.pendingBattle)this.broadcast('battle',this.pendingBattle.payload);
    this.broadcastSnapshots();this.scheduleProtectionCheck();
  }
  private async finish():Promise<void> {
    await Promise.all(this.persistence);if(this.failure)throw new Error(this.failure);
    for (const seat of this.game.seats) {
      if (seat.isBot) seat.learningChargeCents = finalizeLearningGoldCarry(seat.learningChargeCents).carryOutCents;
    }
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
    const current=progress && !progress.complete?progress.bundle.steps[progress.step]!.kind:null;
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
      battle:this.pendingBattle?.payload ?? null,
      learning:progress?{nodeIndex:this.nodeIndex,currentStep:current,complete:progress.complete,
        arcMeta:progress.bundle.arcMeta,blueprint:this.studies.get(userId)!.blueprint,
        readyToProceed:progress.readyToProceed,
        readyHumansCount:[...this.lessons.values()].filter(lesson=>lesson.complete).length +
          [...this.botLearningPlans.values()].filter(plan=>plan.botLearningDone).length,
        totalHumansCount:this.game.seats.length,
        correctCount:progress.bundle.questions.filter(q=>{const fb=progress.feedback[q.questionId] as {isCorrect?:boolean}|undefined;return Boolean(fb?.isCorrect);}).length,
        totalQuestionsCount:progress.bundle.questions.length,
        clientQuestions:progress.bundle.clientQuestions.filter(q=>q.stepRole===current),
        steps:progress.bundle.steps.map((step,index)=>({kind:step.kind,active:step.active,plannedSeconds:step.plannedSeconds,
          questionIds:step.questionIds,materials:index===progress.step?step.materials:[],
          corrections:index===progress.step?step.corrections:[]})),
        submittedQuestionIds:Object.keys(progress.submissions),feedback:progress.feedback}:null,
      resourceSettlement:this.settlements.get(userId)?.at(-1) ?? null,summary:this.summaries.get(userId) ?? null,
      completed:this.completed,failure:this.failure};
  }
  private sendSnapshot(client:Client,userId:string):void {client.send('snapshot',this.snapshot(userId));}
  private broadcastSnapshots(exceptUserId?: string):void {
    for(const client of this.clients) {const binding=this.bindings.get(client.sessionId);
      if(binding && binding.userId!==exceptUserId && this.controllers.get(binding.userId)===client.sessionId)this.sendSnapshot(client,binding.userId);}
  }
  private fail(error:unknown):void {
    if(this.failure || this.disposed)return;
    this.failure=this.errorCode(error);this.clearPhaseTimers();
    this.broadcast('match_error',{reason:this.failure,competitiveResultVoided:!this.completed});this.broadcastSnapshots();
    void this.runtime.db.updateTable('matches').set({status:'completed',completed_at:new Date()})
      .where('id','=',this.start.matchId).where('status','=','active').execute().catch(()=>undefined);
    this.clock.setTimeout(()=>{void this.disconnect();},60_000);
  }
  async onDispose():Promise<void> {
    this.disposed=true;this.clearPhaseTimers();
    await Promise.all(this.persistence);
    if(!this.completed)await this.runtime.db.updateTable('matches').set({status:'completed',completed_at:new Date()})
      .where('id','=',this.start.matchId).where('status','=','active').execute();
    this.runtime.unregister(this);
  }
}
