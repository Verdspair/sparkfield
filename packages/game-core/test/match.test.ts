import { describe, expect, it } from 'vitest';
import { MODE_BUDGETS, type DurationMode } from '@pkg/contracts';
import { createGame, applyGameCommand, beginNextRound } from '../src/game.js';
import { decideBotPrepCommands } from '../src/bot.js';
import { playRound } from '../src/match.js';
import { finalizePrepDeadline } from '../src/board-ops.js';
import { assertGameIntegrity } from '../src/integrity.js';
import { finalPlacements } from '../src/schedule.js';
import { hashState, cloneState } from '../src/rng.js';
import type { GameState } from '../src/types.js';
describe('whole room authoritative matches',()=>{
  it.each(['quick','standard','deep'] as DurationMode[])('%s: eight mixed-strength bots run every real combat to a legal final table',mode=>{
    const game=createGame(mode,350); let battleCount=0;
    while(game.phase!=='finished'){
      for(const [i,seat] of game.seats.entries()){
        seat.isBot=i!==0;seat.botDifficulty=(['novice','standard','veteran'] as const)[i%3]!;
        for(const command of decideBotPrepCommands(game,seat.id,seat.botDifficulty)) expect(applyGameCommand(game,seat.id,command)).toEqual({ok:true});
      }
      assertGameIntegrity(game); finalizePrepDeadline(game); const prep=game.seats.map(s=>cloneState(s.units));
      const played=playRound(game);battleCount+=played.battles.length;
      expect(played.outcomes).toHaveLength(8);
      for(const b of played.battles) {expect(b.result.elapsedMs).toBeLessThanOrEqual(MODE_BUDGETS.modes[mode].combat*1000);for(const t of b.result.telemetry)expect(t.damageTaken).toBeGreaterThanOrEqual(0);}
      expect(game.seats.map(s=>s.units)).toEqual(prep);
      assertGameIntegrity(game);if((game.phase as GameState['phase'])!=='finished')beginNextRound(game);
    }
    expect(game.settledRounds).toHaveLength(MODE_BUDGETS.modes[mode].rounds);
    expect(battleCount).toBe((MODE_BUDGETS.modes[mode].rounds-MODE_BUDGETS.modes[mode].pve_rounds.length)*4+MODE_BUDGETS.modes[mode].pve_rounds.length*8);
    const places=finalPlacements(game.seats);expect(places).toHaveLength(8);
    for(const row of places) expect(row.place).toBe(1+game.seats.filter(s=>s.victoryPoints>row.victoryPoints).length);
  },60_000);
  it('a real seeded room combat has deterministic replay and all-eight final ties remain legal',()=>{
    const a=createGame('quick',921),b=createGame('quick',921);
    for(let r=1;r<=6;r++){
      const ra=playRound(a),rb=playRound(b);expect(ra).toEqual(rb);expect(hashState(a)).toBe(hashState(b));
      if((a.phase as GameState['phase'])!=='finished'){beginNextRound(a);beginNextRound(b);}
    }
    const tied=finalPlacements(a.seats.map(s=>({...s,victoryPoints:12})));expect(tied.map(s=>s.place)).toEqual(Array(8).fill(1));
  },60_000);
});
