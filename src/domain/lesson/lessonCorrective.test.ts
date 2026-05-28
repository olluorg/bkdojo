import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ConceptResult, EvaluationResult, Verdict } from '../models/evaluation';
import { lessonCorrectiveNeeds } from './lessonCorrective';

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

const lessonIds = new Set(['q1', 'q2', 'q3']);

describe('lessonCorrectiveNeeds', () => {
  test('a wrong lesson question becomes a retry of the same question', () => {
    expect(lessonCorrectiveNeeds([outcome({ questionId: 'q2', verdict: 'incorrect' })], lessonIds)).toEqual([
      { kind: 'retry', questionId: 'q2' },
    ]);
  });

  test('a partial open answer is a RETRY of the same question, not an off-topic follow-up', () => {
    const partial = outcome({
      questionId: 'q3',
      verdict: 'partial',
      evaluation: evaluation([{ conceptId: 'c', coverage: 'missing' }]),
    });
    // The general correctiveNeeds would emit a {followup, conceptId}; for a
    // lesson it must stay a retry of q3 so q3 itself can be cleared.
    expect(lessonCorrectiveNeeds([partial], lessonIds)).toEqual([{ kind: 'retry', questionId: 'q3' }]);
  });

  test('correct answers produce no corrective work', () => {
    expect(lessonCorrectiveNeeds([outcome({ questionId: 'q1', verdict: 'correct' })], lessonIds)).toEqual([]);
  });

  test('outcomes outside the lesson are ignored (no off-topic questions)', () => {
    const needs = lessonCorrectiveNeeds(
      [
        outcome({ questionId: 'q1', verdict: 'incorrect' }),
        outcome({ questionId: 'other', verdict: 'incorrect' }),
      ],
      lessonIds,
    );
    expect(needs).toEqual([{ kind: 'retry', questionId: 'q1' }]);
  });
});
