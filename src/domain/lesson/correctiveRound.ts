import type { AnswerOutcome } from '../models/answer';
import type { EvaluationResult } from '../models/evaluation';

/**
 * What a lesson should do at the end to let the learner recover (directives 1 & 2):
 * - `retry`   — re-ask the very same question (a wrong/skipped answer).
 * - `followup` — probe only the concept the learner missed (a partial answer):
 *   the resolver will find or generate a question focused on `conceptId`.
 */
export type CorrectiveNeed =
  | { kind: 'retry'; questionId: string }
  | { kind: 'followup'; questionId: string; conceptId: string };

/**
 * The concept the learner should revisit after a partial open answer: the most
 * uncovered required-or-not concept. `missing` outranks `partial`; ties keep
 * rubric order. Returns undefined when every concept was covered (nothing to
 * probe) or there is no evaluation (e.g. a choice question).
 */
export function priorityUncoveredConcept(
  evaluation: EvaluationResult | undefined,
): string | undefined {
  if (!evaluation) return undefined;
  const missing = evaluation.concepts.find((c) => c.coverage === 'missing');
  if (missing) return missing.conceptId;
  const partial = evaluation.concepts.find((c) => c.coverage === 'partial');
  return partial?.conceptId;
}

/**
 * Derives the corrective work for a finished lesson pass from its outcomes.
 * Every non-correct answer yields one need, de-duplicated by question (first
 * occurrence wins) so the same question is never queued twice. Partial open
 * answers with an identifiable gap become `followup`; everything else (wrong,
 * skipped, partial choice) becomes `retry`.
 */
export function correctiveNeeds(outcomes: readonly AnswerOutcome[]): CorrectiveNeed[] {
  const needs: CorrectiveNeed[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.verdict === 'correct') continue;
    if (seen.has(outcome.questionId)) continue;
    seen.add(outcome.questionId);

    const conceptId =
      outcome.verdict === 'partial' ? priorityUncoveredConcept(outcome.evaluation) : undefined;

    needs.push(
      conceptId
        ? { kind: 'followup', questionId: outcome.questionId, conceptId }
        : { kind: 'retry', questionId: outcome.questionId },
    );
  }

  return needs;
}
