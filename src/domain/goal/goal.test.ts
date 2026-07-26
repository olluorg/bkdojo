import { describe, expect, test } from 'bun:test';
import {
  GRADE_TARGET_ABILITY,
  countdownLabel,
  daysUntilInterview,
  goalLabel,
  pluralDays,
  toDateKey,
} from './goal';

describe('goalLabel', () => {
  test('names the grade', () => {
    expect(goalLabel({ grade: 'senior' })).toBe('Senior Java Backend');
  });

  test('appends a company when there is one', () => {
    expect(goalLabel({ grade: 'middle', company: '  Тинькофф ' })).toBe(
      'Middle Java Backend — Тинькофф',
    );
  });

  test('ignores a blank company', () => {
    expect(goalLabel({ grade: 'middle', company: '   ' })).toBe('Middle Java Backend');
  });
});

describe('GRADE_TARGET_ABILITY', () => {
  test('rises with the grade, so a higher goal lowers readiness honestly', () => {
    expect(GRADE_TARGET_ABILITY.junior).toBeLessThan(GRADE_TARGET_ABILITY.middle);
    expect(GRADE_TARGET_ABILITY.middle).toBeLessThan(GRADE_TARGET_ABILITY.senior);
  });
});

describe('toDateKey', () => {
  test('formats the local calendar day', () => {
    expect(toDateKey(new Date(2026, 6, 5))).toBe('2026-07-05');
  });
});

describe('daysUntilInterview', () => {
  const now = new Date(2026, 6, 25); // 2026-07-25 local

  test('counts whole days ahead', () => {
    expect(daysUntilInterview({ grade: 'middle', interviewDate: '2026-08-01' }, now)).toBe(7);
  });

  test('is 0 on the day itself', () => {
    expect(daysUntilInterview({ grade: 'middle', interviewDate: '2026-07-25' }, now)).toBe(0);
  });

  test('goes negative once it has passed', () => {
    expect(daysUntilInterview({ grade: 'middle', interviewDate: '2026-07-20' }, now)).toBe(-5);
  });

  test('is undefined without a usable date', () => {
    expect(daysUntilInterview({ grade: 'middle' }, now)).toBeUndefined();
    expect(daysUntilInterview({ grade: 'middle', interviewDate: 'завтра' }, now)).toBeUndefined();
  });
});

describe('pluralDays', () => {
  test('follows Russian plural rules', () => {
    expect(pluralDays(1)).toBe('день');
    expect(pluralDays(2)).toBe('дня');
    expect(pluralDays(4)).toBe('дня');
    expect(pluralDays(5)).toBe('дней');
    expect(pluralDays(11)).toBe('дней');
    expect(pluralDays(14)).toBe('дней');
    expect(pluralDays(21)).toBe('день');
    expect(pluralDays(22)).toBe('дня');
    expect(pluralDays(112)).toBe('дней');
  });
});

describe('countdownLabel', () => {
  const now = new Date(2026, 6, 25);

  test('reads naturally near the date', () => {
    expect(countdownLabel({ grade: 'middle', interviewDate: '2026-07-25' }, now)).toBe(
      'Собеседование сегодня.',
    );
    expect(countdownLabel({ grade: 'middle', interviewDate: '2026-07-26' }, now)).toBe(
      'Собеседование завтра.',
    );
    expect(countdownLabel({ grade: 'middle', interviewDate: '2026-07-28' }, now)).toBe(
      'До собеседования 3 дня.',
    );
  });

  test('prompts a refresh once the date has passed', () => {
    expect(countdownLabel({ grade: 'middle', interviewDate: '2026-07-01' }, now)).toBe(
      'Собеседование уже прошло — обнови цель.',
    );
  });

  test('is undefined without a date', () => {
    expect(countdownLabel({ grade: 'middle' }, now)).toBeUndefined();
  });
});
