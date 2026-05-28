import { getByDomain, type ContentIndex } from '../content/contentIndex';
import type { UserProgress } from '../models/progress';
import { isOpenQuestion, type OpenQuestion, type Question } from '../models/question';
import type { Session, SessionItem, SessionReason } from '../models/session';
import { rankWeakConcepts, rankWeakDomains } from '../review/weakSpotDetection';
import { pickByDifficulty, targetDifficulty } from './adaptiveSelector';
import { buildReviewSession } from './reviewSelector';

export interface WeakSpotOptions {
  now?: Date;
  size?: number;
  rng?: () => number;
}

/**
 * Builds a "weak spots" session that is trainable on demand — not only when
 * spaced-repetition items happen to be due. Layered so the screen is actionable
 * whenever there is anything to work on:
 *   1. due reviews first (most overdue),
 *   2. questions covering the concepts the user keeps missing (the weak concepts
 *      shown in the panel), so the list matches what's surfaced as weak,
 *   3. fresh questions from the weakest domains (adaptive difficulty) to fill up.
 */
export function buildWeakSpotSession(
  index: ContentIndex,
  progress: UserProgress,
  options: WeakSpotOptions = {},
): Session {
  const now = options.now ?? new Date();
  const size = options.size ?? 10;
  const rng = options.rng ?? Math.random;

  const items: SessionItem[] = [];
  const used = new Set<string>();

  const add = (question: Question, reason: SessionReason) => {
    if (used.has(question.id) || items.length >= size) return;
    items.push({ question, reason });
    used.add(question.id);
  };

  // 1) Due spaced-repetition reviews.
  for (const item of buildReviewSession(index, progress, { now, size }).items) {
    add(item.question, 'review');
  }

  // 2) Open questions that cover the concepts the user repeatedly fails to cover.
  if (items.length < size) {
    const wanted = new Set(
      rankWeakConcepts(progress)
        .filter((c) => c.missRate > 0)
        .map((c) => c.conceptId),
    );
    if (wanted.size > 0) {
      const candidates = index.all
        .filter((q): q is OpenQuestion => isOpenQuestion(q))
        .map((q) => ({ q, hits: q.rubric.filter((c) => wanted.has(c.id)).length }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.q.difficulty - b.q.difficulty);
      for (const { q } of candidates) add(q, 'review');
    }
  }

  // 3) Fill from the weakest domains, aiming at a desirable difficulty.
  if (items.length < size) {
    for (const weak of rankWeakDomains(progress)) {
      if (items.length >= size) break;
      const pool = getByDomain(index, weak.domain);
      const target = targetDifficulty(weak.ability);
      let guard = pool.length;
      while (items.length < size && guard-- > 0) {
        const q = pickByDifficulty(pool, target, { excludeIds: used, rng });
        if (!q) break;
        add(q, 'review');
      }
    }
  }

  return { kind: 'review', items };
}
