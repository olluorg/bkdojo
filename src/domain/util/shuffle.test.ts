import { describe, expect, test } from 'bun:test';
import { loadContent } from '../content/contentLoader';
import { isChoiceQuestion } from '../models/question';
import { hashString, orderedOptions, seededRng, shuffle } from './shuffle';

describe('shuffle', () => {
  test('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng(42));
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  test('is deterministic for a given seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });

  test('handles empty and single-element arrays', () => {
    expect(shuffle([], seededRng(1))).toEqual([]);
    expect(shuffle(['x'], seededRng(1))).toEqual(['x']);
  });
});

describe('orderedOptions', () => {
  const opts = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
    { id: 'd', text: 'D' },
  ];

  test('is stable for the same question id (card and result view match)', () => {
    expect(orderedOptions('q1', opts)).toEqual(orderedOptions('q1', opts));
  });

  test('keeps every option (a permutation)', () => {
    const ids = orderedOptions('q1', opts)
      .map((o) => o.id)
      .sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  test('different question ids generally give different orders', () => {
    expect(hashString('q1')).not.toBe(hashString('q2'));
    const a = orderedOptions('q1', opts).map((o) => o.id);
    const b = orderedOptions('q2', opts).map((o) => o.id);
    expect(a).not.toEqual(b);
  });
});

describe('display order across the real question bank', () => {
  test('the correct answer is not always first (shuffling actually happens)', () => {
    const choice = loadContent().questions.filter(isChoiceQuestion);
    expect(choice.length).toBeGreaterThan(10);
    const firstIsCorrect = choice.filter((q) => {
      const first = orderedOptions(q.id, q.options)[0];
      return first !== undefined && q.correctOptionIds.includes(first.id);
    });
    // Without shuffling this ratio would be ~1.0 (most questions list the
    // correct option first); shuffling must scatter it well below that.
    expect(firstIsCorrect.length / choice.length).toBeLessThan(0.5);
  });
});
