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
  type: 'single' | 'multiple' | 'open';
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

export type Question = ChoiceQuestion | OpenQuestion;

export function isOpenQuestion(q: Question): q is OpenQuestion {
  return q.type === 'open';
}

export function isChoiceQuestion(q: Question): q is ChoiceQuestion {
  return q.type === 'single' || q.type === 'multiple';
}

/** A live-coding question: an open question that carries a `language`. */
export function isCodeQuestion(q: Question): boolean {
  return isOpenQuestion(q) && typeof q.language === 'string';
}
