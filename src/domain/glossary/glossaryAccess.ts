import type { ContentIndex } from '../content/contentIndex';
import { courseLevelOf, maxUnlockedLevel } from '../course/courses';
import type { Domain } from '../models/common';
import type { GlossaryTerm } from '../models/glossary';
import type { UserProgress } from '../models/progress';

/**
 * A term is unlocked once the learner's competency in its course reaches the
 * term's level — so the glossary grows as the course is mastered.
 */
export function isTermUnlocked(
  term: GlossaryTerm,
  progress: UserProgress,
  index: ContentIndex,
): boolean {
  return term.level <= maxUnlockedLevel(courseLevelOf(progress, index, term.domain));
}

export function unlockedTerms(
  terms: GlossaryTerm[],
  progress: UserProgress,
  index: ContentIndex,
): GlossaryTerm[] {
  return terms.filter((t) => isTermUnlocked(t, progress, index));
}

export function termsByCourse(terms: GlossaryTerm[]): Map<Domain, GlossaryTerm[]> {
  const map = new Map<Domain, GlossaryTerm[]>();
  for (const term of [...terms].sort((a, b) => a.level - b.level)) {
    const bucket = map.get(term.domain) ?? [];
    bucket.push(term);
    map.set(term.domain, bucket);
  }
  return map;
}
