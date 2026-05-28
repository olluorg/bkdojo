import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { activityAt, recordActivity, wasActiveOn } from './activity';

const day = new Date('2026-05-22T12:00:00.000Z');

describe('activity', () => {
  test('a fresh learner has no recorded activity', () => {
    const p = createDefaultProgress();
    expect(activityAt(p, 'practice')).toBeUndefined();
    expect(wasActiveOn(p, 'practice', day)).toBe(false);
  });

  test('recordActivity stamps the kind without mutating the input', () => {
    const before = createDefaultProgress();
    const after = recordActivity(before, 'review', day);

    expect(activityAt(after, 'review')).toBe(day.toISOString());
    expect(wasActiveOn(after, 'review', day)).toBe(true);
    expect(activityAt(before, 'review')).toBeUndefined(); // pure
  });

  test('wasActiveOn is day-scoped', () => {
    const p = recordActivity(createDefaultProgress(), 'interview', day);
    const nextDay = new Date('2026-05-23T09:00:00.000Z');
    expect(wasActiveOn(p, 'interview', day)).toBe(true);
    expect(wasActiveOn(p, 'interview', nextDay)).toBe(false);
  });

  test('kinds are tracked independently', () => {
    const p = recordActivity(createDefaultProgress(), 'practice', day);
    expect(wasActiveOn(p, 'practice', day)).toBe(true);
    expect(wasActiveOn(p, 'review', day)).toBe(false);
    expect(wasActiveOn(p, 'interview', day)).toBe(false);
  });
});
