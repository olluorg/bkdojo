import type { Difficulty } from '../models/common';
import type { Question } from '../models/question';
import { clamp } from '../util/math';

/** "Desirable difficulty": aim slightly above current ability to keep challenge. */
export const DESIRABLE_OFFSET = 0.5;

export function targetDifficulty(ability: number, offset: number = DESIRABLE_OFFSET): Difficulty {
  return clamp(Math.round(ability + offset), 1, 5) as Difficulty;
}

export interface PickOptions {
  excludeIds?: Set<string>;
  rng?: () => number;
}

/**
 * Picks one question whose difficulty is closest to `target`, excluding given ids.
 * Ties (same distance to target) are broken randomly via `rng`.
 */
export function pickByDifficulty(
  pool: Question[],
  target: Difficulty,
  options: PickOptions = {},
): Question | undefined {
  const exclude = options.excludeIds ?? new Set<string>();
  const rng = options.rng ?? Math.random;

  const available = pool.filter((q) => !exclude.has(q.id));
  if (available.length === 0) return undefined;

  let nearest = Infinity;
  for (const q of available) {
    const distance = Math.abs(q.difficulty - target);
    if (distance < nearest) nearest = distance;
  }
  const tier = available.filter((q) => Math.abs(q.difficulty - target) === nearest);
  const idx = Math.min(tier.length - 1, Math.floor(rng() * tier.length));
  return tier[idx];
}
