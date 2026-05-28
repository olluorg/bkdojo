import type { Difficulty, Domain } from './common';

/**
 * A vocabulary term the learner should know cold (volatile, ACID, AOP, B-tree…).
 * Bound to a course (`domain`) and a `level` (1..5) so the glossary unlocks as
 * the learner's competency in that course grows. Tracked with its own
 * spaced-repetition progress (see termProgress).
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  domain: Domain;
  level: Difficulty; // 1..5 — gates when the term unlocks within its course
  aliases?: string[];
}
