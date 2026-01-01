import {
  MODE_BUDGETS, SEASON1_AUGMENTS, SEASON1_TRAITS, SEASON1_UNITS_BY_ID,
  lookupCraftRecipe, lookupItemById, type GameCommand, type UnitLocation,
} from '@pkg/contracts';
import { applyGameCommand } from './game.js';
import { populationCap } from './economy.js';
import type { GameState, SeatState, UnitInstance } from './types.js';

export type BotDifficulty = 'novice' | 'standard' | 'veteran';
const traits = [...SEASON1_TRAITS.factions, ...SEASON1_TRAITS.roles];
const copies = (unit: UnitInstance) => 3 ** (unit.star - 1);
const available = (unit: UnitInstance) => unit.frozenUntilRound === null;
const clone = (game: GameState): GameState => structuredClone(game);

function traitCounts(units: readonly UnitInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of new Set(units.map((unit) => unit.unitId))) {
    const def = SEASON1_UNITS_BY_ID.get(id);
    if (!def) continue;
    for (const name of [def.faction, def.role]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const faction of SEASON1_TRAITS.factions) {
    if (units.some((unit) => unit.items.includes(faction.emblemId)
      && SEASON1_UNITS_BY_ID.get(unit.unitId)?.faction !== faction.name)) {
      counts.set(faction.name, (counts.get(faction.name) ?? 0) + 1);
    }
  }
  return counts;
}

function unitPower(unit: UnitInstance): number {
  const def = SEASON1_UNITS_BY_ID.get(unit.unitId);
  return (def?.cost ?? 1) * 2 + [0, 3, 13, 35][unit.star]! + unit.items.length * 2
    + unit.bonusHp / 150 + unit.bonusSkillEfficiency / 10;
}

function teamPower(units: readonly UnitInstance[], difficulty: BotDifficulty): number {
  let value = units.reduce((sum, unit) => sum + unitPower(unit), 0);
  if (difficulty === 'novice') return value;
  const counts = traitCounts(units);
  for (const trait of traits) {
    const count = counts.get(trait.name) ?? 0;
    value += trait.thresholds.filter((threshold) => count >= threshold).length * 7;
    if (count > 0) value += count * 0.5;
  }
  const frontline = units.filter((unit) => (SEASON1_UNITS_BY_ID.get(unit.unitId)?.stats.range ?? 4) <= 2).length;
  if (units.length >= 3 && frontline === 0) value -= 10;
  return value;
}

function bestTeam(seat: SeatState, mode: GameState['mode'], difficulty: BotDifficulty): UnitInstance[] {
  const candidates = seat.units.filter(available);
  const cap = populationCap(seat, mode);
  let selected: UnitInstance[] = [];
  while (selected.length < Math.min(cap, candidates.length)) {
    const next = candidates.filter((unit) => !selected.includes(unit)).sort((a, b) =>
      teamPower([...selected, b], difficulty) - teamPower([...selected, a], difficulty)
      || a.instanceId.localeCompare(b.instanceId))[0];
    if (!next) break;
    selected.push(next);
  }
  if (difficulty === 'veteran') {
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let index = 0; index < selected.length; index++) {
        for (const candidate of candidates.filter((unit) => !selected.includes(unit))) {
          const proposal = [...selected];
          proposal[index] = candidate;
          if (teamPower(proposal, difficulty) > teamPower(selected, difficulty) + 0.01) {
            selected = proposal;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
  }
  return selected;
}

function buyScore(game: GameState, seat: SeatState, unitId: string, difficulty: BotDifficulty): number {
  const def = SEASON1_UNITS_BY_ID.get(unitId);
  if (!def) return -Infinity;
  const same = seat.units.filter((unit) => unit.unitId === unitId && available(unit));
  const owned = same.reduce((sum, unit) => sum + copies(unit), 0);
  if (same.some((unit) => unit.star === 3)) return -Infinity;
  const board = bestTeam(seat, game.mode, difficulty);
  const counts = traitCounts(board);
  let score = def.cost + (owned % 3 === 2 ? 24 : owned > 0 ? 7 : 0);
  if (owned >= 6 && owned % 3 === 2) score += 14;
  if (seat.units.length < populationCap(seat, game.mode)) score += 10;
  if (difficulty !== 'novice') {
    for (const name of [def.faction, def.role]) {
      const count = counts.get(name) ?? 0;
      score += Math.min(4, count) * 1.5;
      if (!board.some((unit) => unit.unitId === unitId)
        && traits.find((trait) => trait.name === name)?.thresholds.includes(count + 1)) score += 6;
    }
    if (seat.inventoryItems.some((item) => def.recommendedItems.includes(item))) score += 3;
    let rivals = 0;
    let competingTraits = 0;
    for (const other of game.seats.filter((other) => other.id !== seat.id)) {
      const publicBoard = other.units.filter((unit) => unit.location.zone === 'board');
      rivals += publicBoard.filter((unit) => unit.unitId === unitId).reduce((sum, unit) => sum + copies(unit), 0);
      if ((traitCounts(publicBoard).get(def.faction) ?? 0) >= 2) competingTraits++;
    }
    const scouting = difficulty === 'veteran' ? 1 : 0.5;
    score -= scouting * (rivals * 1.8 + competingTraits * 2);
    score -= scouting * (1 - (game.pool[unitId] ?? 0) / def.poolCopies) * 5;
  }
  if (board.length >= populationCap(seat, game.mode) && owned === 0) {
    const weakest = Math.min(...board.map(unitPower));
    score += Math.max(-8, def.cost * 2 + 3 - weakest);
  }
  return score;
}

function itemFit(unit: UnitInstance, itemId: string): number {
  const def = SEASON1_UNITS_BY_ID.get(unit.unitId);
  if (!def) return 0;
  return (def.recommendedItems.includes(itemId) ? 20 : 0) + unitPower(unit) / 5;
}

export function decideBotPrepCommands(
  game: GameState, seatId: string, difficulty?: BotDifficulty,
): GameCommand[] {
  if (game.phase !== 'prep' || !game.seats.some((seat) => seat.id === seatId)) return [];
  let simulation = clone(game);
  const current = () => simulation.seats.find((seat) => seat.id === seatId)!;
  const skill = difficulty ?? current().botDifficulty;
  const commands: GameCommand[] = [];
  const emit = (command: GameCommand): boolean => {
    if (commands.length >= 160) return false;
    const trial = clone(simulation);
    if (!applyGameCommand(trial, seatId, command).ok) return false;
    simulation = trial;
    commands.push(command);
    return true;
  };
  const budget = MODE_BUDGETS.modes[game.mode];
  const final = game.round >= budget.rounds;
  const reserve = final ? 0 : skill === 'novice' ? 2 : skill === 'standard' ? 8
    : Math.min(budget.economy.interest_cap * 10, Math.max(8, current().gold - 12));

  if (current().augmentOffer) {
    const counts = traitCounts(current().units.filter((unit) => unit.location.zone === 'board'));
    const options = current().augmentOffer!.options;
    const ranked = options.map((id, slotIndex) => {
      const augment = SEASON1_AUGMENTS.find((entry) => entry.id === id);
      const fit = augment?.tailorTraits.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0) ?? 0;
      return { slotIndex, score: skill === 'novice' ? -slotIndex : fit * 4
        + (augment?.category === 'combat' ? 3 : 0) - (final && augment?.category === 'economy' ? 10 : 0) };
    }).sort((a, b) => b.score - a.score || a.slotIndex - b.slotIndex);
    if (ranked[0]) emit({ type: 'PICK_AUGMENT', slotIndex: ranked[0].slotIndex });
  }
  for (const anvil of [...current().anvils]) {
    const ranked = anvil.options.map((id, optionIndex) => ({ optionIndex,
      score: Math.max(0, ...current().units.map((unit) => itemFit(unit, id))) })).sort((a, b) => b.score - a.score || a.optionIndex - b.optionIndex);
    if (ranked[0]) emit({ type: 'PICK_ANVIL_OPTION', anvilInstanceId: anvil.instanceId, optionIndex: ranked[0].optionIndex });
  }

  const buyFromShop = () => {
    for (let purchase = 0; purchase < 16; purchase++) {
      const ranked = current().shop.flatMap((id, shopIndex) => id === null ? [] : [{ id, shopIndex,
        score: buyScore(simulation, current(), id, skill) }])
        .sort((a, b) => b.score - a.score || a.shopIndex - b.shopIndex);
      let bought = false;
      for (const option of ranked) {
        const def = SEASON1_UNITS_BY_ID.get(option.id)!;
        const completesPair = current().units.filter((unit) => unit.unitId === option.id && unit.star === 1 && available(unit)).length >= 2;
        const floor = completesPair || current().units.length < current().level ? 0 : reserve;
        if (option.score < (skill === 'novice' ? 3 : 5) || current().gold - def.cost < floor) continue;
        if (emit({ type: 'BUY_CARD', shopIndex: option.shopIndex })) { bought = true; break; }
      }
      if (!bought) break;
    }
  };
  buyFromShop();

  const seat = current();
  const xpNeeded = (MODE_BUDGETS.xp_to_next as Record<string, number>)[String(seat.level)];
  const xpPerBuy = seat.chosenAugments.includes('AUG_P02') ? 6 : 4;
  const xpBuys = Math.ceil(Math.max(0, (xpNeeded ?? Infinity) - seat.xp) / xpPerBuy);
  const targetLevel = Math.min(budget.economy.base_level_cap,
    budget.economy.starting_level + Math.floor(game.round / (skill === 'novice' ? 3 : 2)) + 1);
  if (seat.level < targetLevel && seat.units.filter(available).length > populationCap(seat, game.mode)
    && xpBuys <= 12 && seat.gold >= xpBuys * 4 + reserve) {
    for (let step = 0; step < xpBuys; step++) if (!emit({ type: 'BUY_XP' })) break;
    buyFromShop();
  }

  const rollLimit = skill === 'novice' ? 1 : skill === 'standard' ? 3 : 6;
  for (let roll = 0; roll < rollLimit; roll++) {
    const hasPair = current().units.some((unit) => available(unit) && unit.star === 1
      && current().units.filter((other) => available(other) && other.unitId === unit.unitId && other.star === 1).length >= 2);
    const free = current().rerollVouchers > 0;
    if (!free && (!hasPair && !final || current().gold < reserve + 4)) break;
    if (!emit({ type: 'REFRESH_SHOP' })) break;
    buyFromShop();
  }

  if (skill !== 'novice' && current().units.filter((unit) => unit.location.zone === 'bench').length >= 8) {
    const selected = new Set(bestTeam(current(), game.mode, skill).map((unit) => unit.instanceId));
    for (const unit of [...current().units]) {
      if (unit.location.zone !== 'bench' || !available(unit) || unit.star !== 1 || unit.items.length
        || selected.has(unit.instanceId)) continue;
      const same = current().units.filter((other) => other.unitId === unit.unitId);
      if (same.length === 1 && !current().lineupPlan.includes(unit.unitId)) {
        emit({ type: 'SELL_UNIT', instanceId: unit.instanceId });
        break;
      }
    }
  }

  const deployBestTeam = () => {
    const selectedIds = bestTeam(current(), game.mode, skill).map((unit) => unit.instanceId);
    for (const instanceId of selectedIds) {
      const unit = current().units.find((entry) => entry.instanceId === instanceId)!;
      if (unit.location.zone === 'board') continue;
      const unwanted = current().units.find((entry) => entry.location.zone === 'board' && !selectedIds.includes(entry.instanceId));
      if (unwanted) emit({ type: 'MOVE_UNIT', instanceId, to: unwanted.location });
      else {
        const occupied = new Set(current().units.flatMap((entry) => entry.location.zone === 'board' ? [`${entry.location.row}:${entry.location.col}`] : []));
        let to: UnitLocation | undefined;
        for (let row = 0; row < 4 && !to; row++) for (const col of [3, 2, 4, 1, 5, 0, 6]) {
          if (!occupied.has(`${row}:${col}`)) { to = { zone: 'board', row, col }; break; }
        }
        if (to) emit({ type: 'MOVE_UNIT', instanceId, to });
      }
    }
  };
  deployBestTeam();
  for (let pass = 0; pass < 24; pass++) {
    let best: { score: number; commands: GameCommand[] } | undefined;
    const inventory = current().inventoryItems;
    for (const unit of current().units.filter((unit) => unit.location.zone === 'board')) {
      for (let i = 0; i < inventory.length; i++) {
        const first = inventory[i]!;
        const existing = unit.items.find((id) => lookupCraftRecipe(id, first));
        const directRecipe = existing ? lookupCraftRecipe(existing, first) : null;
        const direct = lookupItemById(first);
        const proposals: { itemId: string; indexes: number[] }[] = [];
        if (directRecipe) proposals.push({ itemId: directRecipe.id, indexes: [i] });
        else if (direct && !['component', 'spatula'].includes(direct.kind)) proposals.push({ itemId: first, indexes: [i] });
        if (!existing) for (let j = i + 1; j < inventory.length; j++) {
          const recipe = lookupCraftRecipe(first, inventory[j]!);
          if (recipe) proposals.push({ itemId: recipe.id, indexes: [i, j - 1] });
        }
        for (const proposal of proposals) {
          const sequence: GameCommand[] = proposal.indexes.map((inventoryItemIndex) => ({ type: 'EQUIP_ITEM', inventoryItemIndex, targetInstanceId: unit.instanceId }));
          const trial = clone(simulation);
          if (!sequence.every((command) => applyGameCommand(trial, seatId, command).ok)) continue;
          const score = itemFit(unit, proposal.itemId) + (proposal.itemId === 'I_MOTHERSHIP_FLAG' ? 25 : 0);
          if (!best || score > best.score) best = { score, commands: sequence };
        }
      }
    }
    if (!best) break;
    for (const command of best.commands) emit(command);
  }
  for (let pass = 0; pass < 12 && current().inventoryItems.length; pass++) {
    const targets = current().units.filter((unit) => unit.location.zone === 'board')
      .sort((a, b) => unitPower(b) - unitPower(a) || a.instanceId.localeCompare(b.instanceId));
    let equipped = false;
    for (let i = 0; i < current().inventoryItems.length && !equipped; i++) for (const unit of targets) {
      if (emit({ type: 'EQUIP_ITEM', inventoryItemIndex: i, targetInstanceId: unit.instanceId })) { equipped = true; break; }
    }
    if (!equipped) break;
  }

  deployBestTeam();

  const threats = Array<number>(7).fill(0);
  if (skill === 'veteran') for (const other of simulation.seats.filter((seat) => seat.id !== seatId)) {
    for (const unit of other.units) if (unit.location.zone === 'board') {
      const col = 6 - unit.location.col;
      threats[col] = (threats[col] ?? 0) + unitPower(unit);
    }
  }
  const columns = [3, 2, 4, 1, 5, 0, 6];
  const backColumns = [...columns].sort((a, b) => (threats[a] ?? 0) - (threats[b] ?? 0));
  const frontColumns = [...columns].sort((a, b) => (threats[b] ?? 0) - (threats[a] ?? 0));
  const used = new Set<string>();
  const board = current().units.filter((unit) => unit.location.zone === 'board')
    .sort((a, b) => unitPower(b) - unitPower(a) || a.instanceId.localeCompare(b.instanceId));
  for (const unit of board) {
    const ranged = (SEASON1_UNITS_BY_ID.get(unit.unitId)?.stats.range ?? 1) >= 3;
    const rows = ranged ? [3, 2, 1, 0] : [skill === 'novice' ? 1 : 0, skill === 'novice' ? 0 : 1, 2, 3];
    let to: UnitLocation | undefined;
    for (const row of rows) {
      for (const col of ranged ? backColumns : frontColumns) if (!used.has(`${row}:${col}`)) {
        to = { zone: 'board', row, col };
        used.add(`${row}:${col}`);
        break;
      }
      if (to) break;
    }
    const latest = current().units.find((entry) => entry.instanceId === unit.instanceId)!;
    if (to?.zone === 'board' && (latest.location.zone !== 'board' || latest.location.row !== to.row || latest.location.col !== to.col)) {
      emit({ type: 'MOVE_UNIT', instanceId: unit.instanceId, to });
    }
  }
  return commands;
}
