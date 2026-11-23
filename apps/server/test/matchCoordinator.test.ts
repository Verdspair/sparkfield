import { describe, expect, it } from 'vitest';
import { botDifficultyForMatch } from '../src/rooms/matchCoordinator.js';

describe('online bot difficulty', () => {
  it.each([
    [null, null, 'novice'],
    [undefined, 0.99, 'novice'],
    [1199, 0.99, 'novice'],
    [1200, null, 'standard'],
    [1549, 0.99, 'standard'],
    [1550, 0.45, 'veteran'],
    [1700, null, 'veteran'],
    [1700, 0.44, 'novice'],
  ] as const)('maps standings %s and recent accuracy %s to %s', (score, accuracy, expected) => {
    expect(botDifficultyForMatch(score, accuracy)).toBe(expected);
  });
});
