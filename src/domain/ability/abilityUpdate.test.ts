import { describe, expect, test } from 'bun:test';
import {
  ABILITY_MAX,
  ABILITY_MIN,
  expectedScore,
  K_DAILY,
  updateAbility,
} from './abilityUpdate';

describe('expectedScore', () => {
  test('≈ 0.5 when ability equals difficulty', () => {
    expect(expectedScore(3, 3)).toBeCloseTo(0.5);
  });

  test('higher for easier questions', () => {
    expect(expectedScore(3, 1)).toBeGreaterThan(expectedScore(3, 5));
  });
});

describe('updateAbility', () => {
  test('correct raises, wrong lowers', () => {
    expect(updateAbility({ ability: 3, difficulty: 3, score: 1 })).toBeGreaterThan(3);
    expect(updateAbility({ ability: 3, difficulty: 3, score: 0 })).toBeLessThan(3);
  });

  test('a correct hard answer moves ability more than a correct easy one', () => {
    const gainEasy = updateAbility({ ability: 3, difficulty: 1, score: 1, k: K_DAILY }) - 3;
    const gainHard = updateAbility({ ability: 3, difficulty: 5, score: 1, k: K_DAILY }) - 3;
    expect(gainHard).toBeGreaterThan(gainEasy);
  });

  test('clamps to [min, max]', () => {
    expect(updateAbility({ ability: 5, difficulty: 5, score: 1, k: 2 })).toBe(ABILITY_MAX);
    expect(updateAbility({ ability: 1, difficulty: 1, score: 0, k: 2 })).toBe(ABILITY_MIN);
  });
});
