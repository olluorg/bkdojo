import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerOutcome } from '../models/answer';
import { applyOutcome } from './applyOutcome';

const now = new Date('2026-05-21T08:00:00.000Z');

function outcome(overrides: Partial<AnswerOutcome> = {}): AnswerOutcome {
  return {
    questionId: 'jc-001',
    domain: 'java-core',
    difficulty: 3,
    tags: ['oop'],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: now.toISOString(),
    ...overrides,
  };
}

describe('applyOutcome', () => {
  test('a correct answer raises ability and updates counters', () => {
    const before = createDefaultProgress();
    const after = applyOutcome(before, outcome(), { now });

    expect(after.skills['java-core'].ability).toBeGreaterThan(before.skills['java-core'].ability);
    expect(after.skills['java-core'].answered).toBe(1);
    expect(after.skills['java-core'].correct).toBe(1);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]?.nextReviewAt).toBeDefined();
    expect(after.streakDays).toBe(1);
    expect(before.history).toHaveLength(0); // input not mutated
  });

  test('a wrong answer lowers ability and does not count as correct', () => {
    const after = applyOutcome(createDefaultProgress(), outcome({ score: 0, verdict: 'incorrect' }), {
      now,
    });
    expect(after.skills['java-core'].ability).toBeLessThan(3);
    expect(after.skills['java-core'].correct).toBe(0);
  });

  test('streak increments when the last practice was yesterday', () => {
    const progress = createDefaultProgress();
    progress.streakDays = 3;
    progress.lastPracticeDate = '2026-05-20'; // the day before `now`
    const after = applyOutcome(progress, outcome(), { now });
    expect(after.streakDays).toBe(4);
    expect(after.lastPracticeDate).toBe('2026-05-21');
  });

  test('copies concept coverage from an AI evaluation into the record', () => {
    const after = applyOutcome(
      createDefaultProgress(),
      outcome({
        evaluatedBy: 'chrome-prompt',
        evaluation: {
          source: 'chrome-prompt',
          status: 'ok',
          score: 1,
          verdict: 'correct',
          concepts: [{ conceptId: 'encapsulation', coverage: 'covered' }],
          strengths: ['encapsulation'],
          gaps: [],
          feedback: 'ok',
        },
      }),
      { now },
    );
    expect(after.history[0]?.conceptCoverage).toEqual([
      { conceptId: 'encapsulation', coverage: 'covered' },
    ]);
  });
});
