import { scoreChoice } from '../scoring/choiceScorer';
import type { Difficulty } from '../models/common';
import type { AnswerOutcome, AnswerSubmission, OutcomeSource } from '../models/answer';
import type {
  EvaluationInput,
  EvaluationResult,
  SelfAssessment,
  Verdict,
} from '../models/evaluation';
import { isChoiceQuestion, type OpenQuestion, type Question } from '../models/question';
import { ManualFallbackEvaluator } from './ManualFallbackEvaluator';
import { resolveEvaluators, type ResolverConfig } from './evaluatorResolver';

export interface EvaluateOptions {
  now?: Date;
  targetLevel?: Difficulty;
  resolver?: ResolverConfig;
}

/**
 * Result of evaluating a submission:
 * - `outcome`: ready to record (choice, AI, or completed manual).
 * - `manual`: AI unavailable — the UI must collect a self-assessment and call
 *   `submitManualAssessment`.
 */
export type EvaluateResult =
  | { kind: 'outcome'; outcome: AnswerOutcome }
  | { kind: 'manual'; question: OpenQuestion; evaluation: EvaluationResult };

/** What the learner actually submitted — persisted on the outcome for later analysis. */
interface CapturedAnswer {
  answer?: string;
  selectedOptionIds?: string[];
}

function buildOutcome(
  question: Question,
  score: number,
  verdict: Verdict,
  evaluatedBy: OutcomeSource,
  evaluation: EvaluationResult | undefined,
  now: Date,
  captured: CapturedAnswer = {},
): AnswerOutcome {
  return {
    questionId: question.id,
    domain: question.domain,
    difficulty: question.difficulty,
    tags: question.tags,
    score,
    verdict,
    evaluatedBy,
    evaluation,
    answer: captured.answer,
    selectedOptionIds: captured.selectedOptionIds,
    answeredAt: now.toISOString(),
  };
}

/** Records a question the user explicitly skipped ("I don't know") as incorrect. */
export function skipAnswer(question: Question, options: EvaluateOptions = {}): AnswerOutcome {
  const now = options.now ?? new Date();
  return buildOutcome(question, 0, 'incorrect', 'skipped', undefined, now);
}

function errorResult(question: OpenQuestion, error: unknown): EvaluationResult {
  return {
    source: 'manual',
    status: 'error',
    score: 0,
    verdict: 'incorrect',
    concepts: question.rubric.map((c) => ({ conceptId: c.id, coverage: 'missing' })),
    strengths: [],
    gaps: question.rubric.map((c) => c.id),
    feedback: 'Не удалось оценить ответ.',
    error: error instanceof Error ? error.message : String(error),
  };
}

/** Tries the evaluator chain in order; the first available one that yields wins. */
async function runChain(input: EvaluationInput, config: ResolverConfig): Promise<EvaluationResult> {
  const evaluators = resolveEvaluators(config);
  let lastError: unknown;
  for (const evaluator of evaluators) {
    try {
      if ((await evaluator.availability()) !== 'available') continue;
      return await evaluator.evaluate(input);
    } catch (error) {
      lastError = error;
    }
  }
  return errorResult(input.question, lastError);
}

/**
 * Single entry point for the UI. Choice questions are scored locally; open
 * questions go through the evaluator chain. Both converge on an AnswerOutcome
 * (or a `manual` request for the two-phase self-assessment flow).
 */
export async function evaluateAnswer(
  question: Question,
  submission: AnswerSubmission,
  options: EvaluateOptions = {},
): Promise<EvaluateResult> {
  const now = options.now ?? new Date();

  if (isChoiceQuestion(question)) {
    if (submission.type === 'open') {
      throw new Error(`Choice question ${question.id} received an open submission`);
    }
    const { score, verdict } = scoreChoice(question, submission);
    return {
      kind: 'outcome',
      outcome: buildOutcome(question, score, verdict, 'local-choice', undefined, now, {
        selectedOptionIds: submission.selectedOptionIds,
      }),
    };
  }

  if (submission.type !== 'open') {
    throw new Error(`Open question ${question.id} received a choice submission`);
  }

  const input: EvaluationInput = {
    question,
    answer: submission.text,
    targetLevel: options.targetLevel,
  };
  const evaluation = await runChain(input, options.resolver ?? {});

  if (evaluation.status === 'manual_required') {
    return { kind: 'manual', question, evaluation };
  }
  return {
    kind: 'outcome',
    outcome: buildOutcome(
      question,
      evaluation.score,
      evaluation.verdict,
      evaluation.source,
      evaluation,
      now,
      { answer: submission.text },
    ),
  };
}

/** Phase 2 of the manual flow: turn the user's self-assessment into an outcome. */
export async function submitManualAssessment(
  question: OpenQuestion,
  answer: string,
  selfAssessment: SelfAssessment,
  options: EvaluateOptions = {},
): Promise<AnswerOutcome> {
  const now = options.now ?? new Date();
  const evaluation = await new ManualFallbackEvaluator().evaluate({
    question,
    answer,
    selfAssessment,
  });
  return buildOutcome(question, evaluation.score, evaluation.verdict, 'manual', evaluation, now, {
    answer,
  });
}
