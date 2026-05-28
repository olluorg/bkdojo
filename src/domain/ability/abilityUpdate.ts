import type { Difficulty } from '../models/common';
import { clamp } from '../util/math';

export const ABILITY_MIN = 1;
export const ABILITY_MAX = 5;

/** Spread of the logistic curve — larger = softer probability gradient. */
export const DEFAULT_SENSITIVITY = 1.2;

/** Learning rates: fast during placement, slower during steady daily practice. */
export const K_PLACEMENT = 0.8;
export const K_DAILY = 0.35;

/** Elo-style expected score: probability of success given ability vs difficulty. */
export function expectedScore(
  ability: number,
  difficulty: number,
  sensitivity: number = DEFAULT_SENSITIVITY,
): number {
  return 1 / (1 + Math.pow(10, (difficulty - ability) / sensitivity));
}

export interface AbilityUpdateInput {
  ability: number;
  difficulty: Difficulty;
  score: number; // 0..1
  k?: number;
  sensitivity?: number;
}

/**
 * Elo-like ability update. Correct answers on hard questions move ability a lot;
 * correct answers on easy ones barely move it — which is what lets a strong user
 * skip the basics quickly.
 */
export function updateAbility(input: AbilityUpdateInput): number {
  const {
    ability,
    difficulty,
    score,
    k = K_DAILY,
    sensitivity = DEFAULT_SENSITIVITY,
  } = input;
  const expected = expectedScore(ability, difficulty, sensitivity);
  const next = ability + k * (score - expected);
  return clamp(next, ABILITY_MIN, ABILITY_MAX);
}
