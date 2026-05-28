import type { AnswerOutcome } from '../models/answer';
import type { EvaluationResult } from '../models/evaluation';

/**
 * Turns an outcome the AI judged as not-correct into a learner-confirmed
 * "correct" one. Used when the learner spends a self-override credit because
 * they believe the AI underrated their answer. The transform mirrors what an
 * AI-judged correct outcome looks like (score=1, verdict=correct,
 * evaluatedBy=manual), and marks `selfOverride: true` so analytics and history
 * stay honest.
 */
export function applySelfOverride(outcome: AnswerOutcome): AnswerOutcome {
  const evaluation: EvaluationResult | undefined = outcome.evaluation
    ? {
        ...outcome.evaluation,
        source: 'manual',
        status: 'ok',
        verdict: 'correct',
        score: 1,
        feedback: 'Самооценка: ответ зачтён вручную.',
      }
    : undefined;
  return {
    ...outcome,
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'manual',
    evaluation,
    selfOverride: true,
  };
}
