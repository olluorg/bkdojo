import { getByDomain, type ContentIndex } from '../content/contentIndex';
import { DOMAIN_LABELS, type Domain } from '../models/common';
import type { UserProgress } from '../models/progress';
import { isOpenQuestion, type OpenQuestion, type Question } from '../models/question';
import type { Session, SessionItem, SessionReason } from '../models/session';
import { rankWeakConcepts, rankWeakDomains } from '../review/weakSpotDetection';
import { weakSpotState } from '../review/weakSpotLifecycle';
import { weakQuestions } from '../progress/weakQuestions';
import { pickByDifficulty, targetDifficulty } from './adaptiveSelector';
import { buildReviewSession } from './reviewSelector';

export interface WeakSpotOptions {
  now?: Date;
  size?: number;
  rng?: () => number;
  domain?: Domain;
  conceptIds?: string[];
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

  const add = (question: Question, reason: SessionReason, reasonText?: string) => {
    if (used.has(question.id) || items.length >= size) return;
    items.push({ question, reason, reasonText });
    used.add(question.id);
  };

  const wantedConcepts = options.conceptIds ? new Set(options.conceptIds) : undefined;

  // 1) Due spaced-repetition reviews.
  for (const item of buildReviewSession(index, progress, { now, size }).items) {
    if (options.domain && item.question.domain !== options.domain) continue;
    add(item.question, 'review', item.reasonText);
  }

  // 1b) Questions that earlier needed help or were answered wrong (and haven't
  //     been re-confirmed twice yet) — surfaced even when not due for review.
  for (const question of weakQuestions(progress, index)) {
    if (options.domain && question.domain !== options.domain) continue;
    add(question, 'review', 'Слабое место: этот вопрос не получился с первого раза.');
  }

  // 2) Open questions that cover the concepts the user repeatedly fails to cover.
  if (items.length < size) {
    const wanted = new Set(
      rankWeakConcepts(progress)
        .filter((c) => c.missRate > 0)
        .filter((c) => !wantedConcepts || wantedConcepts.has(c.conceptId))
        .filter((c) => weakSpotState(progress, c.conceptId, now) === 'active')
        .map((c) => c.conceptId),
    );
    if (wanted.size > 0) {
      const candidates = index.all
        .filter((q) => !options.domain || q.domain === options.domain)
        .filter((q): q is OpenQuestion => isOpenQuestion(q))
        .map((q) => ({ q, hits: q.rubric.filter((c) => wanted.has(c.id)).length }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.q.difficulty - b.q.difficulty);
      for (const { q } of candidates) add(q, 'review', 'Слабое место: этот вопрос проверяет концепт, который проседал.');
    }
  }

  // 3) Fill from the weakest domains, aiming at a desirable difficulty.
  if (items.length < size) {
    const weakDomains = options.domain
      ? rankWeakDomains(progress).filter((d) => d.domain === options.domain)
      : rankWeakDomains(progress);
    for (const weak of weakDomains) {
      if (items.length >= size) break;
      const pool = getByDomain(index, weak.domain);
      const target = targetDifficulty(weak.ability);
      let guard = pool.length;
      while (items.length < size && guard-- > 0) {
        const q = pickByDifficulty(pool, target, { excludeIds: used, rng });
        if (!q) break;
        add(q, 'review', `Добор из слабого домена: ${DOMAIN_LABELS[weak.domain]}.`);
      }
    }
  }

  return { kind: 'review', items };
}

export function buildFocusedWeakSpotSession(
  index: ContentIndex,
  progress: UserProgress,
  options: WeakSpotOptions & { domain: Domain },
): Session {
  const session = buildWeakSpotSession(index, progress, options);
  return {
    ...session,
    items: session.items.map((item) => ({
      ...item,
      reasonText:
        item.reason === 'review'
          ? `Слабое место внутри фокуса дня: ${DOMAIN_LABELS[options.domain]}.`
          : item.reasonText,
    })),
  };
}
