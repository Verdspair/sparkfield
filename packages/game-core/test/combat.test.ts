import { describe, it, expect } from 'vitest';
import { SEASON1_UNITS, SEASON1_UNITS_BY_ID, SEASON1_ITEMS, UnitCombatTelemetrySchema } from '@pkg/contracts';
import type { SeatState, UnitInstance } from '../src/types.js';
import { hashState, cloneState } from '../src/rng.js';
import { createCombat, stepCombat, runCombat, hexDistance, hexNeighbors, findAttackPath, gainMana, isManaLocked, healCombatUnit, shieldCombatUnit, type CombatState, type CombatUnit, type CombatProjectile } from '../src/combat.js';
const NEVER=1e9;
function unit(id:string,unitId='S01',row=0,col=3,items:string[]=[]):UnitInstance{return {instanceId:id,unitId,star:1,location:{zone:'board',row,col},items,cryoRounds:0,frozenUntilRound:null,bonusHp:0,bonusSkillEfficiency:0};}
function seat(id:string,units:UnitInstance[],chosenAugments:string[]=[]):SeatState{return {id,units,chosenAugments,level:9,xp:0,gold:0,initialGold:0,goldLedger:[],shop:[null,null,null,null,null],shopLocked:false,inventoryItems:[],magneticCharges:0,reforgerCharges:0,cryoPodEnabled:false,augmentOffer:null,anvils:[],previousBattleTraits:[],lineupPlan:[],victoryPoints:0,pvpWinStreak:0,moraleGoldGranted:0,rerollVouchers:0,voucherRound:null,vouchersGranted:0,pendingAugmentRerollRounds:0,pendingLevelFreeRefreshes:0,learningChargeCents:0,learningGoldOrbs:[],pendingCommands:[],isBot:false,botDifficulty:'standard'};}
function freeze(s:CombatState){for(const u of s.units){u.nextAttackAt=NEVER;u.mana=0;u.manaLockUntil=NEVER;}}
function impact(source:CombatUnit,target:CombatUnit,amount:number,impactAt:number):CombatProjectile{return {id:1000+source.side,sourceId:source.id,targetId:target.id,amount,impactAt,damageType:'true',auto:false,skill:false,aoe:false,vampPct:0,killRefund:0,effects:[],bypass:0,crit:false,attackIndex:0};}
function fixture(unitId:string){const s=createCombat(seat('L',[unit('caster',unitId),unit('ally1','S01',1,3),unit('ally2','S01',1,2),unit('ally3','S01',2,3)]),seat('R',[unit('enemy1'),unit('enemy2','S01',0,2),unit('enemy3','S01',1,3)]),'standard',17);freeze(s);const caster=s.units.find(x=>x.instanceId==='caster')!;for(const u of s.units){if(u.side===1){u.hp=20000;u.maxHp=20000;}else u.hp=u.maxHp/2;}caster.mana=caster.maxMana;caster.manaLockUntil=0;return {s,caster};}

describe('isolated deterministic combat',()=>{
  it('same seed has identical outcomes, telemetry, and state; management entities never mutate',()=>{const l=seat('L',[unit('a','S32',0,3,['I_STRONG_CRIT_EDGE']),unit('b','S05',2,3)]),r=seat('R',[unit('x','S33'),unit('y','S36',2,3)]);const before=hashState([l,r]);const a=runCombat(l,r,'quick',42),b=runCombat(l,r,'quick',42);expect(a).toEqual(b);expect(hashState([l,r])).toBe(before);for(const t of a.telemetry)expect(UnitCombatTelemetrySchema.safeParse(t).success).toBe(true);const snap=createCombat(l,r,'quick',42);stepCombat(snap,2000);expect(snap).toEqual(stepCombat(createCombat(l,r,'quick',42),2000));snap.units[0]!.items.push('C_BELT');expect(hashState([l,r])).toBe(before);});
  it('serializable mid-fight state resumes identically',()=>{const l=seat('L',[unit('a','S29')]),r=seat('R',[unit('b','S33')]);const a=createCombat(l,r,'deep',123);stepCombat(a,4150);const b=cloneState(a);stepCombat(a,9000);stepCombat(b,9000);expect(hashState(a)).toBe(hashState(b));});
  it.each([['quick',20000],['standard',35000],['deep',45000]] as const)('%s has a strict %i ms deadline', (mode,deadline)=>{const s=createCombat(seat('L',[unit('a')]),seat('R',[unit('b')]),mode);freeze(s);stepCombat(s,100000);expect(s.elapsedMs).toBe(deadline);expect(s.result?.outcome).toBe('draw');});
  it('empty boards settle without extending the budget',()=>{expect(runCombat(seat('L',[]),seat('R',[]),'quick').outcome).toBe('draw');});
});

describe('independent commitments and simultaneous settlement',()=>{
  it('last projectile survives its shooter and can make a real double KO',()=>{const s=createCombat(seat('L',[unit('a')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];a.hp=b.hp=50;s.projectiles=[impact(a,b,100,100),impact(b,a,100,300)];stepCombat(s,150);expect(b.alive).toBe(false);expect(a.alive).toBe(true);expect(s.result).toBeNull();stepCombat(s,150);expect(s.result?.outcome).toBe('draw');expect(a.telemetry.trueDealt).toBe(50);expect(b.telemetry.trueDealt).toBe(50);});
  it('committed delayed skill fires after caster death',()=>{const s=createCombat(seat('L',[unit('a','S04')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];a.mana=a.maxMana;a.manaLockUntil=0;a.hp=20;b.hp=50;stepCombat(s,50);expect(s.events.some(x=>x.kind==='skill')).toBe(true);s.projectiles.push(impact(b,a,30,100));stepCombat(s,100);expect(a.alive).toBe(false);expect(s.result).toBeNull();stepCombat(s,600);expect(s.result?.outcome).toBe('draw');});
  it('no pending projectile extends hard deadline',()=>{const s=createCombat(seat('L',[unit('a')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];s.projectiles=[impact(a,b,NEVER,20100)];stepCombat(s,NEVER);expect(s.elapsedMs).toBe(20000);expect(s.result?.outcome).toBe('draw');expect(b.alive).toBe(true);});
  it('all damage due at the hard deadline resolves before settlement',()=>{const s=createCombat(seat('L',[unit('a')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];s.projectiles=[impact(a,b,NEVER,20000),impact(b,a,NEVER,20000)];stepCombat(s,NEVER);expect(s.result?.outcome).toBe('draw');expect(s.result?.survivors).toEqual({left:[],right:[]});});
});

describe('mana locks and deferred refunds',()=>{
  it('post-cast refund waits for cast + 1s, pays only once',()=>{const s=createCombat(seat('L',[unit('a','S04',0,3,['I_SUPERCOMP_ARRAY'])]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];a.mana=a.maxMana;a.manaLockUntil=0;b.hp=b.maxHp=10000;stepCombat(s,50);expect(a.pendingManaRefund).toBe(8);expect(gainMana(s,a,999)).toBe(0);stepCombat(s,1200);expect(a.mana).toBe(0);stepCombat(s,50);expect(a.mana).toBe(8);expect(a.pendingManaRefund).toBe(0);stepCombat(s,1000);expect(a.mana).toBe(8);});
  it('own skill shield extends lock beyond cast lock; destroyed shield releases one refund',()=>{const s=createCombat(seat('L',[unit('a','S01',0,3,['I_SUPERCOMP_ARRAY'])]),seat('R',[unit('b')]),'quick');freeze(s);const [a]=s.units;a!.mana=a!.maxMana;a!.manaLockUntil=0;stepCombat(s,1400);expect(isManaLocked(s,a!)).toBe(true);expect(a!.pendingManaRefund).toBe(8);expect(a!.mana).toBe(0);a!.shields=[];stepCombat(s);expect(a!.mana).toBe(8);stepCombat(s,500);expect(a!.mana).toBe(8);});
  it('damage mana is bounded to 20 per hit and 30 per second, including shields',()=>{const s=createCombat(seat('L',[unit('a')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];b.manaLockUntil=0;b.maxMana=1000;b.maxHp=b.hp=100000;s.projectiles=[impact(a,b,1000,50),{...impact(a,b,1000,100),id:1002},{...impact(a,b,1000,150),id:1003}];stepCombat(s,150);expect(b.mana).toBe(30);s.projectiles.push({...impact(a,b,1000,1050),id:1004});stepCombat(s,900);expect(b.mana).toBe(50);});
  it('photon trait refund combines with equipment and remains a single payout',()=>{const s=createCombat(seat('L',[unit('a','S04',0,3,['I_SUPERCOMP_ARRAY']),unit('c','S17',2,3)]),seat('R',[unit('b')]),'quick');freeze(s);const a=s.units.find(x=>x.instanceId==='a')!;a.mana=a.maxMana;a.manaLockUntil=0;stepCombat(s,50);expect(a.pendingManaRefund).toBe(14);stepCombat(s,1250);expect(a.mana).toBe(14);stepCombat(s,1000);expect(a.mana).toBe(14);});
});

describe('stable legal hex routing',()=>{
  it('neighbors are symmetric and one axial step apart',()=>{for(let row=0;row<8;row++)for(let col=0;col<7;col++)for(const n of hexNeighbors({row,col})){expect(hexDistance({row,col},n)).toBe(1);expect(hexNeighbors(n)).toContainEqual({row,col});}});
  it('path ends at empty attack cell, never enemy occupancy',()=>{const s=createCombat(seat('L',[unit('a','S01',3,0)]),seat('R',[unit('b','S01',3,0)]),'quick');const [a,b]=s.units as [CombatUnit,CombatUnit];const path=findAttackPath(s,a,b)!;expect(path.length).toBeGreaterThan(1);expect(hexDistance(path[path.length-1]!,b)).toBe(1);expect(path[path.length-1]).not.toEqual({row:b.row,col:b.col});});
  it('occupancy stays at origin while reservation is active; reservations never collide',()=>{const s=createCombat(seat('L',[unit('a','S01',3,2),unit('c','S01',3,4)]),seat('R',[unit('b','S01',3,3)]),'quick');const origins=new Map(s.units.map(x=>[x.id,{row:x.row,col:x.col}]));stepCombat(s);const moving=s.units.filter(x=>x.move);expect(moving.length).toBeGreaterThan(0);expect(new Set(moving.map(x=>`${x.move!.to.row},${x.move!.to.col}`)).size).toBe(moving.length);for(const u of moving)expect({row:u.row,col:u.col}).toEqual(origins.get(u.id));});
  it('retarget never resets the existing attack cooldown',()=>{const s=createCombat(seat('L',[unit('a','S09')]),seat('R',[unit('b'),unit('c','S01',0,2)]),'quick');const a=s.units[0]!;a.nextAttackAt=5000;a.targetId=s.units[1]!.id;s.units[1]!.alive=false;s.units[1]!.hp=0;stepCombat(s);expect(a.targetId).toBe(s.units[2]!.id);expect(a.nextAttackAt).toBe(5000);expect(a.attacks).toBe(0);});
});

describe('all 36 concrete skill specs',()=>{
  const support=new Set(['S01','S02','S05','S07','S11','S12','S15','S18','S31']);
  it.each(SEASON1_UNITS.map(d=>[d.id,d.skillSpec.kind] as const))('%s executes %s rather than a generic damage spell',(id,kind)=>{const {s,caster}=fixture(id);stepCombat(s,1600);expect(caster.flags.casts).toBe(1);const dealt=caster.telemetry.magicDealt+caster.telemetry.physicalDealt+caster.telemetry.trueDealt;if(support.has(id))expect(dealt).toBe(0);else expect(dealt).toBeGreaterThan(0);
    const friends=s.units.filter(u=>u.side===0),foes=s.units.filter(u=>u.side===1);const buffed=(key:string)=>s.units.some(u=>u.buffs.some(b=>b.key===key));
    switch(kind){
      case 'self_shield_dr':expect(caster.shields.some(x=>x.skillLock&&x.amount>0)).toBe(true);expect(buffed('autoDr')).toBe(true);break;
      case 'ally_heal_buff':expect(buffed('resist')).toBe(true);expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);break;
      case 'ally_heal_ap':expect(friends.some(u=>u.flags.nextAp===12)).toBe(true);break;
      case 'ally_heal_cleanse_as':expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);break;
      case 'flank_strike':expect(buffed('shieldReduce')).toBe(true);break;
      case 'chain_magic':expect(foes.filter(x=>x.telemetry.damageTaken>0).length).toBeGreaterThanOrEqual(2);break;
      case 'aoe_magic_slow':case 'cluster_magic_slow':expect(buffed('asSlow')).toBe(true);break;
      case 'cleave_antiheal':expect(buffed('antiHeal')).toBe(true);expect(foes.filter(x=>x.telemetry.damageTaken>0)).toHaveLength(2);break;
      case 'line_pierce':expect(caster.telemetry.physicalDealt).toBeGreaterThan(0);break;
      case 'single_strike_shield':expect(caster.shields.length).toBeGreaterThan(0);break;
      case 'dual_shield':expect(friends.filter(x=>x.shields.length>0)).toHaveLength(2);break;
      case 'ally_shield_as':expect(buffed('as')).toBe(true);expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);break;
      case 'flank_shield_break':expect(caster.telemetry.physicalDealt).toBeGreaterThan(0);break;
      case 'flank_lifesteal':expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);break;
      case 'self_heal_row_resist':expect(buffed('resist')).toBe(true);break;
      case 'aoe_magic_mr_shred':expect(buffed('mrShred')).toBe(true);break;
      case 'splash_isolated_magic':expect(foes.filter(x=>x.telemetry.damageTaken>0)).toHaveLength(2);break;
      case 'mark_vuln_ally_mana':expect(buffed('vuln')).toBe(true);expect(friends.some(x=>x.shields.length>0)).toBe(true);break;
      case 'pierce_splash_phys':expect(foes.filter(x=>x.telemetry.damageTaken>0).length).toBeGreaterThan(1);break;
      case 'drone_salvo':expect(caster.telemetry.physicalDealt).toBeGreaterThan(0);break;
      case 'multi_volley_as':expect(caster.flags.volleyStacks).toBe(3);break;
      case 'shield_front_wave':expect(caster.shields.length).toBeGreaterThan(0);break;
      case 'dash_dual_torpedo':expect(caster.telemetry.physicalDealt).toBeGreaterThan(0);expect(caster.telemetry.magicDealt).toBeGreaterThan(0);break;
      case 'mega_shield_taunt_arc':expect(caster.shields.length).toBeGreaterThan(0);expect(foes.some(x=>x.targetId===caster.id)).toBe(true);break;
      case 'aoe_stun_sunder':expect(buffed('armorShred')).toBe(true);expect(buffed('mrShred')).toBe(true);break;
      case 'cone_barrage_reset':expect(caster.telemetry.physicalDealt).toBeGreaterThan(0);break;
      case 'dual_focus_blast':expect(foes.filter(x=>x.telemetry.damageTaken>0).length).toBeGreaterThan(1);break;
      case 'sanctuary_pure_support':expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);expect(friends.every(x=>x.shields.length>0)).toBe(true);break;
      case 'chain_dash_slash':expect(caster.shields).toHaveLength(3);break;
      case 'penrose_global_jet':expect(foes.every(x=>x.telemetry.damageTaken>0)).toBe(true);expect(buffed('vuln')).toBe(true);break;
      case 'lightcone_dual_stance':expect(caster.telemetry.healingAndShielding).toBeGreaterThan(0);break;
      case 'frontline_shield_barrage':expect(caster.shields.length).toBeGreaterThan(0);break;
      case 'event_horizon_collapse':expect(s.events.some(x=>x.kind==='dot')).toBe(true);expect(buffed('antiHeal')).toBe(true);break;
      default:throw new Error(`Unasserted skill ${id}`);
    }
  });
  it('S31 has exactly zero skill damage even with damage equipment',()=>{const {s,caster}=fixture('S31');caster.items=['I_FALLOUT_BRAND','I_IONOSPHERE_RING','I_NON_EUCLID_LENS'];stepCombat(s,1600);expect(caster.telemetry.magicDealt+caster.telemetry.physicalDealt).toBe(0);});
  it('S34 rear stance has unlimited range and picks cumulative damage leader',()=>{const {s,caster}=fixture('S34');caster.deployRow=3;caster.range=99;const foes=s.units.filter(x=>x.side===1);foes[1]!.telemetry.physicalDealt=999;stepCombat(s,1000);expect(foes[1]!.telemetry.damageTaken).toBeGreaterThan(0);expect(foes[0]!.telemetry.damageTaken).toBe(0);});
  it('S33 unique near-death jet is free and committed exactly once',()=>{const {s,caster}=fixture('S33');caster.mana=0;caster.manaLockUntil=NEVER;const enemy=s.units.find(x=>x.side===1)!;s.projectiles.push(impact(enemy,caster,NEVER,50));stepCombat(s,50);expect(caster.hp).toBe(1);expect(caster.flags.penrose).toBe(1);expect(s.events.filter(x=>x.sourceId===caster.id&&x.kind==='skill')).toHaveLength(1);stepCombat(s,1400);expect(caster.telemetry.magicDealt).toBeGreaterThan(0);expect(caster.flags.casts??0).toBe(0);});
});

describe('numeric equipment / trait / augment integration',()=>{
  it.each(SEASON1_ITEMS.completedItems.map(x=>[x.id]))('%s has finite deterministic battle behavior',id=>{const a=seat('L',[unit('a','S28',0,3,[id!]),unit('c','S31',2,3)]),b=seat('R',[unit('b','S29'),unit('d','S35',1,2)]);const result=runCombat(a,b,'quick',91);for(const t of result.telemetry)expect(UnitCombatTelemetrySchema.safeParse(t).success).toBe(true);expect(result.elapsedMs).toBeLessThanOrEqual(20000);expect(result).toEqual(runCombat(a,b,'quick',91));});
  it('completed items inherit both component stats and their explicit effects',()=>{const s=createCombat(seat('L',[unit('a','S01',0,3,['I_ONEILL_ARMOR','I_FUSION_BLADE','I_HYPER_SWARM'])]),seat('R',[unit('b')]),'quick');const a=s.units[0]!;expect(a.maxHp).toBeCloseTo((715+300+450)*1.08);expect(a.atk).toBeCloseTo((40+20)*1.25);expect(a.atkSpeed).toBeCloseTo(0.65*1.48);expect(a.range).toBe(2);});
  it('duplicate native cards do not inflate trait count, and emblems add at most one',()=>{const l=seat('L',[unit('a','S01'),unit('c','S01',0,2),unit('d','S03',1,2,['E_DYSON']),unit('e','S04',1,4,['E_DYSON'])]);const s=createCombat(l,seat('R',[unit('b')]),'quick');expect(s.traits[0]['戴森工团']?.count).toBe(2);});
  it('overtime -> strongest wound -> horizon is applied once, in fixed multiplicative order',()=>{const {s,caster}=fixture('S31');freeze(s);const target=s.units.find(x=>x.instanceId==='ally1')!;target.hp=100;target.maxHp=10000;s.elapsedMs=s.overtimeAtMs;s.flags['horizon:1']=1;target.buffs.push({key:'antiHeal',value:33,until:NEVER,source:'a'},{key:'antiHeal',value:20,until:NEVER,source:'b'},{key:'shieldReduce',value:25,until:NEVER,source:'c'});expect(healCombatUnit(s,caster,target,100)).toBeCloseTo(100*0.5*0.67*0.75);expect(shieldCombatUnit(s,caster,target,100,1000)).toBeCloseTo(100*0.5*0.75*0.75);});
  it('positioning and defensive combat augments modify combat numbers, not source units',()=>{const l=seat('L',[unit('a','S01'),unit('c','S09',3,1)],['AUG_S04','AUG_S05','AUG_S07','AUG_G09','AUG_P05']);const s=createCombat(l,seat('R',[unit('b')]),'quick');const a=s.units[0]!,c=s.units[1]!;expect(a.armor).toBe(30+12+45);expect(a.mana).toBe(65);expect(a.shields.length).toBe(2);expect(c.range).toBe(5);expect(c.buffs.some(b=>b.key==='amp'&&b.value===10)).toBe(true);expect(s.units.every(u=>u.buffs.some(b=>b.key==='asSlow'&&b.value===20))).toBe(true);expect(l.units[0]!.bonusHp).toBe(0);});
});


describe('regression: true secondary targets and dead-source pulses',()=>{
  it('blocked threshold chooses an available secondary even if old target wins distance sort',()=>{const s=createCombat(seat('L',[unit('a','S09')]),seat('R',[unit('b'),unit('c','S01',0,2)]),'quick');freeze(s);const a=s.units[0]!,old=s.units[1]!,secondary=s.units[2]!;a.targetId=old.id;a.blockedTicks=8;a.nextAttackAt=5000;stepCombat(s);expect(a.targetId).toBe(secondary.id);expect(a.nextAttackAt).toBe(5000);expect(a.attacks).toBe(0);});
  it('an already committed cloud pulse stays valid after its final ally dies',()=>{const s=createCombat(seat('L',[unit('a','S03')]),seat('R',[unit('b')]),'quick');freeze(s);const [a,b]=s.units as [CombatUnit,CombatUnit];a.hp=1;b.hp=50;s.events.push({id:99,sourceId:a.id,kind:'pulse',at:150,targetId:null,power:1000,remaining:1});s.projectiles.push(impact(b,a,2,50));stepCombat(s,50);expect(a.alive).toBe(false);expect(s.result).toBeNull();stepCombat(s,100);expect(s.result?.outcome).toBe('draw');expect(a.telemetry.magicDealt).toBe(50);});
});

describe('skill ratios are content values, not generic flat damage',()=>{
  it.each([
    ['S03',110,0],['S06',0,240],['S08',170,0],['S10',168,0],['S13',161,0],['S14',168,0],
    ['S16',0,378],['S17',0,266],['S19',0,427.5],['S20',408.5,0],['S21',0,399],
    ['S22',0,484.5],['S23',228,0],['S24',273.6,0],['S25',0,427.5],['S28',0,663],
    ['S32',858,0],['S33',0,918],['S34',522,0],['S35',1134,0],
  ] as const)('%s uses exact skillSpec coefficients',(id,physical,magic)=>{const {s,caster}=fixture(id);for(const enemy of s.units.filter(x=>x.side===1)){enemy.armor=0;enemy.mr=0;}stepCombat(s,1600);expect(caster.telemetry.physicalDealt).toBeCloseTo(physical);expect(caster.telemetry.magicDealt).toBeCloseTo(magic);});
  it('S17 single-target bonus and S23 isolated bonus are conditional',()=>{for(const [id,expected] of [['S17',166.25],['S23',285]] as const){const {s,caster}=fixture(id);const foes=s.units.filter(x=>x.side===1);foes[0]!.armor=foes[0]!.mr=0;for(const u of foes.slice(1))u.alive=false;stepCombat(s,1400);expect(caster.telemetry.physicalDealt+caster.telemetry.magicDealt).toBeCloseTo(expected);}});
  it('S31 real heal/shield coefficients are exact and damage remains zero',()=>{const {s,caster}=fixture('S31');stepCombat(s,1600);expect(caster.telemetry.healingAndShielding).toBeCloseTo(3*0.95*260+4*0.4*260);expect(caster.telemetry.magicDealt+caster.telemetry.physicalDealt).toBe(0);});
});
