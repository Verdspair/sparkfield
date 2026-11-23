import { describe, expect, it } from 'vitest';
import { SEASON1_UNITS_BY_ID, type DurationMode, type GameCommand, type UnitLocation } from '@pkg/contracts';
import { decideBotPrepCommands, type BotDifficulty } from '../src/bot.js';
import { createOnboardingMicroScenario } from '../src/onboarding.js';
import { applyGameCommand, assertItemConservation, beginNextRound, createGame, settleRound } from '../src/game.js';
import { finalizePrepDeadline } from '../src/board-ops.js';
import { createCombat, runCombat } from '../src/combat.js';
import { assertGoldConservation, populationCap } from '../src/economy.js';
import { assertPoolConservation, poolAccounting, releaseShop, returnToPool, starCopies, takeFromPool } from '../src/pool.js';
import { itemComponentValue } from '../src/items.js';
import type { GameState, SeatState, UnitInstance } from '../src/types.js';

function replay(game: GameState, seatId: string, commands: GameCommand[]): void {
  for (const command of commands) {
    expect(applyGameCommand(game, seatId, command), JSON.stringify(command)).toEqual({ ok: true });
    assertPoolConservation(game);
    for (const seat of game.seats) assertGoldConservation(seat);
  }
}
function emptySeat(game: GameState, seat: SeatState): void {
  releaseShop(game, seat);
  for (const unit of seat.units) returnToPool(game.pool, unit.unitId, starCopies(unit.star));
  seat.units = [];
}
function addUnit(game: GameState, seat: SeatState, unitId: string, location: UnitLocation, star: UnitInstance['star'] = 1): UnitInstance {
  expect(takeFromPool(game.pool, unitId, starCopies(star))).toBe(true);
  const unit: UnitInstance = { instanceId: `fixture-${game.nextInstanceId++}`, unitId, star, location,
    items: [], cryoRounds: 0, frozenUntilRound: null, bonusHp: 0, bonusSkillEfficiency: 0 };
  seat.units.push(unit);
  return unit;
}
function setShop(game: GameState, seat: SeatState, ids: (string | null)[]): void {
  releaseShop(game, seat);
  for (const id of ids) if (id) expect(takeFromPool(game.pool, id)).toBe(true);
  seat.shop = ids;
}
function setGold(seat: SeatState, gold: number): void {
  seat.gold = gold;
  seat.initialGold = gold;
  seat.goldLedger = [];
}

const modes: DurationMode[] = ['quick', 'standard', 'deep'];
const difficulties: BotDifficulty[] = ['novice', 'standard', 'veteran'];
describe('procedural prep bots', () => {
  for (const mode of modes) for (const difficulty of difficulties) {
    it(`${mode}/${difficulty}: pure, deterministic, bounded and sequentially executable`, () => {
      const game = createGame(mode, 1729);
      const snapshot = structuredClone(game);
      const seat = game.seats[0]!;
      const commands = decideBotPrepCommands(game, seat.id, difficulty);
      expect(game).toEqual(snapshot);
      expect(decideBotPrepCommands(game, seat.id, difficulty)).toEqual(commands);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.length).toBeLessThanOrEqual(160);
      replay(game, seat.id, commands);
      const board = seat.units.filter((unit) => unit.location.zone === 'board');
      expect(board.length).toBeLessThanOrEqual(populationCap(seat, mode));
      expect(new Set(board.map((unit) => unit.location.zone === 'board' ? `${unit.location.row}:${unit.location.col}` : '')).size).toBe(board.length);
    });
  }

  for (const mode of modes) it(`${mode}: all eight bots can finish the whole schedule with conservation`, () => {
    const game = createGame(mode, 9821);
    while (game.phase !== 'finished') {
      for (const [index, seat] of game.seats.entries()) {
        const commands = decideBotPrepCommands(game, seat.id, difficulties[index % 3]);
        replay(game, seat.id, commands);
        assertItemConservation(game);
      }
      finalizePrepDeadline(game);
      settleRound(game, game.seats.map((seat) => ({ seatId: seat.id, outcome: 'draw' as const })));
      assertItemConservation(game);
      if ((game.phase as GameState['phase']) !== 'finished') beginNextRound(game);
    }
    assertPoolConservation(game);
    for (const seat of game.seats) assertGoldConservation(seat);
  });

  it('returns no commands for a missing seat or outside preparation', () => {
    const game = createGame('quick', 1);
    expect(decideBotPrepCommands(game, 'missing')).toEqual([]);
    game.phase = 'battle';
    expect(decideBotPrepCommands(game, game.seats[0]!.id)).toEqual([]);
    game.phase = 'finished';
    expect(decideBotPrepCommands(game, game.seats[0]!.id)).toEqual([]);
  });

  it('buys a third copy, crafts a recommended item and deploys the stronger board', () => {
    const scenario = createOnboardingMicroScenario();
    const commands = decideBotPrepCommands(scenario.game, scenario.playerSeatId, 'veteran');
    expect(commands.some((command) => command.type === 'BUY_CARD' && command.shopIndex === 2)).toBe(true);
    expect(commands.filter((command) => command.type === 'EQUIP_ITEM').length).toBeGreaterThanOrEqual(2);
    replay(scenario.game, scenario.playerSeatId, commands);
    const seat = scenario.game.seats.find((entry) => entry.id === scenario.playerSeatId)!;
    expect(seat.units.some((unit) => unit.unitId === 'S01' && unit.star === 2 && unit.location.zone === 'board')).toBe(true);
    expect(seat.units.some((unit) => unit.items.includes('I_LORENTZ_RAIL'))).toBe(true);
  });

  it('veteran scouts public competition and low remaining copies instead of following a fixed script', () => {
    const game = createGame('quick', 19);
    for (const seat of game.seats) emptySeat(game, seat);
    const player = game.seats[0]!;
    addUnit(game, player, 'S01', { zone: 'board', row: 0, col: 3 });
    setGold(player, 1);
    player.inventoryItems = [];
    setShop(game, player, ['S04', 'S09', null, null, null]);
    for (const rival of game.seats.slice(1, 4)) {
      addUnit(game, rival, 'S04', { zone: 'board', row: 3, col: 3 }, 2);
      addUnit(game, rival, 'S05', { zone: 'board', row: 3, col: 4 });
    }
    const novice = decideBotPrepCommands(game, player.id, 'novice').find((command) => command.type === 'BUY_CARD');
    const veteran = decideBotPrepCommands(game, player.id, 'veteran').find((command) => command.type === 'BUY_CARD');
    expect(novice).toEqual({ type: 'BUY_CARD', shopIndex: 0 });
    expect(veteran).toEqual({ type: 'BUY_CARD', shopIndex: 1 });
    replay(game, player.id, decideBotPrepCommands(game, player.id, 'veteran'));
  });

  it('buys enough XP to unlock an extra available fighter', () => {
    const game = createGame('quick', 3);
    const player = game.seats[0]!;
    emptySeat(game, player);
    setGold(player, 100);
    for (let i = 0; i < 5; i++) addUnit(game, player, `S0${i + 1}`, { zone: 'bench', slot: i });
    const commands = decideBotPrepCommands(game, player.id, 'standard');
    expect(commands.filter((command) => command.type === 'BUY_XP')).toHaveLength(2);
    replay(game, player.id, commands);
    expect(player.level).toBe(5);
    expect(player.units.filter((unit) => unit.location.zone === 'board')).toHaveLength(5);
  });

  it('crafts the population flag and fills its new slot before the prep deadline', () => {
    const game = createGame('quick', 23);
    const player = game.seats[0]!;
    emptySeat(game, player);
    setGold(player, 0);
    player.inventoryItems = ['C_RUBBING', 'C_RUBBING'];
    player.anvils = [];
    for (let i = 0; i < 5; i++) addUnit(game, player, `S0${i + 1}`, { zone: 'bench', slot: i });
    replay(game, player.id, decideBotPrepCommands(game, player.id, 'standard'));
    expect(player.units.some((unit) => unit.items.includes('I_MOTHERSHIP_FLAG'))).toBe(true);
    expect(populationCap(player, 'quick')).toBe(5);
    expect(player.units.filter((unit) => unit.location.zone === 'board')).toHaveLength(5);
  });

  it('uses an expiring free reroll without gold and does not invent money', () => {
    const game = createGame('deep', 7);
    const player = game.seats[0]!;
    releaseShop(game, player);
    setGold(player, 0);
    player.rerollVouchers = 1;
    player.voucherRound = game.round;
    const commands = decideBotPrepCommands(game, player.id, 'standard');
    expect(commands.filter((command) => command.type === 'REFRESH_SHOP')).toHaveLength(1);
    replay(game, player.id, commands);
    expect(player.gold).toBe(0);
    expect(player.rerollVouchers).toBe(0);
  });

  it('skips frozen reserves and gives ranged units back-row positions', () => {
    const game = createGame('quick', 31);
    const player = game.seats[0]!;
    emptySeat(game, player);
    setGold(player, 0);
    const frozen = addUnit(game, player, 'S03', { zone: 'bench', slot: 8 });
    frozen.frozenUntilRound = game.round + 1;
    addUnit(game, player, 'S01', { zone: 'bench', slot: 0 });
    addUnit(game, player, 'S09', { zone: 'bench', slot: 1 });
    replay(game, player.id, decideBotPrepCommands(game, player.id, 'veteran'));
    expect(frozen.location).toEqual({ zone: 'bench', slot: 8 });
    for (const unit of player.units.filter((unit) => unit.location.zone === 'board')) {
      if (unit.location.zone !== 'board') continue;
      const range = SEASON1_UNITS_BY_ID.get(unit.unitId)!.stats.range;
      expect(unit.location.row).toBe(range >= 3 ? 3 : 0);
    }
  });
});

describe('90-second onboarding uses the real engine', () => {
  it('has a fixed seed, exact stage budget, eight real seats and 748 conserved shares', () => {
    const scenario = createOnboardingMicroScenario();
    expect(scenario).toEqual(createOnboardingMicroScenario());
    expect(scenario.durationSeconds).toBe(90);
    expect(scenario.stages.map((stage) => stage.durationSeconds)).toEqual([5, 10, 50, 20, 5]);
    expect(scenario.stages.map((stage) => stage.startSeconds)).toEqual([0, 5, 15, 65, 85]);
    expect(scenario.stages.reduce((sum, stage) => sum + stage.durationSeconds, 0)).toBe(90);
    expect(scenario.game.mode).toBe('quick');
    expect(scenario.game.phase).toBe('prep');
    expect(scenario.game.seats).toHaveLength(8);
    expect(scenario.persistence).toBe('none');
    assertPoolConservation(scenario.game);
    expect(Object.values(poolAccounting(scenario.game)).reduce((a, b) => a + b, 0)).toBe(748);
    const value = scenario.game.seats.reduce((sum, seat) => sum
      + [...seat.inventoryItems, ...seat.units.flatMap((unit) => unit.items)].reduce((n, item) => n + itemComponentValue(item), 0)
      + seat.anvils.reduce((n, anvil) => n + (anvil.kind === 'component' ? 1 : 2), 0), 0);
    expect(value).toBe(scenario.game.itemComponentsGranted);
  });

  it('runs deterministic real quick combat with a 45s hard limit and an isolated snapshot', () => {
    const { game, playerSeatId, enemySeatId, hints } = createOnboardingMicroScenario();
    replay(game, playerSeatId, [
      { type: 'BUY_CARD', shopIndex: hints.buyShopIndex },
      { type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: hints.carryInstanceId },
      { type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: hints.carryInstanceId },
    ]);
    finalizePrepDeadline(game);
    const player = game.seats.find((seat) => seat.id === playerSeatId)!;
    const enemy = game.seats.find((seat) => seat.id === enemySeatId)!;
    const snapshot = structuredClone(game);
    const combat = createCombat(player, enemy, game.mode, 90);
    expect(combat.hardDeadlineMs).toBe(45_000);
    expect(combat.overtimeAtMs).toBe(30_000);
    const result = runCombat(player, enemy, game.mode, 90);
    expect(result).toEqual(runCombat(player, enemy, game.mode, 90));
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeLessThanOrEqual(45_000);
    expect(result.telemetry.length).toBeGreaterThan(0);
    expect(result.telemetry.some((entry) => entry.physicalDealt + entry.magicDealt > 0)).toBe(true);
    expect(game).toEqual(snapshot);
    expect(game.seats.every((seat) => seat.victoryPoints === 0)).toBe(true);
    assertPoolConservation(game);
    assertItemConservation(game);
  });

  it('real purchase merges the third shop card, keeps the board body, crafts and swaps', () => {
    const scenario = createOnboardingMicroScenario();
    const { game, playerSeatId, hints } = scenario;
    const player = game.seats.find((seat) => seat.id === playerSeatId)!;
    expect(player.shop[2]).toBe(hints.pairUnitId);
    replay(game, playerSeatId, [
      { type: 'BUY_CARD', shopIndex: hints.buyShopIndex },
      { type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: hints.carryInstanceId },
      { type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: hints.carryInstanceId },
    ]);
    const upgraded = player.units.find((unit) => unit.unitId === hints.pairUnitId)!;
    expect(upgraded.instanceId).toBe(hints.pairInstanceIds[0]);
    expect(upgraded.star).toBe(2);
    const carry = player.units.find((unit) => unit.instanceId === hints.carryInstanceId)!;
    expect(carry.items).toEqual([hints.craftedItemId]);
    const beforeCarry = structuredClone(carry.location);
    const beforeTank = structuredClone(upgraded.location);
    replay(game, playerSeatId, [{ type: 'MOVE_UNIT', instanceId: carry.instanceId, to: beforeTank }]);
    expect(carry.location).toEqual(beforeTank);
    expect(upgraded.location).toEqual(beforeCarry);
    replay(game, playerSeatId, [{ type: 'MOVE_UNIT', instanceId: carry.instanceId, to: beforeCarry }]);
    finalizePrepDeadline(game);
    expect(player.units.filter((unit) => unit.location.zone === 'board').length).toBeLessThanOrEqual(populationCap(player, 'quick'));
    assertPoolConservation(game);
  });
});
