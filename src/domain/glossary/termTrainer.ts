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
  const chosen = ranked.slice(0, size);

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
