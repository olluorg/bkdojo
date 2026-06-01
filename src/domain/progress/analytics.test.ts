import { describe, expect, test } from 'bun:test';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { createDefaultProgress } from '../../storage/progressStorage';
import { activityByDay, dailyAccuracy, trendSlope, unifiedTimeline } from './analytics';

function answer(at: string, correct: boolean): AnswerRecord {
  return {
    questionId: 'q',
    domain: 'java-core',
    tags: [],
    score: correct ? 1 : 0,
    verdict: correct ? 'correct' : 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: at,
  };
}

// Anchor "now" to a fixed local day so the continuous-day buckets are stable.
const NOW = new Date('2026-05-10T12:00:00');

describe('dailyAccuracy', () => {
  test('returns a continuous series ending today with per-day accuracy', () => {
    const history = [
      answer('2026-05-10T08:00:00', true),
      answer('2026-05-10T09:00:00', false),
      answer('2026-05-09T08:00:00', true),
    ];
    const series = dailyAccuracy(history, 3, NOW);
    expect(series).toHaveLength(3);
    expect(series.map((d) => d.date)).toEqual(['2026-05-08', '2026-05-09', '2026-05-10']);
    expect(series[2]).toMatchObject({ answered: 2, correct: 1, accuracy: 0.5 });
    expect(series[1]).toMatchObject({ answered: 1, correct: 1, accuracy: 1 });
    expect(series[0]).toMatchObject({ answered: 0, accuracy: 0 });
  });
});

describe('activityByDay', () => {
  test('counts answers and events per day', () => {
    const p: UserProgress = {
      ...createDefaultProgress(),
      history: [answer('2026-05-10T08:00:00', true)],
      events: [
        { id: '1', type: 'session_completed', at: '2026-05-10T08:30:00', refId: 'practice' },
        { id: '2', type: 'lesson_completed', at: '2026-05-10T09:00:00', refId: 'l1' },
        { id: '3', type: 'term_drilled', at: '2026-05-09T09:00:00', refId: 't1', correct: true },
        { id: '4', type: 'lesson_started', at: '2026-05-10T07:00:00', refId: 'l1' },
      ],
    };
    const series = activityByDay(p, 2, NOW);
    expect(series[1]).toMatchObject({
      date: '2026-05-10',
      answers: 1,
      sessions: 1,
      lessons: 1,
      terms: 0,
    });
    expect(series[0]).toMatchObject({ date: '2026-05-09', terms: 1 });
  });
});

describe('unifiedTimeline', () => {
  test('merges answers and events newest-first', () => {
    const p: UserProgress = {
      ...createDefaultProgress(),
      history: [answer('2026-05-10T08:00:00.000Z', true)],
      events: [{ id: '1', type: 'lesson_completed', at: '2026-05-10T09:00:00.000Z', refId: 'l1' }],
    };
    const tl = unifiedTimeline(p);
    expect(tl).toHaveLength(2);
    expect(tl[0]!.source).toBe('event');
    expect(tl[1]!.source).toBe('answer');
  });
});

describe('trendSlope', () => {
  test('positive for rising series, negative for falling, zero for flat/short', () => {
    expect(trendSlope([0, 0.5, 1])).toBeGreaterThan(0);
    expect(trendSlope([1, 0.5, 0])).toBeLessThan(0);
    expect(trendSlope([0.5, 0.5, 0.5])).toBe(0);
    expect(trendSlope([0.5])).toBe(0);
  });
});
