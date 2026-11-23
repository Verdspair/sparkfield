import { describe, expect, it } from 'vitest';
import { MODE_BUDGETS, SEASON1_UNITS, type DurationMode } from '@pkg/contracts';
import { createGame, createSeat, applyGameCommand, settleRound, beginNextRound, itemComponentShares } from '../src/game.js';
import { assertGameIntegrity } from '../src/integrity.js';
import { createRng, nextRandom, cloneState, hashState } from '../src/rng.js';
import { createPool, drawShopCard, drawUnitOfCost, assertPoolConservation, releaseShop, takeFromPool, starCopies } from '../src/pool.js';
import { grantGold, addExperience, applyLearningGoldGrant, buyExperience, populationCap, settleSeatEconomy, assertGoldConservation } from '../src/economy.js';
import { buyCard, makeUnit, moveUnit, receiveUnit, finalizePrepDeadline, sellUnit, getShopPurchasePreview } from '../src/index.js';
import { roundRobin, getRoundPairings, victoryPointsFor, finalPlacements } from '../src/schedule.js';
import type { GameState, SeatState } from '../src/types.js';
function clearSeat(game: GameState, seat: SeatState) {
  releaseShop(game, seat);
  for (const u of seat.units) game.pool[u.unitId]! += starCopies(u.star);
  seat.units = [];
}
function add(game: GameState, seat: SeatState, id: string, location: Parameters<typeof makeUnit>[2], star: 1|2|3 = 1) {
  expect(takeFromPool(game.pool, id, starCopies(star))).toBe(true);
  const u = makeUnit(game, id, location, star); seat.units.push(u); return u;
}
function finishDrawRound(game: GameState) { finalizePrepDeadline(game); settleRound(game, game.seats.map(s => ({ seatId: s.id, outcome: 'draw' as const }))); }
function putShop(game:GameState,seat:SeatState,id:string) { releaseShop(game,seat); expect(takeFromPool(game.pool,id)).toBe(true); seat.shop[0]=id; }
describe('determinism and finite pool', () => {
  it('serializes the full PRNG continuation and canonicalizes object keys', () => {
    const a=createRng(0); for(let i=0;i<10;i++) nextRandom(a); const b=cloneState(a);
    expect(Array.from({length:100},()=>nextRandom(a))).toEqual(Array.from({length:100},()=>nextRandom(b)));
    expect(hashState({b:1,a:2})).toBe(hashState({a:2,b:1}));
  });
  it('contains 748 cards and exact tier inventories', () => {
    const p=createPool(); expect(Object.values(p).reduce((a,b)=>a+b,0)).toBe(748);
    for(const u of SEASON1_UNITS) expect(p[u.id]).toBe(({1:28,2:24,3:20,4:14,5:9})[u.cost]);
  });
  it('renormalizes only positive tiers and never charges an empty reroll', () => {
    const pool=Object.fromEntries(SEASON1_UNITS.map(u=>[u.id,0])); const rng=createRng(12);
    pool.S10=3; pool.S33=9;
    for(let i=0;i<3;i++) expect(drawShopCard(pool,3,rng)).toBe('S10');
    expect(drawShopCard(pool,3,rng)).toBeNull(); expect(pool.S33).toBe(9);
    const g=createGame('quick',1);const s=g.seats[0]!;s.shop=Array(5).fill(null);g.pool=Object.fromEntries(SEASON1_UNITS.map(u=>[u.id,0]));
    const gold=s.gold;const seed=g.rng.state;expect(applyGameCommand(g,s.id,{type:'REFRESH_SHOP'}).ok).toBe(false);expect(s.gold).toBe(gold);expect(g.rng.state).toBe(seed);
  });
  it.each(['quick','standard','deep'] as DurationMode[])('%s start and repeated transactions preserve all copies', mode=>{
    const g=createGame(mode,23);assertGameIntegrity(g);
    const s=g.seats[0]!;const e=MODE_BUDGETS.modes[mode].economy;
    expect(s.level).toBe(e.starting_level);expect(s.gold).toBe(e.starting_gold);
    expect(s.units.reduce((a,u)=>a+starCopies(u.star),0)).toBe(e.starting_one_cost_units);
    grantGold(s,100,'test_grant');
    for(let i=0;i<15;i++) {
      for(let k=0;k<5;k++) {applyGameCommand(g,s.id,{type:'BUY_CARD',shopIndex:k});assertGameIntegrity(g);}
      if(s.units[0]) sellUnit(g,s,s.units[0].instanceId);
      applyGameCommand(g,s.id,{type:'REFRESH_SHOP'}); assertGameIntegrity(g);
    }
    for(const seat of g.seats) {for(const u of [...seat.units]) sellUnit(g,seat,u.instanceId);releaseShop(g,seat);}
    expect(Object.values(g.pool).reduce((a,b)=>a+b,0)).toBe(748);assertGameIntegrity(g);
  });
});
describe('atomic purchases and board operations',()=>{
  it('buys into a full bench by combining a field pair',()=>{
    const g=createGame('quick');const s=g.seats[0]!;clearSeat(g,s);
    const body=add(g,s,'S01',{zone:'board',row:1,col:3});add(g,s,'S01',{zone:'board',row:2,col:3});
    for(let i=0;i<9;i++) add(g,s,'S02',{zone:'bench',slot:i});putShop(g,s,'S01');
    const before = hashState(g);
    expect(getShopPurchasePreview(s, 0)).toEqual({ canBuy: true, canDirectStarUp: true, targetStar: 2, ownedCount: 2, goldCost: 1, reason: null });
    expect(hashState(g)).toBe(before);
    expect(buyCard(g,s,0)).toEqual({ok:true});expect(s.units.find(u=>u.instanceId===body.instanceId)?.star).toBe(2);expect(s.units.filter(u=>u.location.zone==='bench')).toHaveLength(9);assertPoolConservation(g);
  });
  it('chains a full-bench 1→2→3 purchase and returns duplicate/overflow equipment',()=>{
    const g=createGame('quick',8);const s=g.seats[0]!;clearSeat(g,s);
    const body=add(g,s,'S01',{zone:'board',row:0,col:2},2);body.items=['I_FUSION_BLADE'];
    const second=add(g,s,'S01',{zone:'board',row:1,col:2},2);second.items=['I_LORENTZ_RAIL','I_FUSION_BLADE'];
    add(g,s,'S01',{zone:'bench',slot:0});const pair=add(g,s,'S01',{zone:'bench',slot:1});pair.items=['C_SWORD'];
    for(let i=2;i<9;i++) add(g,s,'S03',{zone:'bench',slot:i});
    putShop(g,s,'S01');
    expect(getShopPurchasePreview(s, 0)).toMatchObject({ canBuy: true, canDirectStarUp: true, targetStar: 3, ownedCount: 2 });
    expect(buyCard(g,s,0).ok).toBe(true);
    const result=s.units.find(u=>u.instanceId===body.instanceId)!;expect(result.star).toBe(3);expect(result.location).toEqual({zone:'board',row:0,col:2});
    expect(result.items).toEqual(['I_FUSION_BLADE','I_LORENTZ_RAIL','C_SWORD']);expect(s.inventoryItems.filter(x=>x==='I_FUSION_BLADE')).toHaveLength(1);assertPoolConservation(g);
  });
  it('rejects a full-bench non-combine without touching gold, shop or units',()=>{
    const g=createGame('quick');const s=g.seats[0]!;clearSeat(g,s);
    for(let i=0;i<9;i++) add(g,s,'S02',{zone:'bench',slot:i});putShop(g,s,'S01');
    const before=hashState(g);expect(buyCard(g,s,0)).toEqual({ok:false,reason:'BENCH_FULL'});expect(hashState(g)).toBe(before);
  });
  it('reports a frozen copy, empty slots, and gold failures without writing state', () => {
    const game = createGame('quick'); const seat = game.seats[0]!; clearSeat(game, seat);
    add(game, seat, 'S01', { zone: 'board', row: 0, col: 0 });
    const frozen = add(game, seat, 'S01', { zone: 'board', row: 0, col: 1 });
    frozen.frozenUntilRound = 2;
    for (let slot = 0; slot < 9; slot++) add(game, seat, 'S02', { zone: 'bench', slot });
    putShop(game, seat, 'S01');
    const before = hashState(game);
    expect(getShopPurchasePreview(seat, 0)).toEqual({ canBuy: false, canDirectStarUp: false, targetStar: null, ownedCount: 1, goldCost: 1, reason: 'BENCH_FULL' });
    expect(getShopPurchasePreview(seat, 1)).toEqual({ canBuy: false, canDirectStarUp: false, targetStar: null, ownedCount: 0, goldCost: null, reason: 'EMPTY_SHOP_SLOT' });
    expect(hashState(game)).toBe(before);
    frozen.frozenUntilRound = null;
    seat.gold = 0;
    expect(getShopPurchasePreview(seat, 0)).toEqual({ canBuy: false, canDirectStarUp: false, targetStar: 2, ownedCount: 2, goldCost: 1, reason: 'INSUFFICIENT_GOLD' });
    expect(buyCard(game, seat, 0)).toEqual({ ok: false, reason: 'INSUFFICIENT_GOLD' });
  });
  it('swaps occupied hexes and atomically replaces at population cap',()=>{
    const g=createGame('quick');const s=g.seats[0]!;clearSeat(g,s);
    for(let i=0;i<4;i++) add(g,s,'S01',{zone:'board',row:0,col:i});const b=add(g,s,'S02',{zone:'bench',slot:0});
    const original=s.units[0]!;expect(moveUnit(g,s,b.instanceId,{zone:'board',row:0,col:0}).ok).toBe(true);
    expect(original.location).toEqual({zone:'bench',slot:0});expect(b.location).toEqual({zone:'board',row:0,col:0});expect(s.units.filter(u=>u.location.zone==='board')).toHaveLength(4);
    const target=s.units[1]!;expect(moveUnit(g,s,b.instanceId,target.location).ok).toBe(true);expect(target.location).toEqual({zone:'board',row:0,col:0});
    expect(moveUnit(g,s,original.instanceId,{zone:'board',row:3,col:6}).ok).toBe(false);assertGameIntegrity(g);
  });
  it('at the strategy deadline clears unsubmitted state and deploys bench left-to-right except cryo',()=>{
    const g=createGame('quick');const s=g.seats[0]!;clearSeat(g,s);
    const ranged=add(g,s,'S02',{zone:'bench',slot:0});const melee=add(g,s,'S01',{zone:'bench',slot:1});const frozen=add(g,s,'S03',{zone:'bench',slot:8});frozen.frozenUntilRound=2;
    s.pendingCommands=[{dragging:melee.instanceId}];finalizePrepDeadline(g);
    expect(s.pendingCommands).toEqual([]);expect(ranged.location).toEqual({zone:'board',row:3,col:3});expect(melee.location).toEqual({zone:'board',row:0,col:3});expect(frozen.location).toEqual({zone:'bench',slot:8});expect(g.phase).toBe('battle');
  });
  it('thawing resumes automatic combinations while the frozen round cannot merge',()=>{
    const g=createGame('quick');const s=g.seats[0]!;clearSeat(g,s);
    const body=add(g,s,'S01',{zone:'board',row:0,col:0});add(g,s,'S01',{zone:'bench',slot:0});const frozen=add(g,s,'S01',{zone:'bench',slot:8});frozen.frozenUntilRound=2;
    expect(s.units.filter(u=>u.unitId==='S01')).toHaveLength(3);finishDrawRound(g);beginNextRound(g);
    expect(s.units.filter(u=>u.unitId==='S01')).toHaveLength(1);expect(s.units[0]!.instanceId).toBe(body.instanceId);expect(s.units[0]!.star).toBe(2);assertGameIntegrity(g);
  });
  it('locks for one rollover only and leaves bought slots empty',()=>{
    const g=createGame('quick');const s=g.seats[0]!;buyCard(g,s,0);s.shopLocked=true;const shop=[...s.shop];
    finishDrawRound(g);beginNextRound(g);expect(s.shop).toEqual(shop);expect(s.shopLocked).toBe(false);expect(s.shop[0]).toBeNull();
    finishDrawRound(g);beginNextRound(g);expect(s.shop.every(Boolean)).toBe(true);assertGameIntegrity(g);
  });
});
describe('integer economy and public schedule',()=>{
  it('preserves overflow XP and changes paid XP only with P02',()=>{
    const s=createSeat('x','deep');grantGold(s,100,'test');addExperience(s,30,'deep');expect(s.level).toBe(6);expect(s.xp).toBe(4);
    const old=s.xp;buyExperience(s,'deep');expect(s.xp-old).toBe(4);s.chosenAugments.push('AUG_P02');const before=s.xp;buyExperience(s,'deep');expect(s.xp-before).toBe(6);assertGoldConservation(s);
  });
  it('flag only adds one team slot and never changes level/shop odds',()=>{
    const g=createGame('standard');const s=g.seats[0]!;clearSeat(g,s);const u=add(g,s,'S01',{zone:'board',row:0,col:0});const v=add(g,s,'S02',{zone:'board',row:3,col:0});u.items=['I_MOTHERSHIP_FLAG'];v.items=['I_MOTHERSHIP_FLAG'];
    expect(populationCap(s,'standard')).toBe(5);expect(s.level).toBe(4);
    u.location={zone:'bench',slot:0};v.items=[];expect(populationCap(s,'standard')).toBe(5);
  });
  it('integer learning grants record whole orb display and carry without rounding',()=>{
    const s=createSeat('x','quick');const startGold=s.gold;applyLearningGoldGrant(s,3,99);expect(s.gold).toBe(startGold+3);expect(s.learningGoldOrbs).toEqual([1,1,1]);expect(s.learningChargeCents).toBe(99);assertGoldConservation(s);
    expect(()=>applyLearningGoldGrant(s,0,100)).toThrow();expect(()=>applyLearningGoldGrant(s,0.5,1)).toThrow();
  });
  it('interest excludes newly granted income and final rounds issue no base or XP',()=>{
    const s=createSeat('x','standard');s.gold=9;s.initialGold=9;settleSeatEconomy(s,'standard',false);expect(s.gold).toBe(9+MODE_BUDGETS.modes.standard.economy.base_income);const snap=cloneState(s);settleSeatEconomy(s,'standard',true);expect(s).toEqual(snap);
  });
  it('PVE pauses streak, all-seat vouchers expire, and no loss subsidy exists',()=>{
    const g=createGame('standard');const s=g.seats[0]!;
    function round(outcome:'win'|'loss'|'draw'){finalizePrepDeadline(g);settleRound(g,g.seats.map(x=>({seatId:x.id,outcome:x.id===s.id?outcome:'loss' as const})));}
    round('win');beginNextRound(g);round('win');expect(s.moraleGoldGranted).toBe(1);expect(g.seats.every(x=>x.rerollVouchers===1&&x.voucherRound===3)).toBe(true);
    beginNextRound(g);const gold=s.gold;expect(applyGameCommand(g,s.id,{type:'REFRESH_SHOP'}).ok).toBe(true);expect(s.gold).toBe(gold);expect(s.rerollVouchers).toBe(0);
    round('win');beginNextRound(g);const streak=s.pvpWinStreak;round('loss');expect(s.pvpWinStreak).toBe(streak);beginNextRound(g);round('loss');expect(s.pvpWinStreak).toBe(0);expect(s.goldLedger.some(e=>e.reason.includes('loss'))).toBe(false);assertGameIntegrity(g);
  });
  it('circle schedule has 28 unique matches, explicit rematches, and no score tiebreaks',()=>{
    const ids=Array.from({length:8},(_,i)=>String(i));const rr=roundRobin(ids);expect(new Set(rr.flat().map(([a,b])=>[a,b].sort().join('-'))).size).toBe(28);
    expect(getRoundPairings('standard',4,ids)).toEqual([]);expect(getRoundPairings('deep',9,ids)).toEqual(rr[1]);expect(getRoundPairings('deep',11,ids)).toEqual(rr[3]);expect(getRoundPairings('deep',12,ids)).toEqual(rr[5]);
    expect(victoryPointsFor('quick',5,'win')).toBe(10);expect(victoryPointsFor('standard',8,'draw')).toBe(5);expect(victoryPointsFor('deep',8,'win')).toBe(0);
    expect(finalPlacements([{id:'a',victoryPoints:12},{id:'b',victoryPoints:8},{id:'c',victoryPoints:8},{id:'d',victoryPoints:0}]).map(x=>x.place)).toEqual([1,2,2,4]);
  });
  const modeCases = [
    { mode: 'quick', total: 900, rounds: 6, pvp: 6, startingGold: 16, baseIncome: 35, learningGold: 4200, earnedShare: 55, arcCaps: [[700, 950, 1050, 1500]] },
    { mode: 'standard', total: 1800, rounds: 8, pvp: 7, startingGold: 14, baseIncome: 42, learningGold: 5400, earnedShare: 56, arcCaps: [[600, 900, 1200], [600, 900, 1200]] },
    { mode: 'deep', total: 3600, rounds: 12, pvp: 10, startingGold: 12, baseIncome: 55, learningGold: 7800, earnedShare: 59, arcCaps: [[450, 600, 650, 900], [450, 600, 650, 900], [450, 600, 650, 900]] },
  ] as const;
  it.each(modeCases)('$mode schedules complete arcs and legal battle windows', ({ mode, total, arcCaps, rounds, pvp }) => {
    const budget = MODE_BUDGETS.modes[mode];
    const layout = arcCaps.map(caps => caps.length);
    const slots = layout.reduce<number>((sum, length) => sum + length, 0);
    expect(budget.rounds).toBe(rounds);
    expect(budget.pvp_round_count).toBe(pvp);
    expect(budget.study_arc_slots).toEqual(layout);
    expect(budget.learning).toHaveLength(slots);
    expect(budget.verification_weight_percent_by_block).toEqual(layout.flatMap(length => length === 4 ? [0, 0, 30, 100] : [0, 30, 100]));
    const teach = [true, false, true, false, false];
    const apply = [true, false, true, true, true];
    const verify = [false, false, false, false, true];
    expect(budget.learning_detail.every(slot => slot.seconds_by_phase.every(seconds => Number.isInteger(seconds) && seconds >= 0))).toBe(true);
    expect(budget.learning_detail.map(slot => slot.seconds_by_phase.map(seconds => seconds > 0))).toEqual(layout.flatMap(length => length === 4 ? [teach, teach, apply, verify] : [teach, apply, verify]));
    expect(budget.learning_detail.map(slot => slot.seconds_by_phase.reduce((sum, seconds) => sum + seconds, 0))).toEqual(budget.learning);
    expect(budget.learning_detail.map(slot => slot.battle_rounds_after)).toEqual(budget.groups);
    expect(budget.groups.flat()).toEqual(Array.from({ length: rounds }, (_, i) => i + 1));
    expect(budget.timeline.filter(segment => segment.kind === 'learning').map(segment => segment.duration)).toEqual(budget.learning);
    expect(budget.timeline.filter(segment => segment.kind === 'resource')).toHaveLength(slots);
    expect(budget.timeline.filter(segment => segment.kind === 'strategy').map(segment => segment.duration)).toEqual(Array(rounds).fill(budget.strategy));
    expect(budget.timeline.filter(segment => segment.kind === 'battle' && segment.label.endsWith('PVP'))).toHaveLength(pvp);
    expect(budget.timeline.filter(segment => segment.kind === 'battle' && segment.label.endsWith('PVE'))).toHaveLength(rounds - pvp);
    for (const event of budget.events_detail) {
      const eventIndex = budget.timeline.findIndex(segment => segment.kind === 'choice' && segment.label.startsWith(`R${event.round} ${event.name}`));
      const anchorKind = event.position === 'before' ? 'strategy' : 'settlement';
      const anchorIndex = budget.timeline.findIndex(segment => segment.kind === anchorKind && segment.label.startsWith(`R${event.round} `));
      expect(anchorIndex).toBeGreaterThanOrEqual(0);
      expect(eventIndex).toBeGreaterThanOrEqual(0);
      expect(budget.timeline[eventIndex]?.duration).toBe(event.seconds);
      expect(event.position === 'before' ? eventIndex + 1 : eventIndex - 1).toBe(anchorIndex);
    }
    let cursor = 0;
    for (const segment of budget.timeline) {
      expect(segment.start).toBe(cursor);
      expect(segment.duration).toBeGreaterThan(0);
      cursor += segment.duration;
      expect(segment.end).toBe(cursor);
    }
    expect(cursor).toBe(total);
    expect(budget.total).toBe(total);
    expect(budget.computed).toBe(total);
    expect(budget.budget_gap).toBe(0);
  });
  it('pairs every deep learning slot with one battle and preserves breaks after PvE', () => {
    const deep = MODE_BUDGETS.modes.deep;
    expect(deep.groups).toEqual(Array.from({ length: 12 }, (_, i) => [i + 1]));
    expect(deep.learning.every(seconds => seconds >= 120 && seconds <= 195)).toBe(true);
    expect(deep.rest_after_blocks).toEqual([4, 8]);
    expect(deep.timeline[0]).toMatchObject({ kind: 'entry', duration: 30 });
    expect(deep.timeline.at(-1)).toMatchObject({ kind: 'exit', duration: 30 });
    for (const round of deep.pve_rounds) {
      const loot = deep.timeline.findIndex(segment => segment.label.startsWith(`R${round} PVE补给选择`));
      expect(deep.timeline[loot + 1]).toMatchObject({ kind: 'rest', duration: 30 });
    }
  });
  it.each(modeCases)('$mode reaches exact earned gold share, XP, voucher and component budgets', ({ mode, startingGold, baseIncome, learningGold, earnedShare, arcCaps }) => {
    const game = createGame(mode, 2);
    const seat = game.seats[0]!;
    const budget = MODE_BUDGETS.modes[mode];
    expect(seat.initialGold).toBe(startingGold);
    expect(budget.economy.interest_cap).toBe(5);
    expect(budget.learning_gold_cap_by_block_cents).toEqual(arcCaps.flatMap(caps => [...caps]));
    expect(budget.learning_gold_total_max_cents).toBe(learningGold);
    for (let round = 1; round <= budget.rounds; round++) {
      const slot = budget.groups.findIndex(group => group[0] === round);
      if (slot !== -1) {
        const cents = seat.learningChargeCents + budget.learning_gold_cap_by_block_cents[slot]!;
        applyLearningGoldGrant(seat, Math.floor(cents / 100), cents % 100);
      }
      finishDrawRound(game);
      if (game.phase !== 'finished') beginNextRound(game);
      assertGameIntegrity(game);
    }
    const earned = (reason: string) => seat.goldLedger.filter(entry => entry.reason === reason).reduce((sum, entry) => sum + entry.amount, 0);
    const earnedLearning = earned('learning');
    const earnedBase = earned('base_income');
    expect(earnedBase).toBe(baseIncome);
    expect(earnedBase).toBe(budget.economy.base_income * (budget.rounds - 1));
    expect(earnedLearning * 100 + seat.learningChargeCents).toBe(learningGold);
    expect(Math.round(100 * earnedLearning / (earnedLearning + earnedBase))).toBe(earnedShare);
    const xpCosts = MODE_BUDGETS.xp_to_next as Record<string, number>;
    let xp = seat.xp;
    for (let level = budget.economy.starting_level; level < seat.level; level++) xp += xpCosts[level]!;
    expect(xp).toBe(budget.economy.free_xp * (budget.rounds - 1));
    expect(seat.vouchersGranted).toBe(budget.economy.equal_reroll_vouchers_total);
    expect(itemComponentShares(game)).toBe(budget.economy.ordinary_component_budget * 8);
    expect(finalPlacements(game.seats).map(x => x.place)).toEqual(Array(8).fill(1));
  });
  it('replays an identical legal command sequence to the exact same state hash',()=>{
    const a=createGame('quick',90210),b=createGame('quick',90210);
    for(let r=1;r<=6;r++) {
      for(let i=0;i<8;i++)for(const c of [{type:'BUY_CARD',shopIndex:0},{type:'BUY_XP'},{type:'REFRESH_SHOP'},{type:'TOGGLE_LOCK_SHOP'}] as const) {
        expect(applyGameCommand(a,a.seats[i]!.id,c)).toEqual(applyGameCommand(b,b.seats[i]!.id,c));expect(hashState(a)).toBe(hashState(b));
      }
      finishDrawRound(a);finishDrawRound(b);if(a.phase!=='finished'){beginNextRound(a);beginNextRound(b);}expect(hashState(a)).toBe(hashState(b));assertGameIntegrity(a);
    }
  });
});
