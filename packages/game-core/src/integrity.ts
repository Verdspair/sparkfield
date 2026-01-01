import { SEASON1_UNITS_BY_ID } from '@pkg/contracts';
import { assertGoldConservation, populationCap } from './economy.js';
import { assertPoolConservation } from './pool.js';
import { assertItemConservation } from './game.js';
import type { GameState } from './types.js';
export function assertGameIntegrity(game: GameState): void {
  assertPoolConservation(game); assertItemConservation(game);
  const instances = new Set<string>();
  for (const seat of game.seats) {
    assertGoldConservation(seat); const positions = new Set<string>();
    for (const u of seat.units) {
      if (!SEASON1_UNITS_BY_ID.has(u.unitId) || instances.has(u.instanceId)) throw new Error('Invalid unit instance');
      instances.add(u.instanceId);
      const key = u.location.zone === 'bench' ? 'b' + u.location.slot : u.location.row + ':' + u.location.col;
      if (positions.has(key)) throw new Error('Duplicate position: ' + seat.id + '/' + key); positions.add(key);
      if (u.location.zone === 'bench' && (u.location.slot < 0 || u.location.slot > 8)) throw new Error('Invalid bench slot');
      if (u.location.zone === 'board' && (u.location.row < 0 || u.location.row > 3 || u.location.col < 0 || u.location.col > 6)) throw new Error('Invalid deployment hex');
    }
    if (seat.units.filter(u => u.location.zone === 'board').length > populationCap(seat, game.mode)) throw new Error('Population overflow');
  }
}
