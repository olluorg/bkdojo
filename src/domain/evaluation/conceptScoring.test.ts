import { describe, expect, test } from 'bun:test';
import type { EvaluationConcept } from '../models/question';
import type { ConceptCoverage } from '../models/evaluation';
import { PASS_THRESHOLD, scoreConcepts } from './conceptScoring';

const rubric: EvaluationConcept[] = [
  { id: 'c1', title: 'C1', description: '', required: true, weight: 2 },
  { id: 'c2', title: 'C2', description: '', required: true, weight: 2 },
  { id: 'c3', title: 'C3', description: '', required: false, weight: 1 },
];

function coverage(map: Record<string, ConceptCoverage>): Map<string, ConceptCoverage> {
  return new Map(Object.entries(map));
}

describe('scoreConcepts', () => {
  test('all covered → correct, score 1', () => {
    const r = scoreConcepts(rubric, coverage({ c1: 'covered', c2: 'covered', c3: 'covered' }));
    expect(r.score).toBe(1);
    expect(r.verdict).toBe('correct');
  });

  test('partial on a required concept still counts as correct when score clears threshold', () => {
    // c1 covered (2), c2 partial (1), c3 covered (1) → 4/5 = 0.8 ≥ 0.7
    const r = scoreConcepts(rubric, coverage({ c1: 'covered', c2: 'partial', c3: 'covered' }));
    expect(r.score).toBeCloseTo(0.8);
    expect(r.score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(r.verdict).toBe('correct');
  });

  test('a required concept fully missing blocks correct even with high score', () => {
    // c1 covered (2), c2 missing (0), c3 covered (1) → 3/5 = 0.6, below threshold anyway
    const missing = scoreConcepts(rubric, coverage({ c1: 'covered', c2: 'missing', c3: 'covered' }));
    expect(missing.verdict).toBe('partial');

    // Engineered case: high weighted score but a required concept is missing.
    const heavy: EvaluationConcept[] = [
      { id: 'a', title: 'A', description: '', required: false, weight: 10 },
      { id: 'b', title: 'B', description: '', required: true, weight: 1 },
    ];
    const r = scoreConcepts(heavy, coverage({ a: 'covered', b: 'missing' }));
    expect(r.score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(r.verdict).toBe('partial');
  });

  test('low score → partial; zero → incorrect', () => {
    const partial = scoreConcepts(rubric, coverage({ c1: 'partial', c2: 'missing', c3: 'missing' }));
    expect(partial.verdict).toBe('partial');

    const zero = scoreConcepts(rubric, coverage({ c1: 'missing', c2: 'missing', c3: 'missing' }));
    expect(zero.verdict).toBe('incorrect');
  });
});
