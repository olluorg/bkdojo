import type { Domain } from './common';

/** An infographic attached to a lesson section. */
export interface LessonImage {
  /**
   * File name within `src/data/lessons/assets`, e.g. `"gc-generations.png"`.
   * Resolved to a bundled URL at runtime (see `lessonAssets.ts`).
   */
  src: string;
  /** Accessible description of the diagram. */
  alt: string;
  /** Optional caption shown under the image. */
  caption?: string;
}

/**
 * An interactive widget embedded in a lesson section. The JSON only references a
 * widget by `kind` + `id`; the actual renderer (and any pure compute logic) lives
 * in code, keyed by `id` in the widget registry (`components/lessonWidgets`). This
 * keeps content declarative while letting each demo be as rich as it needs to be.
 */
export interface LessonInteractive {
  /** Selects the group of renderers. */
  kind: 'param-demo' | 'stepper';
  /** Identifies the concrete widget within the registry, e.g. `"integer-cache"`. */
  id: string;
  /** Optional heading shown above the widget. */
  title?: string;
  /** Optional caption shown under the widget. */
  caption?: string;
}

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  /** Optional code example shown as a <pre> block. */
  code?: string;
  /** Optional infographic illustrating the section. */
  image?: LessonImage;
  /** Optional interactive widget (sandbox / stepper) shown after the code. */
  interactive?: LessonInteractive;
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
