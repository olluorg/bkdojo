import type { Difficulty, Domain, QuestionMode } from './common';

/** A single rubric item used by the AI evaluator to judge an open answer. */
export interface EvaluationConcept {
  id: string;
  title: string;
  description: string;
  required: boolean;
  weight: number;
  minLevel?: Difficulty;
  /**
   * Keywords are ONLY consumed by RuleBasedFallbackEvaluator (tests / emergency).
   * They are NOT the product evaluation mechanism — open answers are scored by AI.
   */
  keywords?: string[];
}

/** "How to answer this in an interview" — shown after the answer is submitted. */
export interface AnswerGuide {
  short: string;
  normal: string;
  traps: string[];
  followUps: string[];
}

export interface ContentMeta {
  verified: boolean;
  source?: string;
  lastReviewedAt?: string;
  reviewer?: string;
}

export interface BaseQuestion {
  id: string;
  domain: Domain;
  difficulty: Difficulty;
  type: 'single' | 'multiple' | 'open' | 'fill-blank';
  mode: QuestionMode;
  prompt: string;
  tags: string[];
  answerGuide: AnswerGuide;
  meta?: ContentMeta;
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export interface ChoiceQuestion extends BaseQuestion {
  type: 'single' | 'multiple';
  options: ChoiceOption[];
  correctOptionIds: string[];
}

export interface OpenQuestion extends BaseQuestion {
  type: 'open';
  rubric: EvaluationConcept[];
  /** When set, this is a live-coding task: render a code editor seeded with `starterCode`. */
  language?: string;
  starterCode?: string;
}

/** A single gap in a fill-blank template. */
export interface BlankSpec {
  id: string;
  /**
   * Accepted answers, compared after normalization (trim, lowercase, collapse
   * inner whitespace). The first entry is the canonical answer shown in results.
   */
  accept: string[];
  /** Optional placeholder shown while the gap is empty. */
  placeholder?: string;
}

/**
 * "Fill in the missing text" — a sentence or code snippet with one or more gaps
 * the learner types into. Scored locally and deterministically (no AI), like a
 * choice question. An optional word bank turns the gaps into tappable hints.
 */
export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-blank';
  /** Template text; each `{{blankId}}` marks where an input goes. */
  template: string;
  blanks: BlankSpec[];
  /** Optional shared word bank: tappable chips that fill the focused gap (may include distractors). */
  wordBank?: string[];
  /** When true, render the template as a monospace code block (code cloze). */
  code?: boolean;
}

export type Question = ChoiceQuestion | OpenQuestion | FillBlankQuestion;

export function isOpenQuestion(q: Question): q is OpenQuestion {
  return q.type === 'open';
}

export function isChoiceQuestion(q: Question): q is ChoiceQuestion {
  return q.type === 'single' || q.type === 'multiple';
}

export function isFillBlankQuestion(q: Question): q is FillBlankQuestion {
  return q.type === 'fill-blank';
}

/** Ordered ids of the gaps referenced by a template, in appearance order. */
export const BLANK_MARKER = /\{\{\s*([\w-]+)\s*\}\}/g;

export function templateBlankIds(template: string): string[] {
  const ids: string[] = [];
  for (const match of template.matchAll(BLANK_MARKER)) ids.push(match[1]!);
  return ids;
}

export type TemplateSegment = { kind: 'text'; text: string } | { kind: 'blank'; id: string };

/** Splits a template into ordered text / blank segments for rendering. */
export function templateSegments(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let last = 0;
  for (const match of template.matchAll(BLANK_MARKER)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', text: template.slice(last, start) });
    segments.push({ kind: 'blank', id: match[1]! });
    last = start + match[0].length;
  }
  if (last < template.length) segments.push({ kind: 'text', text: template.slice(last) });
  return segments;
}

/** A live-coding question: an open question that carries a `language`. */
export function isCodeQuestion(q: Question): boolean {
  return isOpenQuestion(q) && typeof q.language === 'string';
}
