import type { Difficulty } from './common';
import type { OpenQuestion } from './question';

export type EvaluatorId = 'chrome-prompt' | 'manual' | 'rule-based' | 'server';

/** Mirrors the Prompt API statuses, plus the "not Chrome / no API" case. */
export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface SelfAssessment {
  coveredConceptIds: string[];
  selfScore: number; // 0..1
}

export interface EvaluationInput {
  question: OpenQuestion;
  answer: string;
  targetLevel?: Difficulty; // affects strictness of the prompt
  selfAssessment?: SelfAssessment; // only for the manual fallback (2nd phase)
}

export type ConceptCoverage = 'covered' | 'partial' | 'missing';

export interface ConceptResult {
  conceptId: string;
  coverage: ConceptCoverage;
  comment?: string;
}

export type Verdict = 'correct' | 'partial' | 'incorrect';

export type EvaluationStatus = 'ok' | 'manual_required' | 'error';

/**
 * The single normalized result every evaluator must return. The UI and the
 * ability/review layers bind to THIS — never to a specific evaluator's output.
 * Adding ServerAiEvaluator later means producing this same shape.
 */
export interface EvaluationResult {
  source: EvaluatorId;
  status: EvaluationStatus;
  score: number; // 0..1, normalized → feeds ability/Elo update
  verdict: Verdict;
  concepts: ConceptResult[];
  strengths: string[];
  gaps: string[];
  feedback: string;
  suggestedLevel?: Difficulty;
  error?: string;
  raw?: unknown;
}

export interface AnswerEvaluator {
  readonly id: EvaluatorId;
  availability(): Promise<AiAvailability>;
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
