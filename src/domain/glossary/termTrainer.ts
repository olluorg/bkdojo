import type { Domain } from '../models/common';
import type { GlossaryTerm } from '../models/glossary';
import type { UserProgress } from '../models/progress';
import { getTermProgress, termMastery } from '../progress/termProgress';
import { shuffle } from '../util/shuffle';

export type DrillDirection = 'term-to-definition' | 'definition-to-term';

export interface DrillItem {
  term: GlossaryTerm; // the correct answer
  direction: DrillDirection;
  options: GlossaryTerm[]; // includes `term`, shuffled
}

export interface DrillOptions {
  size?: number;
  optionsCount?: number;
  now?: Date;
  rng?: () => number;
  /**
   * When set, the drill is split ~50/50 between this course (the day's focus) and
   * all other unlocked terms — so the learner revisits the focus without drilling
   * only one course. Empty/short focus is backfilled from the rest (no wasted slots).
   */
  focusDomain?: Domain;
}

/**
 * Splits the (already ranked) terms ~50/50: up to half from the focus course,
 * the rest from other courses, backfilling either side so no slot is wasted.
 */
function selectHalfFocus(
  ranked: GlossaryTerm[],
  focusDomain: Domain,
  size: number,
): GlossaryTerm[] {
  const focusQuota = Math.ceil(size / 2);
  const focusRanked = ranked.filter((t) => t.domain === focusDomain);
  const restRanked = ranked.filter((t) => t.domain !== focusDomain);

  const picked = new Map<string, GlossaryTerm>();
  const take = (list: GlossaryTerm[], limit: number) => {
    for (const t of list) {
      if (picked.size >= limit) break;
      picked.set(t.id, t);
    }
  };

  take(focusRanked, focusQuota); // ~half from the focus course
  take(restRanked, size); // fill the rest from other courses
  take(focusRanked, size); // backfill from focus if the rest ran short

  return [...picked.values()].slice(0, size);
}

/** Due first, then least-mastered: the terms most worth drilling right now. */
function priority(progress: UserProgress, term: GlossaryTerm, now: number): number {
  const tp = getTermProgress(progress, term.id);
  const due = tp?.nextReviewAt ? Date.parse(tp.nextReviewAt) <= now : true; // unseen counts as due
  const mastery = termMastery(progress, term.id);
  // lower sorts first: due & low-mastery come first
  return (due ? 0 : 1) + mastery;
}

/**
 * Builds a recognition drill, prioritizing due / least-mastered terms and
 * mixing both directions. Distractors prefer the same course.
 */
export function buildTermDrill(
  terms: GlossaryTerm[],
  progress: UserProgress,
  options: DrillOptions = {},
): DrillItem[] {
  const size = options.size ?? 10;
  const optionsCount = options.optionsCount ?? 4;
  const rng = options.rng ?? Math.random;
  const now = (options.now ?? new Date()).getTime();

  const ranked = [...terms].sort((a, b) => priority(progress, a, now) - priority(progress, b, now));
  const chosen = options.focusDomain
    ? selectHalfFocus(ranked, options.focusDomain, size)
    : ranked.slice(0, size);

  return chosen.map((term, i) => {
    const sameCourse = terms.filter((t) => t.id !== term.id && t.domain === term.domain);
    const others = terms.filter((t) => t.id !== term.id && t.domain !== term.domain);
    const pool = shuffle(sameCourse, rng).concat(shuffle(others, rng));
    const distractors = pool.slice(0, Math.max(0, optionsCount - 1));
    const options = shuffle([term, ...distractors], rng);
    const direction: DrillDirection = i % 2 === 0 ? 'definition-to-term' : 'term-to-definition';
    return { term, direction, options };
  });
}
