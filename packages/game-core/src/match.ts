import { MODE_BUDGETS } from '@pkg/contracts';
import { createSeat, settleRound, type SeatRoundOutcome } from './game.js';
import { finalizePrepDeadline } from './board-ops.js';
import { getRoundPairings, isPveRound } from './schedule.js';
import { randomInt } from './rng.js';
import { runCombat, type CombatResult } from './combat.js';
import type { GameState, SeatState } from './types.js';
export interface RoundBattle { leftSeatId: string; rightSeatId: string; result: CombatResult; pve: boolean }
export interface ResolvedRound { round: number; battles: RoundBattle[]; outcomes: SeatRoundOutcome[] }
function pveOpponent(game: GameState, seat: SeatState): SeatState {
  const npc = createSeat('pve-' + game.round + '-' + seat.id, game.mode);
  npc.units = ['S01', 'S06', 'S09'].map((unitId, i) => ({ instanceId: npc.id + '-' + i, unitId, star: game.round >= 8 ? 2 : 1, location: { zone: 'board', row: i === 2 ? 3 : 0, col: i + 2 }, items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0 }));
  return npc;
}
export function resolveRoundBattles(game: GameState): ResolvedRound {
  if (game.phase !== 'battle' || game.settledRounds.includes(game.round)) throw new Error('Round not awaiting battle');
  const battles: RoundBattle[] = []; const outcomes: SeatRoundOutcome[] = [];
  if (isPveRound(game.mode, game.round)) {
    for (const seat of game.seats) {
      const npc = pveOpponent(game, seat); const result = runCombat(seat, npc, game.mode, randomInt(game.rng, 4294967296));
      battles.push({ leftSeatId: seat.id, rightSeatId: npc.id, result, pve: true }); outcomes.push({ seatId: seat.id, outcome: result.outcome });
    }
  } else {
    for (const [leftId, rightId] of getRoundPairings(game.mode, game.round, game.seatOrder)) {
      const left = game.seats.find(s => s.id === leftId)!; const right = game.seats.find(s => s.id === rightId)!;
      const result = runCombat(left, right, game.mode, randomInt(game.rng, 4294967296));
      battles.push({ leftSeatId: leftId, rightSeatId: rightId, result, pve: false });
      outcomes.push({ seatId: leftId, outcome: result.outcome }, { seatId: rightId, outcome: result.outcome === 'win' ? 'loss' : result.outcome === 'loss' ? 'win' : 'draw' });
    }
  }
  return { round: game.round, battles, outcomes };
}
export function playRound(game: GameState): ResolvedRound {
  finalizePrepDeadline(game); const resolved = resolveRoundBattles(game); settleRound(game, resolved.outcomes); return resolved;
}
export function prepDeadlineSeconds(game: GameState): number { return MODE_BUDGETS.modes[game.mode].strategy; }
