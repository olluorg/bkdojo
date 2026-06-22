import type { Difficulty, Domain } from './common';
import type { EvaluationResult, EvaluatorId, Verdict } from './evaluation';

export interface ChoiceSubmission {
  questionId: string;
  type: 'single' | 'multiple';
  selectedOptionIds: string[];
}

export interface OpenSubmission {
  questionId: string;
  type: 'open';
  text: string;
}

export interface FillBlankSubmission {
  questionId: string;
  type: 'fill-blank';
  /** blankId → the text the learner typed for that gap. */
  answers: Record<string, string>;
}

export type AnswerSubmission = ChoiceSubmission | OpenSubmission | FillBlankSubmission;

/**
 * Who produced the outcome: an AI/manual evaluator, local choice or fill-blank
 * scoring, or `'skipped'` when the user pressed "I don't know".
 */
export type OutcomeSource = EvaluatorId | 'local-choice' | 'local-fill' | 'skipped';

/**
 * Unified outcome of answering a question — the ONLY input consumed by the
 * ability, spaced-repetition, weak-spot and history layers. Choice scoring and
 * AI evaluation both converge here.
 */
export interface AnswerOutcome {
  questionId: string;
  domain: Domain;
  difficulty: Difficulty; // needed by the ability (Elo) update
  tags: string[];
  score: number; // 0..1
  verdict: Verdict;
  evaluatedBy: OutcomeSource;
  evaluation?: EvaluationResult; // present only for open questions
  /** The learner's raw text answer (open questions) — kept for later analysis. */
  answer?: string;
  /** The learner's selected option ids (choice questions) — kept for later analysis. */
  selectedOptionIds?: string[];
  /** The learner's per-gap answers (fill-blank questions) — kept for the result view and analysis. */
  blankAnswers?: Record<string, string>;
  /** True when the learner overrode the AI verdict via a self-override credit. */
  selfOverride?: boolean;
  /**
   * True when the verdict was reached with help — a clarifying question or a
   * post-result repair. Such a question is treated as a weak spot even if the
   * final verdict is `correct` (the recall wasn't independent).
   */
  assisted?: boolean;
  answeredAt: string; // ISO
}
