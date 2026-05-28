import type {
  AiAvailability,
  AnswerEvaluator,
  ConceptCoverage,
  EvaluationInput,
  EvaluationResult,
} from '../models/evaluation';
import { scoreConcepts } from './conceptScoring';

/**
 * Two-phase fallback used when AI evaluation is unavailable.
 *
 * Phase 1 (no `selfAssessment`): returns status `manual_required` so the UI can
 * render the rubric + answer guide and ask the user to self-assess.
 * Phase 2 (with `selfAssessment`): turns the user's coverage choices into a
 * normal EvaluationResult.
 */
export class ManualFallbackEvaluator implements AnswerEvaluator {
  readonly id = 'manual' as const;

  availability(): Promise<AiAvailability> {
    return Promise.resolve('available'); // self-assessment is always possible
  }

  evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const selfAssessment = input.selfAssessment;

    if (!selfAssessment) {
      return Promise.resolve({
        source: 'manual',
        status: 'manual_required',
        score: 0,
        verdict: 'partial',
        concepts: input.question.rubric.map((c) => ({ conceptId: c.id, coverage: 'missing' })),
        strengths: [],
        gaps: input.question.rubric.map((c) => c.id),
        feedback: 'AI-оценка недоступна. Сверьтесь с эталоном и отметьте раскрытые критерии.',
      });
    }

    const covered = new Set(selfAssessment.coveredConceptIds);
    const coverageById = new Map<string, ConceptCoverage>(
      input.question.rubric.map((c) => [c.id, covered.has(c.id) ? 'covered' : 'missing']),
    );
    const scored = scoreConcepts(input.question.rubric, coverageById);

    return Promise.resolve({
      source: 'manual',
      status: 'ok',
      score: scored.score,
      verdict: scored.verdict,
      concepts: scored.concepts,
      strengths: scored.strengths,
      gaps: scored.gaps,
      feedback: 'Самооценка по эталону.',
    });
  }
}
