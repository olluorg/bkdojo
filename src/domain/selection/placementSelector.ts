import type { ContentIndex } from '../content/contentIndex';
import { getByDomain } from '../content/contentIndex';
import { DOMAINS } from '../models/common';
import { isChoiceQuestion, type Question } from '../models/question';
import type { Session, SessionItem } from '../models/session';

export interface PlacementOptions {
  perDomain?: number;
  /** When true, only choice questions are used — fully AI-independent placement. */
  choiceOnly?: boolean;
}

/** Picks `count` items spread evenly across the difficulty range (deterministic). */
function pickSpread<T extends Question>(pool: T[], count: number): T[] {
  if (count <= 0) return [];
  if (pool.length <= count) return [...pool];

  const sorted = [...pool].sort((a, b) => a.difficulty - b.difficulty);
  const result: T[] = [];
  const denom = count - 1 || 1;
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / denom);
    const q = sorted[idx];
    if (q && !result.includes(q)) result.push(q);
  }
  return result;
}

/**
 * Builds the first-time placement session. Prefers choice questions (so it works
 * before the Chrome AI model is downloaded); open questions fill the remainder
 * unless `choiceOnly` is set.
 */
export function buildPlacementSession(
  index: ContentIndex,
  options: PlacementOptions = {},
): Session {
  const perDomain = options.perDomain ?? 2;
  const choiceOnly = options.choiceOnly ?? false;
  const items: SessionItem[] = [];

  for (const domain of DOMAINS) {
    const pool = getByDomain(index, domain);
    const picked: Question[] = pickSpread(pool.filter(isChoiceQuestion), perDomain);

    if (!choiceOnly && picked.length < perDomain) {
      const open = pool.filter((q) => !isChoiceQuestion(q));
      picked.push(...pickSpread(open, perDomain - picked.length));
    }

    for (const question of picked) items.push({ question, reason: 'placement' });
  }

  return { kind: 'placement', items };
}
