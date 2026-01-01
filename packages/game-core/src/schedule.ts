import { MODE_BUDGETS, type BattleOutcome, type DurationMode } from '@pkg/contracts';
export type RoundPair = readonly [string, string];
export function isPveRound(mode: DurationMode, round: number): boolean { return (MODE_BUDGETS.modes[mode].pve_rounds as number[]).includes(round); }
export function roundRobin(seatOrder: readonly string[]): RoundPair[][] {
  if (seatOrder.length !== 8 || new Set(seatOrder).size !== 8) throw new Error('Round robin needs eight unique seats');
  const ring = [...seatOrder]; const rounds: RoundPair[][] = [];
  for (let r = 0; r < 7; r++) {
    rounds.push(Array.from({ length: 4 }, (_, i) => [ring[i]!, ring[7 - i]!] as const));
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}
export function getRoundPairings(mode: DurationMode, round: number, seatOrder: readonly string[]): RoundPair[] {
  if (round < 1 || round > MODE_BUDGETS.modes[mode].rounds) throw new RangeError('Round out of range');
  if (isPveRound(mode, round)) return [];
  const base = roundRobin(seatOrder);
  if (mode === 'deep') {
    const index = ({ 1: 0, 2: 1, 3: 2, 5: 3, 6: 4, 7: 5, 9: 1, 10: 6, 11: 3, 12: 5 } as Record<number, number>)[round]!;
    return base[index]!;
  }
  const index = round - 1 - (mode === 'standard' && round > 4 ? 1 : 0);
  return base[index]!;
}
export function victoryPointsFor(mode: DurationMode, round: number, outcome: BattleOutcome): number {
  if (isPveRound(mode, round) || outcome === 'loss') return 0;
  const late = (MODE_BUDGETS.modes[mode].late_scoring_pvp_rounds as number[]).includes(round);
  return outcome === 'win' ? (late ? 10 : 8) : (late ? 5 : 4);
}
export function displayVictoryPoints(atoms: number): string { return (atoms / 4).toFixed(2); }
export function finalPlacements<T extends { id: string; victoryPoints: number }>(seats: readonly T[]): { seatId: string; place: number; victoryPoints: number }[] {
  return [...seats].sort((a, b) => b.victoryPoints - a.victoryPoints).map(s => ({ seatId: s.id, place: 1 + seats.filter(other => other.victoryPoints > s.victoryPoints).length, victoryPoints: s.victoryPoints }));
}
