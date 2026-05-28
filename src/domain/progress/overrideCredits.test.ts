import { describe, expect, test } from 'bun:test';
import {
  earnFromLesson,
  OVERRIDE_CAP,
  touchCredits,
  useCredit,
  visibleBalance,
} from './overrideCredits';

function day(s: string): Date {
  // Local-time midnight on the given YYYY-MM-DD; toDateKey uses local components.
  return new Date(`${s}T00:00:00`);
}

describe('touchCredits', () => {
  test('first touch grants 1 starting credit', () => {
    const state = touchCredits(undefined, day('2026-05-26'));
    expect(state.balance).toBe(1);
    expect(state.lastTouchDate).toBe('2026-05-26');
    expect(state.lessonEarnedOn).toBeUndefined();
  });

  test('same-day touch is a no-op', () => {
    const a = touchCredits(undefined, day('2026-05-26'));
    const b = touchCredits(a, day('2026-05-26'));
    expect(b).toBe(a);
  });

  test('next-day touch adds the daily grant (capped at OVERRIDE_CAP)', () => {
    let s = touchCredits(undefined, day('2026-05-26'));
    s = touchCredits(s, day('2026-05-27'));
    expect(s.balance).toBe(2);
    s = touchCredits(s, day('2026-05-28'));
    expect(s.balance).toBe(3);
    s = touchCredits(s, day('2026-05-29'));
    expect(s.balance).toBe(OVERRIDE_CAP);
  });

  test('each missed day burns one credit, then today grants one', () => {
    // Start at balance 3 on day 1.
    let s = touchCredits(undefined, day('2026-05-26'));
    s = { ...s, balance: 3 };
    // Skip 2 days; on day 4 → -2 (missed) + 1 (daily) = 2.
    s = touchCredits(s, day('2026-05-29'));
    expect(s.balance).toBe(2);
  });

  test('long absence floors at 0 then grants 1', () => {
    let s = touchCredits(undefined, day('2026-05-26'));
    s = { ...s, balance: 2 };
    s = touchCredits(s, day('2026-06-30'));
    expect(s.balance).toBe(1);
  });
});

describe('earnFromLesson', () => {
  test('first lesson of the day grants +1', () => {
    const start = touchCredits(undefined, day('2026-05-26')); // balance 1
    const { state, granted } = earnFromLesson(start, day('2026-05-26'));
    expect(granted).toBe(true);
    expect(state.balance).toBe(2);
    expect(state.lessonEarnedOn).toBe('2026-05-26');
  });

  test('second lesson same day does not grant again', () => {
    const start = touchCredits(undefined, day('2026-05-26'));
    const first = earnFromLesson(start, day('2026-05-26')).state;
    const second = earnFromLesson(first, day('2026-05-26'));
    expect(second.granted).toBe(false);
    expect(second.state.balance).toBe(first.balance);
  });

  test('grant is denied at cap', () => {
    let s = touchCredits(undefined, day('2026-05-26'));
    s = { ...s, balance: OVERRIDE_CAP };
    const { state, granted } = earnFromLesson(s, day('2026-05-26'));
    expect(granted).toBe(false);
    expect(state.balance).toBe(OVERRIDE_CAP);
    // Slot stays open: at-cap doesn't burn the day's lesson grant.
    expect(state.lessonEarnedOn).toBeUndefined();
  });

  test('lesson slot resets the next day', () => {
    // Spend the credit between days so there is room for another grant.
    let s = earnFromLesson(undefined, day('2026-05-26')).state; // balance 2
    s = useCredit(s, day('2026-05-26')).state; // balance 1
    s = useCredit(s, day('2026-05-26')).state; // balance 0
    const next = earnFromLesson(s, day('2026-05-27'));
    expect(next.granted).toBe(true);
    expect(next.state.lessonEarnedOn).toBe('2026-05-27');
    // balance was 0 → daily grant takes it to 1 → lesson grant takes it to 2.
    expect(next.state.balance).toBe(2);
  });
});

describe('useCredit', () => {
  test('spends one credit when balance > 0', () => {
    const s = touchCredits(undefined, day('2026-05-26'));
    const { state, used } = useCredit(s, day('2026-05-26'));
    expect(used).toBe(true);
    expect(state.balance).toBe(0);
  });

  test('refuses to spend at zero balance', () => {
    let s = touchCredits(undefined, day('2026-05-26'));
    s = { ...s, balance: 0 };
    const { used } = useCredit(s, day('2026-05-26'));
    expect(used).toBe(false);
  });
});

describe('visibleBalance', () => {
  test('reflects day folds without persisting', () => {
    const s = touchCredits(undefined, day('2026-05-26'));
    expect(visibleBalance(s, day('2026-05-26'))).toBe(1);
    expect(visibleBalance(s, day('2026-05-27'))).toBe(2);
  });
});
