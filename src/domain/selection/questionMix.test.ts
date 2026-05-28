import { describe, expect, test } from 'bun:test';
import { isOpenQuestion } from '../models/question';
import { choiceQ, openQ } from '../lesson/questionFixtures';
import { capOpenQuestions, maxOpenForSize } from './questionMix';

describe('maxOpenForSize', () => {
  test('floors the ratio (default 25%)', () => {
    expect(maxOpenForSize(8)).toBe(2);
    expect(maxOpenForSize(10)).toBe(2);
    expect(maxOpenForSize(3)).toBe(0);
  });
});

describe('capOpenQuestions', () => {
  test('keeps open answers at or below the cap when choice is plentiful', () => {
    const ordered = [
      openQ('o1'),
      openQ('o2'),
      openQ('o3'),
      ...Array.from({ length: 8 }, (_, i) => choiceQ(`c${i}`)),
    ];
    const picked = capOpenQuestions(ordered, 8); // maxOpen = 2, 8 choice available
    expect(picked).toHaveLength(8);
    expect(picked.filter(isOpenQuestion)).toHaveLength(2);
  });

  test('backfills with open answers when choice runs out (never starves)', () => {
    const ordered = [choiceQ('c1'), openQ('o1'), openQ('o2'), openQ('o3'), openQ('o4')];
    const picked = capOpenQuestions(ordered, 4); // maxOpen = 1, only 1 choice
    expect(picked).toHaveLength(4);
    expect(picked.filter(isOpenQuestion).length).toBe(3); // 1 under cap + 2 backfilled
  });

  test('respects the size limit', () => {
    const ordered = [choiceQ('c1'), choiceQ('c2'), choiceQ('c3'), choiceQ('c4')];
    expect(capOpenQuestions(ordered, 2)).toHaveLength(2);
  });

  test('takes choice questions in order before deferring open ones', () => {
    const ordered = [openQ('o1'), choiceQ('c1'), choiceQ('c2')];
    const ids = capOpenQuestions(ordered, 3, 0).map((q) => q.id); // ratio 0 → no open allowed unless backfilled
    expect(ids.slice(0, 2)).toEqual(['c1', 'c2']);
    expect(ids[2]).toBe('o1'); // backfilled last
  });
});
