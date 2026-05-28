import type {
  AiAvailability,
  AnswerEvaluator,
  ConceptCoverage,
  EvaluationInput,
  EvaluationResult,
} from '../models/evaluation';
import { scoreConcepts } from './conceptScoring';

/**
 * Keyword-based evaluator. This is NOT the product evaluation mechanism —
 * open answers are scored by AI (ChromePromptEvaluator). It exists only as a
 * deterministic last resort for tests and emergency degraded mode, and works
 * solely off the optional `EvaluationConcept.keywords`.
 */
export class RuleBasedFallbackEvaluator implements AnswerEvaluator {
  readonly id = 'rule-based' as const;

  availability(): Promise<AiAvailability> {
    return Promise.resolve('available');
  }

  evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    return Promise.resolve(evaluateByKeywords(input));
  }
}

export function evaluateByKeywords(input: EvaluationInput): EvaluationResult {
  const answer = input.answer.toLowerCase();
  const coverageById = new Map<string, ConceptCoverage>();

  for (const concept of input.question.rubric) {
    const matched = (concept.keywords ?? []).some((k) => answer.includes(k.toLowerCase()));
    coverageById.set(concept.id, matched ? 'covered' : 'missing');
  }

  const scored = scoreConcepts(input.question.rubric, coverageById);

  return {
    source: 'rule-based',
    status: 'ok',
    score: scored.score,
    verdict: scored.verdict,
    concepts: scored.concepts,
    strengths: scored.strengths,
    gaps: scored.gaps,
    feedback:
      'Оценка по ключевым словам (fallback-режим). Это не основной механизм — открытые ответы оценивает AI.',
  };
}
