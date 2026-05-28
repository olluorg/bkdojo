import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ConceptResult, EvaluationResult, Verdict } from '../models/evaluation';
import { correctiveNeeds, priorityUncoveredConcept } from './correctiveRound';

function evaluation(concepts: ConceptResult[]): EvaluationResult {
  return {
    source: 'chrome-prompt',
    status: 'ok',
    score: 0.5,
    verdict: 'partial',
    concepts,
    strengths: [],
    gaps: [],
    feedback: '',
  };
}

function outcome(over: Partial<AnswerOutcome> & { verdict: Verdict }): AnswerOutcome {
  return {
    questionId: 'q1',
    domain: 'java-core',
    difficulty: 2,
    tags: [],
    score: 0.5,
    evaluatedBy: 'chrome-prompt',
    answeredAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('priorityUncoveredConcept', () => {
  test('prefers a missing concept over a partial one', () => {
    const ev = evaluation([
      { conceptId: 'a', coverage: 'partial' },
      { conceptId: 'b', coverage: 'missing' },
    ]);
    expect(priorityUncoveredConcept(ev)).toBe('b');
  });

  test('falls back to a partial concept when nothing is fully missing', () => {
    const ev = evaluation([
      { conceptId: 'a', coverage: 'covered' },
      { conceptId: 'b', coverage: 'partial' },
    ]);
    expect(priorityUncoveredConcept(ev)).toBe('b');
  });

  test('returns undefined when all concepts are covered or no evaluation', () => {
    expect(priorityUncoveredConcept(evaluation([{ conceptId: 'a', coverage: 'covered' }]))).toBeUndefined();
    expect(priorityUncoveredConcept(undefined)).toBeUndefined();
  });
});

describe('correctiveNeeds', () => {
  test('skips correct answers', () => {
    expect(correctiveNeeds([outcome({ verdict: 'correct' })])).toEqual([]);
  });

  test('wrong answer becomes a retry of the same question', () => {
    const needs = correctiveNeeds([outcome({ questionId: 'q9', verdict: 'incorrect' })]);
    expect(needs).toEqual([{ kind: 'retry', questionId: 'q9' }]);
  });

  test('a skipped ("I don\'t know") answer is still re-asked', () => {
    const needs = correctiveNeeds([
      outcome({ questionId: 'q9', verdict: 'incorrect', evaluatedBy: 'skipped' }),
    ]);
    expect(needs).toEqual([{ kind: 'retry', questionId: 'q9' }]);
  });

  test('partial open answer becomes a follow-up on the missing concept', () => {
    const needs = correctiveNeeds([
      outcome({
        questionId: 'q2',
        verdict: 'partial',
        evaluation: evaluation([
          { conceptId: 'covered-1', coverage: 'covered' },
          { conceptId: 'gap-1', coverage: 'missing' },
        ]),
      }),
    ]);
    expect(needs).toEqual([{ kind: 'followup', questionId: 'q2', conceptId: 'gap-1' }]);
  });

  test('partial answer without an identifiable gap (e.g. choice) falls back to retry', () => {
    const needs = correctiveNeeds([outcome({ questionId: 'q3', verdict: 'partial' })]);
    expect(needs).toEqual([{ kind: 'retry', questionId: 'q3' }]);
  });

  test('de-duplicates by question, keeping the first occurrence', () => {
    const needs = correctiveNeeds([
      outcome({ questionId: 'q4', verdict: 'incorrect' }),
      outcome({ questionId: 'q4', verdict: 'partial', evaluation: evaluation([{ conceptId: 'x', coverage: 'missing' }]) }),
    ]);
    expect(needs).toEqual([{ kind: 'retry', questionId: 'q4' }]);
  });
});
