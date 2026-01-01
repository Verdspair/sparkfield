import { MODE_BUDGETS, SEASON1_UNITS_BY_ID, SEASON1_ITEMS, SEASON1_TRAITS, type DurationMode, type UnitCombatTelemetry } from '@pkg/contracts';
import type { SeatState, UnitInstance, RngState } from './types.js';
import { createRng, nextRandom } from './rng.js';

export type CombatSide = 0 | 1;
export type DamageType = 'physical' | 'magic' | 'true';
export interface CombatHex { row: number; col: number }
export interface CombatBuff { key: string; value: number; until: number; source: string }
export interface CombatShield { amount: number; until: number; skillLock: boolean }
export interface CombatUnit {
  id: string; instanceId: string; unitId: string; star: UnitInstance['star']; side: CombatSide;
  row: number; col: number; deployRow: number; items: string[]; factions: string[]; role: string;
  hp: number; maxHp: number; atk: number; armor: number; mr: number; atkSpeed: number; range: number;
  mana: number; maxMana: number; power: number; ap: number; crit: number; critDamage: number;
  buffs: CombatBuff[]; shields: CombatShield[]; flags: Record<string, number>;
  alive: boolean; targetId: string | null; nextAttackAt: number; castUntil: number; manaLockUntil: number;
  pendingManaRefund: number; damageManaWindow: number; damageManaGained: number;
  move: { to: CombatHex; arriveAt: number } | null; blockedTicks: number; attacks: number; lastHitTargetId: string | null; sameTargetHits: number;
  telemetry: UnitCombatTelemetry;
}
export interface CombatProjectile { id: number; sourceId: string; targetId: string; impactAt: number; amount: number; damageType: DamageType; skill: boolean; auto: boolean; aoe: boolean; vampPct: number; killRefund: number; effects: CombatBuff[]; bypass: number; crit: boolean; attackIndex: number }
export interface CombatEvent { id: number; at: number; sourceId: string; kind: 'skill' | 'pulse' | 'gamma' | 'dot' | 'wake' | 'mirror'; targetId: string | null; power: number; remaining: number; cell?: CombatHex; normalCast?: boolean; firstCast?: boolean }
export interface CombatResult { outcome: 'win' | 'draw' | 'loss'; winnerSide: CombatSide | null; winnerSeatId: string | null; elapsedMs: number; telemetry: UnitCombatTelemetry[]; survivors: { left: string[]; right: string[] } }
export interface CombatState { mode: DurationMode; rng: RngState; elapsedMs: number; hardDeadlineMs: number; overtimeAtMs: number; units: CombatUnit[]; projectiles: CombatProjectile[]; events: CombatEvent[]; nextEntityId: number; seats: [string,string]; augments: [string[],string[]]; traits: [Record<string, Record<string, unknown>>,Record<string, Record<string, unknown>>]; flags: Record<string, number>; result: CombatResult | null }
const FOREVER = Number.MAX_SAFE_INTEGER;
const n = (o: Record<string, unknown>, k: string, d=0): number => typeof o[k] === 'number' ? o[k] as number : d;
const spec = (u: CombatUnit) => SEASON1_UNITS_BY_ID.get(u.unitId)!.skillSpec;
const def = (u: CombatUnit) => SEASON1_UNITS_BY_ID.get(u.unitId)!;
const cmp = (a: {id:string}, b: {id:string}) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const cellKey = (c: CombatHex) => `${c.row},${c.col}`;
const sameCell = (a: CombatHex,b:CombatHex) => a.row===b.row && a.col===b.col;
function axial(c: CombatHex) { return {q:c.col-(c.row-(c.row&1))/2,r:c.row}; }
export function hexDistance(a: CombatHex,b:CombatHex):number { const x=axial(a),y=axial(b); return (Math.abs(x.q-y.q)+Math.abs(x.r-y.r)+Math.abs(x.q+x.r-y.q-y.r))/2; }
export function hexNeighbors(c:CombatHex):CombatHex[] { const a=axial(c); return [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]].map(([dq,dr])=>{const r=a.r+dr!;return {row:r,col:a.q+dq!+(r-(r&1))/2};}).filter(x=>x.row>=0&&x.row<8&&x.col>=0&&x.col<7).sort((a,b)=>a.row-b.row||a.col-b.col); }
const live = (s:CombatState,side?:CombatSide) => s.units.filter(u=>u.alive&&(side===undefined||u.side===side));
const enemies = (s:CombatState,u:CombatUnit) => live(s,(1-u.side) as CombatSide);
const allies = (s:CombatState,u:CombatUnit) => live(s,u.side);
const get = (s:CombatState,id:string|null) => s.units.find(u=>u.id===id);
const near = <T extends CombatHex & { id: string }>(origin:CombatHex,list:T[]):T[] => [...list].sort((a,b)=>hexDistance(origin,a)-hexDistance(origin,b)||cmp(a,b));
const low = (list:CombatUnit[]) => [...list].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||cmp(a,b));
const active = (s:CombatState,u:CombatUnit,key:string) => u.buffs.filter(b=>b.key===key&&b.until>s.elapsedMs);
const val = (s:CombatState,u:CombatUnit,key:string) => active(s,u,key).reduce((x,b)=>Math.max(x,b.value),0);
const sum = (s:CombatState,u:CombatUnit,key:string) => active(s,u,key).reduce((x,b)=>x+b.value,0);
const effect = (u:CombatUnit,key:string):number => { let total=0;for(const id of u.items){const it=SEASON1_ITEMS.completedItems.find(i=>i.id===id);if(it) total+=n(it.effects,key);}return total; };
const has = (u:CombatUnit,id:string) => u.items.includes(id);
const trait = (s:CombatState,u:CombatUnit,name:string) => s.traits[u.side][name] ?? {};
const member = (u:CombatUnit,name:string) => u.factions.includes(name)||u.role===name;
const ownTrait = (s:CombatState,u:CombatUnit,name:string) => member(u,name) ? trait(s,u,name) : {};
const aug = (s:CombatState,side:CombatSide,id:string) => s.augments[side].includes(id);
function buff(s:CombatState,u:CombatUnit,key:string,value:number,ms:number,source='system') { const old=u.buffs.find(b=>b.key===key&&b.source===source);if(old){old.value=value;old.until=s.elapsedMs+ms;}else u.buffs.push({key,value,until:s.elapsedMs+ms,source}); }
function cleanse(u:CombatUnit){u.buffs=u.buffs.filter(b=>!['stun','asSlow','armorShred','mrShred','antiHeal','shieldReduce','vuln','burn','taunt','manaTax'].includes(b.key));}
export function isManaLocked(s:CombatState,u:CombatUnit):boolean{return s.elapsedMs<u.manaLockUntil||u.shields.some(x=>x.skillLock&&x.amount>0&&x.until>s.elapsedMs);}
export function gainMana(s:CombatState,u:CombatUnit,amount:number):number{if(!u.alive||isManaLocked(s,u))return 0;const old=u.mana;u.mana=Math.min(u.maxMana*(1+val(s,u,'manaTax')/100),u.mana+Math.max(0,amount));return u.mana-old;}
function healShieldScale(s:CombatState,source:CombatUnit,target:CombatUnit,shield:boolean){
  const efficiency=1+n(ownTrait(s,source,'维生'),'healShieldPct')/100+(shield?n(ownTrait(s,source,'矩阵'),'apAndShieldPct')/100:0);
  return efficiency*(s.elapsedMs>=s.overtimeAtMs?0.5:1)*(shield?1:1-val(s,target,'antiHeal')/100)*(shield?1-val(s,target,'shieldReduce')/100:1)*(s.flags[`horizon:${1-target.side}`]?0.75:1);
}
export function healCombatUnit(s:CombatState,source:CombatUnit,target:CombatUnit,amount:number):number{if(!target.alive)return 0;const actual=Math.max(0,Math.min(target.maxHp-target.hp,amount*healShieldScale(s,source,target,false)));target.hp+=actual;source.telemetry.healingAndShielding+=actual;return actual;}
export function shieldCombatUnit(s:CombatState,source:CombatUnit,target:CombatUnit,amount:number,durationMs:number,skillLock=false):number{if(!target.alive)return 0;const actual=Math.max(0,amount*healShieldScale(s,source,target,true));target.shields.push({amount:actual,until:s.elapsedMs+durationMs,skillLock});source.telemetry.healingAndShielding+=actual;return actual;}
function cc(s:CombatState,source:CombatUnit,target:CombatUnit,seconds:number,key='stun') {if(val(s,target,'ccImmune'))return;if(has(target,'I_PHASE_TALISMAN')&&!target.flags.ccBlocked){target.flags.ccBlocked=1;gainMana(s,target,15);return;}buff(s,target,key,seconds,seconds*1000,source.id);}
function addEvent(s:CombatState,e:Omit<CombatEvent,'id'>){s.events.push({...e,id:s.nextEntityId++});}
function shoot(s:CombatState,u:CombatUnit,t:CombatUnit,amount:number,type:DamageType,options:Partial<Pick<CombatProjectile,'skill'|'auto'|'aoe'|'vampPct'|'killRefund'|'effects'|'impactAt'>>={}){
  const skill=options.skill??true,auto=options.auto??false;
  const canCrit=auto||(skill&&(n(ownTrait(s,u,'跃迁'),'omnivampPct')>0||effect(u,type==='magic'?'magicSkillCanCrit':'physicalSkillCanCrit')>0||has(u,type==='magic'?'I_NON_EUCLID_LENS':'I_STRONG_CRIT_EDGE')));
  const crit=canCrit&&((auto&&u.attacks<=effect(u,'guaranteedFirstCrits'))||nextRandom(s.rng)<u.crit);
  let bypass=0;if((u.flags.calibrated??0)>0){u.flags.calibrated!--;bypass=35;}
  s.projectiles.push({id:s.nextEntityId++,sourceId:u.id,targetId:t.id,impactAt:options.impactAt??s.elapsedMs+Math.max(50,hexDistance(u,t)*75),amount:amount*(crit?u.critDamage:1),damageType:type,skill,auto,aoe:options.aoe??false,vampPct:options.vampPct??0,killRefund:options.killRefund??0,effects:options.effects??[],bypass,crit,attackIndex:auto?u.attacks:0});
}
function burn(s:CombatState,u:CombatUnit,t:CombatUnit,pct:number,seconds:number){buff(s,t,'burn',pct,seconds*1000,u.id);buff(s,t,'antiHeal',33,seconds*1000,u.id);}
function lowHpEffects(s:CombatState,u:CombatUnit){
  const ratio=u.hp/u.maxHp;
  if(ratio<0.4&&!u.flags.keel&&has(u,'I_KEEL_FIELD')){u.flags.keel=1;u.atk+=15;shieldCombatUnit(s,u,u,u.maxHp*0.22,5000);}
  if(ratio<0.4&&!u.flags.axe&&has(u,'I_LIFE_AXE')){u.flags.axe=1;shieldCombatUnit(s,u,u,u.maxHp*0.12,3000);}
  if(ratio<0.5&&!u.flags.inertia&&has(u,'I_INERTIA_GAUNTLET')){u.flags.inertia=1;buff(s,u,'dr',15,4000);}
  if(ratio<0.35&&!u.flags.deadhand&&has(u,'I_DEADHAND_BELT')){u.flags.deadhand=1;cleanse(u);buff(s,u,'ccImmune',1,3000);shieldCombatUnit(s,u,u,u.maxHp*0.22,3000);}
  if(ratio<0.4&&aug(s,u.side,'AUG_S08')&&!s.flags[`medical:${u.side}`]){s.flags[`medical:${u.side}`]=1;healCombatUnit(s,u,u,u.maxHp*0.2);}
  const cloud=ownTrait(s,u,'云端星环');if(ratio<0.35&&n(cloud,'pulseDmg')&&!s.flags[`cloud:${u.side}`]){s.flags[`cloud:${u.side}`]=1;addEvent(s,{at:s.elapsedMs+1000,sourceId:u.id,kind:'pulse',targetId:null,power:n(cloud,'pulseDmg'),remaining:1});}
}
function damage(s:CombatState,p:CombatProjectile){const u=get(s,p.sourceId),t=get(s,p.targetId);if(!u||!t||!t.alive||t.hp<=0)return;
  let raw=p.amount;const adj=enemies(s,u).filter(x=>x.id!==t.id&&hexDistance(t,x)===1).length;
  const dil=ownTrait(s,u,'钟慢远征');const isolation=adj===0?1:adj===1&&aug(s,u.side,'AUG_G05')?0.5:0;
  raw*=1+(sum(s,u,'amp')+n(ownTrait(s,u,'失控蜂群'),'ampPct')+n(dil,'isoAmpPct')*isolation+(t.hp<t.maxHp/2?n(ownTrait(s,u,'跃迁'),'lowHpAmpPct'):0)+(t.maxHp>u.maxHp?effect(u,'giantSlayerBonusPct'):0))/100;
  raw*=1+val(s,t,'vuln')/100;
  if(s.elapsedMs<6000&&live(s,t.side).some(x=>x.unitId==='S33'))raw*=0.9;
  const targeting=enemies(s,t).filter(x=>x.targetId===t.id).length;
  const extraResist=sum(s,t,'resist')+(t.shields.some(x=>x.amount>0)?effect(t,'shieldedArmorMr'):0)+Math.min(4,targeting)*effect(t,'perTargetingEnemyArmorMr');
  const immune=n(ownTrait(s,t,'失控蜂群'),'count')>=2;
  const resistance=(p.damageType==='physical'?t.armor:t.mr)+extraResist;
  const shred=immune?0:val(s,t,p.damageType==='physical'?'armorShred':'mrShred');
  const pen=n(ownTrait(s,u,'反物质院'),'penPct');
  const resist=Math.max(-99,resistance*(1-shred/100)*(1-pen/100)*(1-p.bypass/100));
  let amount=raw*(p.damageType==='true'?1:100/(100+resist));
  if(p.damageType!=='true'){
    amount*=1-val(s,t,'dr')/100;
    if(p.auto)amount*=1-Math.max(val(s,t,'autoDr'),effect(t,'autoAndCritMitigationPct'))/100;
    if(p.skill&&p.damageType==='magic')amount*=1-effect(t,'magicDamageReducePct')/100;
    const eu=trait(s,t,'木卫冰海');if(p.aoe||p.crit){const share=t.deployRow>=2?1:aug(s,t.side,'AUG_G06')?0.5:0;amount*=1-n(eu,'backDrPct')*share/100;}
  }
  const preShield=amount;let bypassDamage=amount*p.bypass/100;amount-=bypassDamage;
  for(const sh of t.shields){const blocked=Math.min(sh.amount,amount);sh.amount-=blocked;amount-=blocked;}
  amount+=bypassDamage;
  if(t.unitId==='S33'&&amount>=t.hp&&!t.flags.penrose){t.flags.penrose=1;buff(s,t,'immortal',1,1000);addEvent(s,{at:s.elapsedMs+1000,sourceId:t.id,kind:'skill',targetId:u.id,power:t.power*(1+t.ap/100),remaining:1});}
  if(val(s,t,'immortal'))amount=Math.min(amount,Math.max(0,t.hp-1));
  const healthDamage=Math.min(t.hp,Math.max(0,amount));t.hp=Math.max(0,t.hp-healthDamage);
  const actual=healthDamage+preShield-amount;
  u.telemetry[p.damageType==='physical'?'physicalDealt':p.damageType==='magic'?'magicDealt':'trueDealt']+=Math.max(0,actual);t.telemetry.damageTaken+=Math.max(0,actual);
  if(t.damageManaWindow!==Math.floor(s.elapsedMs/1000)){t.damageManaWindow=Math.floor(s.elapsedMs/1000);t.damageManaGained=0;}
  const mana=Math.min(20,Math.floor(raw*0.01+preShield*0.03),30-t.damageManaGained);t.damageManaGained+=gainMana(s,t,mana);
  for(const b of p.effects){if(b.key==='stun')cc(s,u,t,b.value);else buff(s,t,b.key,b.value,b.until,u.id);}
  if(p.auto||p.damageType==='physical'){if(effect(u,'armorShredPct'))buff(s,t,'armorShred',30,4000,u.id);}
  if(p.auto){
    if(effect(u,'mrShredPct'))buff(s,t,'mrShred',30,4000,u.id);
    if(effect(u,'slowTargetAsPct'))buff(s,t,'asSlow',15,4000,u.id);
    if(u.lastHitTargetId!==t.id){u.lastHitTargetId=t.id;u.sameTargetHits=0;}u.sameTargetHits++;
    const rail=n(ownTrait(s,u,'磁轨'),'shrapnelDmg');if(u.sameTargetHits%3===0&&rail)shoot(s,u,t,rail,'physical',{skill:false});
    gainMana(s,u,10+effect(u,'onHitBonusMana'));
    if(p.attackIndex%3===0){gainMana(s,u,effect(u,'every3rdHitMana'));healCombatUnit(s,u,u,u.maxHp*effect(u,'every3rdHitHealMaxHpPct')/100);if(effect(u,'every3rdHitMagicDmg'))shoot(s,u,t,effect(u,'every3rdHitMagicDmg'),'magic',{skill:false});}
    if(effect(u,'onHitAsStackPct')){u.flags.railStacks=Math.min(effect(u,'maxStacks'),(u.flags.railStacks??0)+1);buff(s,u,'as',u.flags.railStacks*effect(u,'onHitAsStackPct'),FOREVER,'rail');}
    if(hexDistance(u,t)<=1&&effect(t,'thornsMagicDmg')&&(t.flags.thornsAt??0)<=s.elapsedMs){t.flags.thornsAt=s.elapsedMs+1500;for(const enemy of enemies(s,t).filter(x=>hexDistance(x,t)<=1))shoot(s,t,enemy,85,'magic',{skill:false,aoe:true});}
  }
  if(p.skill){if(effect(u,'skillMrShredPct'))buff(s,t,'mrShred',30,5000,u.id);if(effect(u,'burnMaxHpPctPerSec'))burn(s,u,t,1,4);}
  const vamp=p.vampPct+n(ownTrait(s,u,'跃迁'),'omnivampPct')+(p.skill?effect(u,'skillOmnivampPct')+(u.hp<u.maxHp/2?effect(u,'lowHpOmnivampPct'):0):0)+(p.damageType==='physical'?effect(u,'physicalOmnivampPct'):0);
  if(u.alive&&u.hp>0&&vamp)healCombatUnit(s,u,u,Math.max(0,actual)*vamp/100);
  if(healthDamage>0&&t.hp<=0){if(p.killRefund)u.pendingManaRefund+=p.killRefund;if(effect(u,'takedownDamageAmpPct')&&!u.flags.spring){u.flags.spring=1;buff(s,u,'amp',12,FOREVER,'spring');}}
  if(t.hp>0)lowHpEffects(s,t);
}

function nearestCluster(s:CombatState,u:CombatUnit){return [...enemies(s,u)].sort((a,b)=>enemies(s,u).filter(x=>hexDistance(b,x)<=1).length-enemies(s,u).filter(x=>hexDistance(a,x)<=1).length||cmp(a,b))[0];}
function flank(s:CombatState,u:CombatUnit,t:CombatUnit){const free=hexNeighbors(t).filter(c=>!live(s).some(x=>x.id!==u.id&&sameCell(x,c))&&!live(s).some(x=>x.id!==u.id&&x.move&&sameCell(x.move.to,c)));const cell=near(u,free.map((x,i)=>({...x,id:String(i)})))[0];if(cell){u.row=cell.row;u.col=cell.col;u.move=null;}}
function executeSkill(s:CombatState,u:CombatUnit,targetId:string|null,P:number){
  const sp=spec(u),kind=String(sp.kind),duration=n(sp,'durationSec',4)*1000;
  const t=get(s,targetId)??near(u,enemies(s,u))[0];
  const friends=allies(s,u),foes=enemies(s,u),lowest=low(friends);
  const area=(center:CombatHex|undefined,radius=1)=>center?near(center,foes.filter(x=>hexDistance(center,x)<=radius)):[];
  const shot=(x:CombatUnit,ratio:number,type:DamageType='magic',opts:Partial<CombatProjectile>={})=>shoot(s,u,x,P*ratio,type,{skill:true,...opts});
  const sh=(x:CombatUnit,ratio:number,ms=duration)=>shieldCombatUnit(s,u,x,P*ratio,ms,x.id===u.id);
  const eff=(key:string,value:number,ms=duration):CombatBuff=>({key,value,until:ms,source:u.id});
  switch(kind){
    case 'self_shield_dr':sh(u,n(sp,'shieldRatio'));buff(s,u,'autoDr',n(sp,'autoDrPct'),duration,u.id);break;
    case 'ally_heal_buff':for(const x of lowest.slice(0,n(sp,'allyCount'))){healCombatUnit(s,u,x,P*n(sp,'healRatio'));buff(s,x,'resist',n(sp,'bonusArmorMr'),duration,u.id);}break;
    case 'ally_heal_ap':for(const x of near(u,friends).slice(0,n(sp,'allyCount'))){healCombatUnit(s,u,x,P*n(sp,'healRatio'));x.flags.nextAp=n(sp,'nextSkillApPct');}break;
    case 'ally_heal_cleanse_as':for(const x of lowest.slice(0,n(sp,'allyCount'))){healCombatUnit(s,u,x,P*n(sp,'healRatio'));x.buffs=x.buffs.filter(b=>b.key!=='asSlow');}break;
    case 'flank_strike':if(t){flank(s,u,t);shot(t,n(sp,'powerRatio'),'physical',{effects:[eff('shieldReduce',n(sp,'shieldReducePct'))]});}break;
    case 'flank_shield_break':if(t){flank(s,u,t);let destroy=P*n(sp,'bonusShieldDestroyRatio');for(const x of t.shields){const a=Math.min(x.amount,destroy);x.amount-=a;destroy-=a;}shot(t,n(sp,'powerRatio'),'physical');}break;
    case 'flank_lifesteal':if(t){flank(s,u,t);shot(t,n(sp,'powerRatio'),'physical',{vampPct:n(sp,'vampPct')});}break;
    case 'chain_magic':{const ratios=Array.isArray(sp.ratios)?sp.ratios.filter((x):x is number=>typeof x==='number'):[];let current=t;const seen=new Set<string>();for(const ratio of ratios){if(!current)break;shot(current,ratio);seen.add(current.id);current=near(current,foes.filter(x=>!seen.has(x.id)))[0];}break;}
    case 'aoe_magic_slow':case 'cluster_magic_slow':{const center=kind==='cluster_magic_slow'?nearestCluster(s,u):t;for(const x of area(center).slice(0,n(sp,'maxTargets',56)))shot(x,n(sp,'powerRatio'),'magic',{aoe:true,effects:[eff('asSlow',n(sp,'asSlowPct'))]});break;}
    case 'cleave_antiheal':for(const x of near(u,foes).slice(0,n(sp,'targetCount')))shot(x,n(sp,'powerRatio'),'physical',{aoe:true,effects:[eff('antiHeal',n(sp,'antiHealPct'))]});break;
    case 'line_pierce':if(t){const a=axial(u),b=axial(t),dx=b.q-a.q,dy=b.r-a.r;const length=Math.hypot(dx,dy)||1;const targets=foes.filter(x=>{const c=axial(x),px=c.q-a.q,py=c.r-a.r;return px*dx+py*dy>0&&Math.abs(px*dy-py*dx)/length<=0.6;});for(const x of near(u,targets).slice(0,n(sp,'maxTargets')))shot(x,n(sp,'powerRatio'),'physical',{aoe:true});}break;
    case 'single_strike_shield':if(t)shot(t,n(sp,'powerRatio'),'physical');sh(u,n(sp,'shieldRatio'));break;
    case 'dual_shield':{sh(u,n(sp,'shieldRatio'));for(const x of low(friends.filter(x=>x.id!==u.id&&hexDistance(u,x)<=1)).slice(0,n(sp,'allyCount')-1))sh(x,n(sp,'shieldRatio'));break;}
    case 'ally_shield_as':{const x=low(friends.filter(x=>x.deployRow<2))[0]??lowest[0];if(x){sh(x,n(sp,'shieldRatio'));buff(s,x,'as',n(sp,'bonusAsPct'),duration,u.id);}break;}
    case 'self_heal_row_resist':healCombatUnit(s,u,u,P*n(sp,'healRatio'));for(const x of friends.filter(x=>x.id===u.id||(hexDistance(u,x)<=1&&(u.side===0?x.row>u.row:x.row<u.row))))buff(s,x,'resist',n(sp,'bonusArmorMr'),duration,u.id);break;
    case 'aoe_magic_mr_shred':for(const x of area(t))shot(x,n(sp,'powerRatio'),'magic',{aoe:true,effects:[eff('mrShred',n(sp,'mrShredPct'))]});break;
    case 'splash_isolated_magic':{const targets=area(t).slice(0,n(sp,'maxTargets'));for(const x of targets)shot(x,n(sp,'powerRatio')*(targets.length===1?1+n(sp,'singleTargetBonusPct')/100:1),'magic',{aoe:true});break;}
    case 'mark_vuln_ally_mana':{if(t)buff(s,t,'vuln',n(sp,'vulnPct'),duration,u.id);const x=near(u,friends.filter(x=>x.id!==u.id))[0]??u;gainMana(s,x,n(sp,'allyMana'));sh(x,n(sp,'shieldRatio'));break;}
    case 'pierce_splash_phys':if(t){shot(t,n(sp,'powerRatio'),'physical');for(const x of area(t).filter(x=>x.id!==t.id))shot(x,n(sp,'splashRatio'),'physical',{aoe:true});}break;
    case 'drone_salvo':if(t)shot(t,n(sp,'powerRatio')*(foes.some(x=>x.id!==t.id&&hexDistance(t,x)<=1)?1:1+n(sp,'isolatedBonusPct')/100),'physical');break;
    case 'multi_volley_as':if(t)for(let i=0;i<n(sp,'waves');i++){shot(t,n(sp,'waveRatio'),'physical',{impactAt:s.elapsedMs+100+i*200});u.flags.volleyStacks=Math.min(n(sp,'maxStacks'),(u.flags.volleyStacks??0)+1);buff(s,u,'as',u.flags.volleyStacks*n(sp,'asStackPct'),FOREVER,'volley');}break;
    case 'shield_front_wave':sh(u,n(sp,'shieldRatio'));for(const x of foes.filter(x=>hexDistance(u,x)<=2&&(u.side===0?x.row<=u.row:x.row>=u.row)))shot(x,n(sp,'powerRatio'),'magic',{aoe:true});break;
    case 'dash_dual_torpedo':if(t){const safe=hexNeighbors(u).filter(c=>!live(s).some(x=>sameCell(x,c))&&!live(s).some(x=>x.move&&sameCell(x.move.to,c))).sort((a,b)=>hexDistance(b,t)-hexDistance(a,t)||a.row-b.row||a.col-b.col)[0];if(safe){u.row=safe.row;u.col=safe.col;u.move=null;}for(let i=0;i<n(sp,'torpedoCount');i++){shot(t,n(sp,'physRatio'),'physical',{impactAt:s.elapsedMs+100+i*180});for(const x of area(t))shot(x,n(sp,'magicSplashRatio'),'magic',{aoe:true,impactAt:s.elapsedMs+100+i*180});}}break;
    case 'mega_shield_taunt_arc':sh(u,n(sp,'shieldRatio'));for(const x of area(u)){cc(s,u,x,n(sp,'tauntSec'),'taunt');x.targetId=u.id;shot(x,n(sp,'powerRatio'),'magic',{aoe:true});}break;
    case 'aoe_stun_sunder':for(const x of near(u,foes).slice(0,n(sp,'maxTargets')))shot(x,n(sp,'powerRatio'),'magic',{aoe:true,effects:[eff('stun',n(sp,'stunSec')),eff('armorShred',n(sp,'dualShredPct')),eff('mrShred',n(sp,'dualShredPct'))]});break;
    case 'cone_barrage_reset':if(t){const primary=t;for(let i=0;i<n(sp,'waves');i++){for(const x of area(t).filter(x=>hexDistance(u,x)>=Math.max(1,hexDistance(u,primary)-1)))shot(x,n(sp,'powerRatio')/n(sp,'waves')*(x.id===primary.id?1:0.5),'physical',{aoe:true,killRefund:n(sp,'killManaRefund'),impactAt:s.elapsedMs+100+i*150});}}break;
    case 'dual_focus_blast':{const ordered=near(u,foes),centers=[ordered[0],ordered[ordered.length-1]].filter((x):x is CombatUnit=>!!x);const unique=centers.filter((x,i)=>centers.findIndex(y=>y.id===x.id)===i);for(const center of unique.slice(0,n(sp,'focusCount')))for(const x of area(center))shot(x,n(sp,'powerRatio'),'magic',{aoe:true});break;}
    case 'sanctuary_pure_support':for(const x of lowest.slice(0,n(sp,'healTargets')))healCombatUnit(s,u,x,P*n(sp,'healRatio'));for(const x of friends){sh(x,n(sp,'teamShieldRatio'));buff(s,x,'as',n(sp,'teamAsPct'),duration,u.id);}break;
    case 'chain_dash_slash':for(const x of near(u,foes).slice(0,n(sp,'maxTargets'))){flank(s,u,x);shot(x,n(sp,'powerRatio'),'physical');sh(u,n(sp,'shieldRatio'));}break;
    case 'penrose_global_jet':for(const x of foes)shot(x,n(sp,'powerRatio'),'magic',{aoe:true,effects:[eff('vuln',n(sp,'vulnPct'))]});break;
    case 'lightcone_dual_stance':{let target=t;if(u.deployRow>=2)target=[...foes].sort((a,b)=>(b.telemetry.physicalDealt+b.telemetry.magicDealt+b.telemetry.trueDealt)-(a.telemetry.physicalDealt+a.telemetry.magicDealt+a.telemetry.trueDealt)||cmp(a,b))[0];if(target){if(u.deployRow<2)flank(s,u,target);shot(target,n(sp,u.deployRow<2?'frontPhysRatio':'backPhysRatio'),'physical',{vampPct:u.deployRow<2?n(sp,'frontVampPct'):0});}break;}
    case 'frontline_shield_barrage':for(const x of friends.filter(x=>x.deployRow<2))sh(x,n(sp,'frontShieldRatio'));for(const x of area(t))shot(x,n(sp,'powerRatio'),'physical',{aoe:true});break;
    case 'event_horizon_collapse':if(t){for(const x of area(t))shot(x,n(sp,'powerRatio'),'magic',{aoe:true,effects:[eff('antiHeal',n(sp,'antiHealPct'))]});addEvent(s,{at:s.elapsedMs+1000,sourceId:u.id,kind:'dot',targetId:null,power:n(sp,'maxHpDotPctPerSec'),remaining:n(sp,'durationSec'),cell:{row:t.row,col:t.col}});}break;
    default:throw new Error(`Unsupported skill ${u.unitId}: ${kind}`);
  }
}
function beginCast(s:CombatState,u:CombatUnit){
  u.mana=0;u.move=null;const first=!u.flags.casts;u.flags.casts=(u.flags.casts??0)+1;
  const sp=spec(u),delay=String(sp.kind)==='penrose_global_jet'?n(sp,'delaySec')*1000:250;
  u.castUntil=s.elapsedMs+delay;u.manaLockUntil=u.castUntil+1000;
  u.pendingManaRefund+=effect(u,'postCastManaRefund')+n(ownTrait(s,u,'光子'),'postLockMana');
  const P=u.power*(1+(u.ap+(u.flags.nextAp??0))/100);u.flags.nextAp=0;
  addEvent(s,{at:u.castUntil,sourceId:u.id,kind:'skill',targetId:u.targetId,power:P,remaining:1,normalCast:true,firstCast:first});
  if(first&&n(ownTrait(s,u,'星门摆渡'),'wakeDps'))addEvent(s,{at:s.elapsedMs+1000,sourceId:u.id,kind:'wake',targetId:null,power:n(ownTrait(s,u,'星门摆渡'),'wakeDps'),remaining:4,cell:{row:u.row,col:u.col}});
  for(const x of enemies(s,u).filter(x=>hexDistance(u,x)<=2&&has(x,'I_IONOSPHERE_RING')))shoot(s,x,u,55,'magic',{skill:false});
}

function countTraits(units:CombatUnit[]):Record<string,Record<string,unknown>>{
  const counts:Record<string,number>={},seen=new Set<string>();
  for(const u of units){if(seen.has(u.unitId))continue;seen.add(u.unitId);for(const name of [def(u).faction,u.role])counts[name]=(counts[name]??0)+1;}
  const emblems=new Set<string>();for(const u of units)for(const id of u.items){const e=SEASON1_ITEMS.emblems.find(x=>x.id===id);if(e&&def(u).faction!==e.faction)emblems.add(e.faction);}
  for(const name of emblems)counts[name]=(counts[name]??0)+1;
  const result:Record<string,Record<string,unknown>>={};
  for(const t of [...SEASON1_TRAITS.factions,...SEASON1_TRAITS.roles]){const tier=[...t.tierParams].reverse().find(x=>x.count<=(counts[t.name]??0));if(tier)result[t.name]={...tier};}
  return result;
}
function makeUnit(source:UnitInstance,side:CombatSide):CombatUnit{
  const d=SEASON1_UNITS_BY_ID.get(source.unitId);if(!d)throw new Error(`Unknown unit ${source.unitId}`);if(source.location.zone!=='board')throw new Error('Combat requires board unit');
  const scale=d.starMultipliers[String(source.star)]??1,st=d.stats;
  const u:CombatUnit={id:`${side}:${source.instanceId}`,instanceId:source.instanceId,unitId:source.unitId,star:source.star,side,row:side===0?4+source.location.row:3-source.location.row,col:side===0?source.location.col:6-source.location.col,deployRow:source.location.row,items:[...new Set(source.items)],factions:[d.faction],role:d.role,hp:st.hp*scale+source.bonusHp,maxHp:st.hp*scale+source.bonusHp,atk:st.atk*scale,armor:st.armor,mr:st.mr,atkSpeed:st.atkSpeed,range:st.range,mana:st.initialMana,maxMana:st.maxMana,power:st.skillPowerBase*scale,ap:source.bonusSkillEfficiency,crit:0.25,critDamage:1.5,buffs:[],shields:[],flags:{},alive:true,targetId:null,nextAttackAt:0,castUntil:0,manaLockUntil:0,pendingManaRefund:0,damageManaWindow:0,damageManaGained:0,move:null,blockedTicks:0,attacks:0,lastHitTargetId:null,sameTargetHits:0,telemetry:{instanceId:source.instanceId,unitId:source.unitId,star:source.star,physicalDealt:0,magicDealt:0,trueDealt:0,damageTaken:0,healingAndShielding:0}};
  const stats:Record<string,number>={};
  for(const id of u.items){const completed=SEASON1_ITEMS.completedItems.find(x=>x.id===id),emblem=SEASON1_ITEMS.emblems.find(x=>x.id===id);if(emblem&&!u.factions.includes(emblem.faction))u.factions.push(emblem.faction);const components=completed?completed.components:emblem?emblem.components:[id];for(const cid of components){const c=SEASON1_ITEMS.components.find(x=>x.id===cid);if(c)stats[c.stat]=(stats[c.stat]??0)+c.value;}}
  u.atk=(u.atk+(stats.atk??0))*(1+effect(u,'bonusAtkPct')/100);u.atkSpeed*=1+((stats.atkSpeedPct??0)+effect(u,'bonusAtkSpeedPct'))/100;u.ap+=(stats.abilityPowerPct??0)+effect(u,'bonusApPct');u.mana+=(stats.initialMana??0)+effect(u,'bonusInitialMana');u.maxHp=(u.maxHp+(stats.hp??0)+effect(u,'bonusHp'))*(1+effect(u,'bonusMaxHpPct')/100);u.hp=u.maxHp;u.armor+=(stats.armor??0)+effect(u,'bonusArmor');u.mr+=(stats.mr??0)+effect(u,'bonusMr');u.crit+=((stats.critPct??0)+effect(u,'bonusCritPct'))/100;u.critDamage+=effect(u,'bonusCritDmgPct')/100;if(has(u,'I_BLINDSPOT_LENS'))u.critDamage+=Math.max(0,u.crit-1);u.crit=Math.min(1,u.crit);u.range=Math.min(5,u.range+effect(u,'bonusRange'));if(effect(u,'maxManaReducePct'))u.maxMana=Math.max(40,u.maxMana*0.9);if(u.unitId==='S34'&&u.deployRow>=2)u.range=99;
  return u;
}
export function createCombat(left:SeatState,right:SeatState,mode:DurationMode,seed=1):CombatState{
  const units=[...left.units.filter(u=>u.location.zone==='board'&&u.frozenUntilRound===null).map(u=>makeUnit(u,0)),...right.units.filter(u=>u.location.zone==='board'&&u.frozenUntilRound===null).map(u=>makeUnit(u,1))].sort(cmp);
  const s:CombatState={mode,rng:createRng(seed),elapsedMs:0,hardDeadlineMs:MODE_BUDGETS.modes[mode].combat*1000,overtimeAtMs:(MODE_BUDGETS.modes[mode].combat-(mode==='quick'?5:10))*1000,units,projectiles:[],events:[],nextEntityId:1,seats:[left.id,right.id],augments:[[...left.chosenAugments],[...right.chosenAugments]],traits:[countTraits(units.filter(u=>u.side===0)),countTraits(units.filter(u=>u.side===1))],flags:{},result:null};
  for(const u of units){
    const heavy=ownTrait(s,u,'重装');u.armor+=n(trait(s,u,'重装'),'teamResist');u.mr+=n(trait(s,u,'重装'),'teamResist');u.maxHp*=1+n(heavy,'hpBonusPct')/100;u.hp=u.maxHp;
    u.ap+=n(trait(s,u,'光子'),'teamApPct')+n(ownTrait(s,u,'光子'),'apPct')+n(ownTrait(s,u,'矩阵'),'apAndShieldPct');
    u.atkSpeed*=1+n(ownTrait(s,u,'磁轨'),'asPct')/100;u.mana+=n(ownTrait(s,u,'星门摆渡'),'startMana');
    if(n(heavy,'count'))buff(s,u,'dr',15,3000,'heavy');
    const cloud=ownTrait(s,u,'云端星环');if(n(cloud,'drPct'))buff(s,u,'dr',n(cloud,'drPct'),8000+(aug(s,u.side,'AUG_G03')?3000:0),'cloud');
    if(n(ownTrait(s,u,'矩阵'),'count'))shieldCombatUnit(s,u,u,u.maxHp*0.12,FOREVER);
    if(u.unitId==='S34'&&u.deployRow<2)buff(s,u,'dr',25,FOREVER,'lightcone');
    if(effect(u,'startAndFirstCastShieldPct'))shieldCombatUnit(s,u,u,u.maxHp*0.12,4000);
    if(effect(u,'damageAmpPct'))buff(s,u,'amp',effect(u,'damageAmpPct'),FOREVER,'laser');
    if(effect(u,'ccImmuneStartSec'))buff(s,u,'ccImmune',1,8000,'film');
    if(aug(s,u.side,'AUG_S04')&&u.deployRow>=2){u.range=Math.min(u.range===99?99:5,u.range+1);buff(s,u,'amp',10,FOREVER,'beacon');}
    if(aug(s,u.side,'AUG_S05')&&u.deployRow<2)shieldCombatUnit(s,u,u,u.maxHp*0.16,5000);
    if(aug(s,u.side,'AUG_S06')&&!allies(s,u).some(x=>x.id!==u.id&&hexDistance(x,u)===1)){shieldCombatUnit(s,u,u,u.maxHp*0.15,FOREVER);buff(s,u,'as',12,FOREVER,'island');}
    if(aug(s,u.side,'AUG_S07')){u.armor+=12;u.mr+=12;u.mana+=10;}
    if(aug(s,u.side,'AUG_G09')&&u.deployRow===0&&allies(s,u).filter(x=>x.deployRow===0).length===1){u.armor+=45;u.mr+=45;u.flags.soloTank=1;}
    if(aug(s,u.side,'AUG_P05')){shieldCombatUnit(s,u,u,u.maxHp*0.3,6000);u.mana+=15;}
    if(s.augments.some(a=>a.includes('AUG_P05')))buff(s,u,'asSlow',20,6000,'stasis');
    u.mana=Math.min(u.maxMana,u.mana);
  }
  for(const side of [0,1] as const){const team=live(s,side),enemy=live(s,(1-side) as CombatSide),first=team[0];if(!first)continue;
    if(aug(s,side,'AUG_P01'))addEvent(s,{at:9000,sourceId:first.id,kind:'gamma',power:260,targetId:null,remaining:1});
    const ar=s.traits[side]['深空阵列'];if(ar){const focus=[...enemy].sort((a,b)=>b.hp-a.hp||cmp(a,b))[0];if(focus){const radius=2+(aug(s,side,'AUG_G07')?1:0);for(const x of enemy.filter(x=>hexDistance(x,focus)<=radius)){buff(s,x,'armorShred',n(ar,'shredPct'),FOREVER,`array:${side}`);buff(s,x,'mrShred',n(ar,'shredPct'),FOREVER,`array:${side}`);}if(ar.gammaStrike)addEvent(s,{at:7000,sourceId:first.id,kind:'gamma',power:240,targetId:null,remaining:1,cell:{row:focus.row,col:focus.col}});}}
    const dy=s.traits[side]['戴森工团'];if(dy&&n(dy,'solarMirror')){addEvent(s,{at:1000,sourceId:first.id,kind:'mirror',power:35*n(dy,'solarMirror'),targetId:null,remaining:Math.ceil(s.hardDeadlineMs/1000)});for(const u of team.filter(x=>x.deployRow<2))shieldCombatUnit(s,first,u,u.maxHp*0.1*n(dy,'solarMirror'),8000);}
    const sw=s.traits[side]['失控蜂群'];if(sw)for(const u of team.filter(u=>member(u,'失控蜂群'))){const target=[...enemy].sort((a,b)=>Math.abs(a.col-u.col)-Math.abs(b.col-u.col)||hexDistance(a,u)-hexDistance(b,u)||cmp(a,b))[0];if(target)buff(s,target,'manaTax',20,4000,u.id);}
  }
  calibrate(s);return s;
}
function calibrate(s:CombatState){for(const u of live(s).filter(x=>x.unitId==='S35')){const candidate=near(u,allies(s,u).filter(x=>x.id!==u.id)).sort((a,b)=>b.atk*b.atkSpeed-a.atk*a.atkSpeed||hexDistance(u,a)-hexDistance(u,b)||cmp(a,b))[0]??u;candidate.flags.calibrated=2;}}
export function findAttackPath(s:CombatState,u:CombatUnit,target:CombatUnit):CombatHex[]|null{
  const occupied=new Set(live(s).filter(x=>x.id!==u.id).map(cellKey));const reserved=new Set(live(s).filter(x=>x.id!==u.id&&x.move).map(x=>cellKey(x.move!.to)));
  const queue:CombatHex[][]=[[{row:u.row,col:u.col}]],seen=new Set([cellKey(u)]);
  for(let i=0;i<queue.length;i++){const path=queue[i]!,last=path[path.length-1]!;if(hexDistance(last,target)<=u.range)return path;for(const c of hexNeighbors(last)){const k=cellKey(c);if(!seen.has(k)&&!occupied.has(k)&&!reserved.has(k)){seen.add(k);queue.push([...path,c]);}}}return null;
}
function selectTarget(s:CombatState,u:CombatUnit):{target:CombatUnit;path:CombatHex[]}|null{
  const old=get(s,u.targetId);if(old?.alive&&val(s,u,'taunt')){const path=findAttackPath(s,u,old);if(path)return {target:old,path};}
  if(old?.alive&&u.blockedTicks<8){const path=findAttackPath(s,u,old);if(path)return {target:old,path};}
  const choices=enemies(s,u).map(target=>({target,path:findAttackPath(s,u,target)})).filter((x):x is {target:CombatUnit;path:CombatHex[]}=>x.path!==null).sort((a,b)=>a.path.length-b.path.length||cmp(a.target,b.target));
  const selected=u.blockedTicks>=8?(choices.find(x=>x.target.id!==old?.id)??choices[0]):choices[0];if(selected){u.targetId=selected.target.id;u.blockedTicks=0;return selected;}u.targetId=null;u.blockedTicks++;return null;
}
function deaths(s:CombatState){
  const dead=s.units.filter(u=>u.alive&&u.hp<=0);for(const u of dead){u.alive=false;u.move=null;u.shields=[];}
  for(const u of dead){
    const friends=allies(s,u),dy=ownTrait(s,u,'戴森工团');if(n(dy,'shieldPct')&&(s.flags[`recycle:${u.side}`]??0)<3){const target=near(u,friends.filter(x=>member(x,'戴森工团')))[0];if(target){s.flags[`recycle:${u.side}`]=(s.flags[`recycle:${u.side}`]??0)+1;shieldCombatUnit(s,u,target,u.maxHp*n(dy,'shieldPct')/100,4000);gainMana(s,target,n(dy,'mana'));if(aug(s,u.side,'AUG_G04'))buff(s,target,'as',15,4000,'recycle');}}
    for(const x of live(s)){const dil=ownTrait(s,x,'钟慢远征');if(n(dil,'missingHpHealPct')&&(x.flags.trailStacks??0)<4){x.flags.trailStacks=(x.flags.trailStacks??0)+1;healCombatUnit(s,x,x,(x.maxHp-x.hp)*n(dil,'missingHpHealPct')/100);buff(s,x,'as',6*x.flags.trailStacks,FOREVER,'trail');}}
    if(u.flags.soloTank)for(const x of friends)buff(s,x,'as',15,FOREVER,'soloDeath');
    if(aug(s,u.side,'AUG_P06')&&friends.length)for(const x of friends)if((x.flags.inheritStacks??0)<4){x.flags.inheritStacks=(x.flags.inheritStacks??0)+1;x.atk+=def(u).stats.atk*(def(u).starMultipliers[String(u.star)]??1)*0.15/friends.length;x.power+=def(u).stats.skillPowerBase*(def(u).starMultipliers[String(u.star)]??1)*0.15/friends.length;}
  }
}
function resolveEvents(s:CombatState){const due=s.events.filter(e=>e.at<=s.elapsedMs).sort((a,b)=>a.at-b.at||a.id-b.id);s.events=s.events.filter(e=>e.at>s.elapsedMs);
  for(const e of due){const u=get(s,e.sourceId);if(!u)continue;
    if(e.kind==='skill'){
      executeSkill(s,u,e.targetId,e.power);
      if(e.normalCast){
        if(e.firstCast&&effect(u,'startAndFirstCastShieldPct'))shieldCombatUnit(s,u,u,u.maxHp*0.12,4000);
        if(effect(u,'postCastTeamHealMaxHpPct')&&(u.flags.pumpAt??0)<=s.elapsedMs){u.flags.pumpAt=s.elapsedMs+2000;for(const x of [u,...near(u,allies(s,u).filter(x=>x.id!==u.id)).slice(0,1)])healCombatUnit(s,u,x,x.maxHp*0.06);}
      }
    }
    else if(e.kind==='gamma'||e.kind==='pulse'){for(const x of enemies(s,u).filter(x=>!e.cell||hexDistance(x,e.cell)<=2)){shoot(s,u,x,e.power,'magic',{skill:false,aoe:true,impactAt:s.elapsedMs,effects:e.kind==='pulse'?[{key:'vuln',value:20,until:4000,source:u.id}]:[]});if(e.cell)buff(s,x,'manaTax',15,4000,u.id);}}
    else if(e.kind==='dot'||e.kind==='wake'){for(const x of enemies(s,u).filter(x=>e.cell&&hexDistance(x,e.cell)<=1)){shoot(s,u,x,e.kind==='dot'?x.maxHp*e.power/100:e.power,'magic',{skill:false,aoe:true,impactAt:s.elapsedMs});buff(s,x,e.kind==='dot'?'antiHeal':'asSlow',e.kind==='dot'?33:25,1100,u.id);}if(e.remaining>1)addEvent(s,{...e,at:e.at+1000,remaining:e.remaining-1});}
    else if(e.kind==='mirror'&&u.alive){for(const x of enemies(s,u))shoot(s,u,x,e.power,'magic',{skill:false,aoe:true,impactAt:s.elapsedMs});if(e.remaining>1)addEvent(s,{...e,at:e.at+1000,remaining:e.remaining-1});}
  }
}
function periodic(s:CombatState,previous:number){
  if(Math.floor(previous/6000)!==Math.floor(s.elapsedMs/6000))calibrate(s);
  for(const u of live(s).filter(x=>x.unitId==='S36'))if(s.elapsedMs>=10000)s.flags[`horizon:${u.side}`]=1;
  for(const u of live(s)){
    u.buffs=u.buffs.filter(x=>x.until>s.elapsedMs);u.shields=u.shields.filter(x=>x.until>s.elapsedMs&&x.amount>0);
    if(!isManaLocked(s,u)&&u.pendingManaRefund){const refund=u.pendingManaRefund;u.pendingManaRefund=0;gainMana(s,u,refund);}
    const anti=ownTrait(s,u,'反物质院');const unleashAt=(s.mode==='quick'?6000:8000)-(aug(s,u.side,'AUG_G08')?2000:0);if(n(anti,'count')&&s.elapsedMs>=unleashAt&&!u.flags.unleashed){u.flags.unleashed=1;cleanse(u);buff(s,u,'as',n(anti,'unleashBonusPct'),FOREVER,'unleash');u.ap+=n(anti,'unleashBonusPct');}
    if(Math.floor(previous/1000)!==Math.floor(s.elapsedMs/1000)){
      if(has(u,'I_ZERO_STASIS_FILM')&&s.elapsedMs<=8000)buff(s,u,'as',3*Math.min(8,Math.floor(s.elapsedMs/1000)),FOREVER,'film');
      const burns=active(s,u,'burn').sort((a,b)=>b.value-a.value||a.source.localeCompare(b.source));const b=burns[0];if(b){const source=get(s,b.source);if(source)shoot(s,source,u,u.maxHp*b.value/100,'true',{skill:false,impactAt:s.elapsedMs});}
      if(s.elapsedMs%2000===0){healCombatUnit(s,u,u,u.maxHp*effect(u,'regenEvery2SecMaxHpPct')/100);if(has(u,'I_RED_GIANT_MAIL')){const target=near(u,enemies(s,u).filter(x=>hexDistance(x,u)<=1&&!val(s,x,'antiHeal')))[0];if(target)burn(s,u,target,1,4);}}
      if(s.elapsedMs%3000===0&&n(ownTrait(s,u,'木卫冰海'),'periodicShieldPct'))shieldCombatUnit(s,u,u,u.maxHp*n(ownTrait(s,u,'木卫冰海'),'periodicShieldPct')/100,3000);
      if(s.elapsedMs>=10000&&n(ownTrait(s,u,'失控蜂群'),'executeBelowPct'))for(const x of enemies(s,u).filter(x=>x.hp/x.maxHp<0.1))shoot(s,u,x,x.maxHp*10,'true',{skill:false,impactAt:s.elapsedMs});
    }
  }
}
function finish(s:CombatState,hard=false){const left=live(s,0),right=live(s,1);if(!hard&&left.length&&right.length)return;
  const pending=s.projectiles.some(p=>p.impactAt<=s.hardDeadlineMs&&get(s,p.targetId)?.alive)||s.events.some(e=>e.at<=s.hardDeadlineMs&&e.kind!=='mirror'&&enemies(s,get(s,e.sourceId)!).length>0);
  if(!hard&&pending)return;const winnerSide:CombatSide|null=left.length&&!right.length?0:right.length&&!left.length?1:null;
  s.result={outcome:winnerSide===null?'draw':winnerSide===0?'win':'loss',winnerSide,winnerSeatId:winnerSide===null?null:s.seats[winnerSide],elapsedMs:s.elapsedMs,telemetry:s.units.map(u=>({...u.telemetry})),survivors:{left:left.map(u=>u.instanceId),right:right.map(u=>u.instanceId)}};
}
export function stepCombat(s:CombatState,deltaMs=50):CombatState{
  if(!Number.isFinite(deltaMs)||deltaMs<0)throw new Error('deltaMs must be finite and nonnegative');
  let remaining=Math.min(deltaMs,s.hardDeadlineMs-s.elapsedMs);
  while(remaining>0&&!s.result){const dt=Math.min(50,remaining),previous=s.elapsedMs;s.elapsedMs+=dt;remaining-=dt;
    periodic(s,previous);
    for(const u of live(s))if(u.move&&u.move.arriveAt<=s.elapsedMs){if(!live(s).some(x=>x.id!==u.id&&sameCell(x,u.move!.to))){u.row=u.move.to.row;u.col=u.move.to.col;u.blockedTicks=0;}else u.blockedTicks++;u.move=null;}
    resolveEvents(s);
    if(live(s,0).length&&live(s,1).length&&s.elapsedMs<s.hardDeadlineMs)for(const u of live(s)){
      if(u.hp<=0||u.castUntil>s.elapsedMs||val(s,u,'stun'))continue;
      const choice=selectTarget(s,u);if(!choice)continue;
      const maxMana=u.maxMana*(1+val(s,u,'manaTax')/100);
      if(u.mana>=maxMana&&!isManaLocked(s,u)){beginCast(s,u);continue;}
      if(u.move)continue;
      if(choice.path.length>1){const to=choice.path[1]!;if(!live(s).some(x=>x.move&&sameCell(x.move.to,to))){u.move={to,arriveAt:s.elapsedMs+(n(ownTrait(s,u,'星门摆渡'),'count')?240:300)};}else u.blockedTicks++;continue;}
      if(s.elapsedMs>=u.nextAttackAt){u.attacks++;const speed=u.atkSpeed*(1+sum(s,u,'as')/100)*(1-val(s,u,'asSlow')/100)*(s.elapsedMs>=s.overtimeAtMs?1.5:1);u.nextAttackAt=s.elapsedMs+1000/Math.max(0.1,speed);shoot(s,u,choice.target,u.atk,'physical',{skill:false,auto:true});}
    }
    const hits=s.projectiles.filter(p=>p.impactAt<=s.elapsedMs).sort((a,b)=>a.impactAt-b.impactAt||a.id-b.id);s.projectiles=s.projectiles.filter(p=>p.impactAt>s.elapsedMs);for(const p of hits)damage(s,p);
    deaths(s);finish(s,s.elapsedMs>=s.hardDeadlineMs);
  }
  if(!s.result&&s.elapsedMs>=s.hardDeadlineMs)finish(s,true);return s;
}
export function runCombat(left:SeatState,right:SeatState,mode:DurationMode,seed=1):CombatResult{const s=createCombat(left,right,mode,seed);while(!s.result)stepCombat(s);return s.result;}
