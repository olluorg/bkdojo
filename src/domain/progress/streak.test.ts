import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { streakInfo, touchStreak } from './streak';

const now = new Date('2026-05-22T08:00:00.000Z');

function progressWith(streakDays: number, lastPracticeDate?: string) {
  return { ...createDefaultProgress(), streakDays, lastPracticeDate };
}

describe('touchStreak', () => {
  test('starts a streak for a fresh learner', () => {
    expect(touchStreak(progressWith(0), now)).toEqual({
      streakDays: 1,
      lastPracticeDate: '2026-05-22',
    });
  });

  test('keeps the count on the same day', () => {
    expect(touchStreak(progressWith(3, '2026-05-22'), now).streakDays).toBe(3);
  });

  test('extends when the last activity was yesterday', () => {
    expect(touchStreak(progressWith(3, '2026-05-21'), now).streakDays).toBe(4);
  });

  test('restarts after a gap', () => {
    expect(touchStreak(progressWith(9, '2026-05-19'), now).streakDays).toBe(1);
  });
});

describe('streakInfo', () => {
  test('active when practiced today', () => {
    expect(streakInfo(progressWith(5, '2026-05-22'), now)).toEqual({ days: 5, state: 'active' });
  });

  test('at-risk when practiced yesterday', () => {
    expect(streakInfo(progressWith(5, '2026-05-21'), now)).toEqual({ days: 5, state: 'at-risk' });
  });

  test('broken (none, 0 days) after a gap or never', () => {
    expect(streakInfo(progressWith(5, '2026-05-19'), now)).toEqual({ days: 0, state: 'none' });
    expect(streakInfo(progressWith(0), now)).toEqual({ days: 0, state: 'none' });
  });
});
