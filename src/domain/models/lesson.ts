import type { Domain } from './common';

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  /** Optional code example shown as a <pre> block. */
  code?: string;
}

/**
 * Duolingo-style reading material for a topic within a domain. A lesson is one
 * atomic topic written as a single progressive flow: sections run shallow → deep
 * in order, so detail surfaces gradually rather than being gated behind
 * junior/middle/senior tiers.
 */
export interface Lesson {
  id: string;
  domain: Domain;
  /** Short topic key, also used to relate the lesson to practice questions. */
  topic: string;
  title: string;
  summary: string;
  /** Display order within a domain. */
  order: number;
  sections: LessonSection[];
  /** Question tags used for topic mastery and as the legacy practice fallback. */
  relatedTags?: string[];
  /**
   * Explicit ids of the questions that make up this lesson's test. When present
   * (even as an empty array) it is authoritative: the test contains exactly
   * these questions and nothing else — no tag fallback. When omitted, the test
   * falls back to tag matching against `relatedTags` (legacy, un-migrated
   * domains). This is what guarantees a lesson test only shows its own topic.
   */
  questionIds?: string[];
  /** Ids of related lessons — rendered as cross-links ("См. также"). */
  related?: string[];
}
