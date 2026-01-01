import type { UnitLocation } from '@pkg/contracts';
import { createGame } from './game.js';
import { itemComponentValue } from './items.js';
import { releaseShop, returnToPool, starCopies, takeFromPool } from './pool.js';
import type { GameState, SeatState, UnitInstance } from './types.js';

export const ONBOARDING_SEED = 900120;
export interface OnboardingStage {
  id: 'goal' | 'sample' | 'prep' | 'battle' | 'summary';
  durationSeconds: number;
  startSeconds: number;
}
export interface OnboardingMicroScenario {
  game: GameState;
  playerSeatId: string;
  enemySeatId: string;
  durationSeconds: 90;
  battleDurationSeconds: 20;
  stages: OnboardingStage[];
  hints: {
    pairUnitId: string;
    buyShopIndex: number;
    carryInstanceId: string;
    pairInstanceIds: string[];
    craftComponents: [string, string];
    craftedItemId: string;
  };
  persistence: 'none';
}

function itemValue(seat: SeatState): number {
  return [...seat.inventoryItems, ...seat.units.flatMap((unit) => unit.items)]
    .reduce((sum, id) => sum + itemComponentValue(id), 0)
    + seat.anvils.reduce((sum, anvil) => sum + (anvil.kind === 'component' ? 1 : 2), 0);
}

export function createOnboardingMicroScenario(): OnboardingMicroScenario {
  const game = createGame('quick', ONBOARDING_SEED);
  const player = game.seats[0]!;
  const enemy = game.seats[1]!;
  const changed = [player, enemy];
  const oldItemValue = changed.reduce((sum, seat) => sum + itemValue(seat), 0);
  for (const seat of changed) {
    releaseShop(game, seat);
    for (const unit of seat.units) returnToPool(game.pool, unit.unitId, starCopies(unit.star));
    seat.units = [];
    seat.inventoryItems = [];
    seat.anvils = [];
    seat.shopLocked = false;
    seat.augmentOffer = null;
    seat.pendingCommands = [];
  }
  player.isBot = false;
  enemy.isBot = true;
  enemy.botDifficulty = 'novice';

  const place = (seat: SeatState, unitId: string, location: UnitLocation): UnitInstance => {
    if (!takeFromPool(game.pool, unitId)) throw new Error(`Tutorial unit pool exhausted: ${unitId}`);
    const unit: UnitInstance = {
      instanceId: `tutorial-${game.nextInstanceId++}`, unitId, star: 1, location,
      items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0,
    };
    seat.units.push(unit);
    return unit;
  };
  const pairOnBoard = place(player, 'S01', { zone: 'board', row: 0, col: 3 });
  const pairOnBench = place(player, 'S01', { zone: 'bench', slot: 0 });
  const carry = place(player, 'S09', { zone: 'board', row: 3, col: 3 });
  place(player, 'S02', { zone: 'board', row: 3, col: 4 });
  place(enemy, 'S06', { zone: 'board', row: 0, col: 3 });
  place(enemy, 'S08', { zone: 'board', row: 0, col: 2 });
  place(enemy, 'S04', { zone: 'board', row: 3, col: 3 });

  for (const unitId of ['S02', 'S09', 'S01', 'S04', 'S06']) {
    if (!takeFromPool(game.pool, unitId)) throw new Error(`Tutorial shop pool exhausted: ${unitId}`);
  }
  player.shop = ['S02', 'S09', 'S01', 'S04', 'S06'];
  player.inventoryItems = ['C_SWORD', 'C_BOW'];
  game.itemComponentsGranted += changed.reduce((sum, seat) => sum + itemValue(seat), 0) - oldItemValue;

  const durations = [5, 10, 50, 20, 5];
  const ids: OnboardingStage['id'][] = ['goal', 'sample', 'prep', 'battle', 'summary'];
  let startSeconds = 0;
  const stages = ids.map((id, index) => {
    const durationSeconds = durations[index]!;
    const stage = { id, durationSeconds, startSeconds };
    startSeconds += durationSeconds;
    return stage;
  });
  return {
    game, playerSeatId: player.id, enemySeatId: enemy.id,
    durationSeconds: 90, battleDurationSeconds: 20, stages, persistence: 'none',
    hints: {
      pairUnitId: 'S01', buyShopIndex: 2, carryInstanceId: carry.instanceId,
      pairInstanceIds: [pairOnBoard.instanceId, pairOnBench.instanceId],
      craftComponents: ['C_SWORD', 'C_BOW'], craftedItemId: 'I_LORENTZ_RAIL',
    },
  };
}
