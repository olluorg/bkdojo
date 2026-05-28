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

export type AnswerSubmission = ChoiceSubmission | OpenSubmission;

/**
 * Who produced the outcome: an AI/manual evaluator, local choice scoring, or
 * `'skipped'` when the user pressed "I don't know".
 */
export type OutcomeSource = EvaluatorId | 'local-choice' | 'skipped';

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
  /** True when the learner overrode the AI verdict via a self-override credit. */
  selfOverride?: boolean;
  answeredAt: string; // ISO
}
