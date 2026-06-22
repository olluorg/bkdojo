import { describe, expect, test } from 'bun:test';
import type { AnswerRecord } from '../models/progress';
import { consecutiveCorrect, REVIEW_INTERVALS_DAYS, scheduleReview } from './spacedRepetition';

const now = new Date('2026-05-21T00:00:00.000Z');

function rec(questionId: string, verdict: AnswerRecord['verdict']): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: verdict === 'correct' ? 1 : 0,
    verdict,
    evaluatedBy: 'local-choice',
    answeredAt: now.toISOString(),
  };
}

describe('scheduleReview', () => {
  test('first correct → box 2 interval (not due the next day)', () => {
    const s = scheduleReview({ priorConsecutiveCorrect: 0, verdict: 'correct', now });
    expect(s.box).toBe(2);
    expect(s.intervalDays).toBe(REVIEW_INTERVALS_DAYS[1]);
  });

  test('repeated correct promotes the interval', () => {
    const s = scheduleReview({ priorConsecutiveCorrect: 2, verdict: 'correct', now });
    expect(s.box).toBe(4);
    expect(s.intervalDays).toBe(REVIEW_INTERVALS_DAYS[3]);
  });

  test('correct box is capped at the longest interval', () => {
    const s = scheduleReview({ priorConsecutiveCorrect: 10, verdict: 'correct', now });
    expect(s.box).toBe(REVIEW_INTERVALS_DAYS.length);
    expect(s.intervalDays).toBe(REVIEW_INTERVALS_DAYS.at(-1)!);
  });

  test('a non-correct answer resets to box 1', () => {
    const s = scheduleReview({ priorConsecutiveCorrect: 4, verdict: 'partial', now });
    expect(s.box).toBe(1);
    expect(s.intervalDays).toBe(REVIEW_INTERVALS_DAYS[0]);
  });

  test('nextReviewAt is now + interval', () => {
    const s = scheduleReview({ priorConsecutiveCorrect: 0, verdict: 'correct', now });
    const expected = new Date(now.getTime() + REVIEW_INTERVALS_DAYS[1] * 86_400_000).toISOString();
    expect(s.nextReviewAt).toBe(expected);
  });
});

describe('consecutiveCorrect', () => {
  test('counts the trailing run of correct answers for a question', () => {
    const history = [
      rec('jc-001', 'incorrect'),
      rec('jc-002', 'correct'), // other question, ignored
      rec('jc-001', 'correct'),
      rec('jc-001', 'correct'),
    ];
    expect(consecutiveCorrect(history, 'jc-001')).toBe(2);
  });

  test('breaks on the most recent incorrect', () => {
    const history = [rec('jc-001', 'correct'), rec('jc-001', 'incorrect')];
    expect(consecutiveCorrect(history, 'jc-001')).toBe(0);
  });
});
