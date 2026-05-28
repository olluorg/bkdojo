import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import {
  applyTermResult,
  countMasteredTerms,
  isTermMastered,
  termMastery,
} from './termProgress';

const now = new Date('2026-05-22T00:00:00.000Z');

describe('applyTermResult', () => {
  test('a correct answer grows the streak and schedules review', () => {
    const p = applyTermResult(createDefaultProgress(), 'volatile', true, now);
    expect(p.terms?.['volatile']?.streak).toBe(1);
    expect(p.terms?.['volatile']?.nextReviewAt).toBeDefined();
  });

  test('three correct in a row masters the term', () => {
    let p = createDefaultProgress();
    p = applyTermResult(p, 'acid', true, now);
    p = applyTermResult(p, 'acid', true, now);
    expect(termMastery(p, 'acid')).toBeCloseTo(2 / 3);
    p = applyTermResult(p, 'acid', true, now);
    expect(termMastery(p, 'acid')).toBe(1);
    expect(isTermMastered(p, 'acid')).toBe(true);
  });

  test('a wrong answer resets the streak', () => {
    let p = applyTermResult(createDefaultProgress(), 'cap', true, now);
    p = applyTermResult(p, 'cap', false, now);
    expect(p.terms?.['cap']?.streak).toBe(0);
    expect(termMastery(p, 'cap')).toBe(0);
  });

  test('does not mutate the input progress', () => {
    const p0 = createDefaultProgress();
    applyTermResult(p0, 'gc', true, now);
    expect(p0.terms).toEqual({});
  });
});

describe('countMasteredTerms', () => {
  test('counts only fully mastered terms', () => {
    let p = createDefaultProgress();
    for (let i = 0; i < 3; i++) p = applyTermResult(p, 'aop', true, now);
    p = applyTermResult(p, 'sql', true, now);
    expect(countMasteredTerms(p, ['aop', 'sql', 'cap'])).toBe(1);
  });
});
