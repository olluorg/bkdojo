import type { ConceptCoverage, ConceptResult, Verdict } from '../models/evaluation';
import type { EvaluationConcept } from '../models/question';
import { clamp01 } from '../util/math';

export const PASS_THRESHOLD = 0.7;

export function coverageWeight(coverage: ConceptCoverage): number {
  if (coverage === 'covered') return 1;
  if (coverage === 'partial') return 0.5;
  return 0;
}

export interface ScoredConcepts {
  concepts: ConceptResult[];
  score: number; // 0..1
  verdict: Verdict;
  strengths: string[]; // covered concept ids
  gaps: string[]; // partial / missing concept ids
}

/**
 * Turns per-concept coverage into a normalized score and verdict using the
 * rubric weights. Shared by the AI parser and the rule-based fallback so the
 * scoring rules stay identical regardless of who produced the coverage.
 */
export function scoreConcepts(
  rubric: EvaluationConcept[],
  coverageById: Map<string, ConceptCoverage>,
  commentById?: Map<string, string>,
): ScoredConcepts {
  const concepts: ConceptResult[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  let weightSum = 0;
  let scoreSum = 0;

  for (const rc of rubric) {
    const coverage = coverageById.get(rc.id) ?? 'missing';
    const comment = commentById?.get(rc.id);
    concepts.push(comment ? { conceptId: rc.id, coverage, comment } : { conceptId: rc.id, coverage });
    weightSum += rc.weight;
    scoreSum += rc.weight * coverageWeight(coverage);
    if (coverage === 'covered') strengths.push(rc.id);
    else gaps.push(rc.id);
  }

  const score = weightSum > 0 ? clamp01(scoreSum / weightSum) : 0;
  // Only a fully missing required concept blocks "correct" — partial coverage of
  // a required concept is acceptable if the weighted score still clears the
  // threshold. Without this, topics with many required concepts become
  // effectively unpassable any time the LLM downgrades one to "partial".
  const requiredMissing = rubric.some(
    (rc) => rc.required && (coverageById.get(rc.id) ?? 'missing') === 'missing',
  );
  const verdict: Verdict =
    score >= PASS_THRESHOLD && !requiredMissing ? 'correct' : score > 0 ? 'partial' : 'incorrect';

  return { concepts, score, verdict, strengths, gaps };
}
