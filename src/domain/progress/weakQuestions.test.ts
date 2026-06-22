import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { Verdict } from '../models/evaluation';
import type { AnswerRecord } from '../models/progress';
import { weakQuestionIds } from './weakQuestions';

function record(
  questionId: string,
  verdict: Verdict,
  answeredAt: string,
  assisted = false,
): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0,
    verdict,
    evaluatedBy: 'manual',
    assisted,
    answeredAt,
  };
}

describe('weakQuestionIds', () => {
  test('a wrong answer makes the question weak', () => {
    const progress = createDefaultProgress();
    progress.history = [record('q1', 'incorrect', '2026-05-20T00:00:00.000Z')];
    expect(weakQuestionIds(progress).has('q1')).toBe(true);
  });

  test('a correct-but-assisted answer (clarify/repair) makes it weak', () => {
    const progress = createDefaultProgress();
    progress.history = [record('q1', 'correct', '2026-05-20T00:00:00.000Z', true)];
    expect(weakQuestionIds(progress).has('q1')).toBe(true);
  });

  test('an always-clean-correct question is never weak', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('q1', 'correct', '2026-05-20T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-21T00:00:00.000Z'),
    ];
    expect(weakQuestionIds(progress).has('q1')).toBe(false);
  });

  test('leaves the list only after two clean corrects in a row', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('q1', 'incorrect', '2026-05-18T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-19T00:00:00.000Z'),
    ];
    // one clean correct is not enough
    expect(weakQuestionIds(progress).has('q1')).toBe(true);

    progress.history.push(record('q1', 'correct', '2026-05-20T00:00:00.000Z'));
    expect(weakQuestionIds(progress).has('q1')).toBe(false);
  });

  test('an assisted correct does not count toward the two clean corrects', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('q1', 'incorrect', '2026-05-18T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-19T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-20T00:00:00.000Z', true), // assisted resets the streak
    ];
    expect(weakQuestionIds(progress).has('q1')).toBe(true);
  });

  test('a relapse after resolution makes it weak again', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('q1', 'incorrect', '2026-05-18T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-19T00:00:00.000Z'),
      record('q1', 'correct', '2026-05-20T00:00:00.000Z'), // resolved here
      record('q1', 'incorrect', '2026-05-21T00:00:00.000Z'), // relapse
    ];
    expect(weakQuestionIds(progress).has('q1')).toBe(true);
  });
});
