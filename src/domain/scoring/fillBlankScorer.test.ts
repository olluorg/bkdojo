import { describe, expect, test } from 'bun:test';
import type { FillBlankQuestion } from '../models/question';
import { normalizeBlank, scoreFillBlank } from './fillBlankScorer';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function question(): FillBlankQuestion {
  return {
    id: 'fb',
    domain: 'java-core',
    difficulty: 2,
    type: 'fill-blank',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    template: 'Integer кэширует значения от {{lo}} до {{hi}}.',
    blanks: [
      { id: 'lo', accept: ['-128'] },
      { id: 'hi', accept: ['127'] },
    ],
  };
}

describe('normalizeBlank', () => {
  test('trims, lowercases and collapses inner whitespace', () => {
    expect(normalizeBlank('  Hash   Map ')).toBe('hash map');
  });
});

describe('scoreFillBlank', () => {
  test('all blanks correct → 1', () => {
    const r = scoreFillBlank(question(), {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { lo: '-128', hi: '127' },
    });
    expect(r.score).toBe(1);
    expect(r.verdict).toBe('correct');
    expect(r.perBlank).toEqual({ lo: true, hi: true });
  });

  test('half correct → 0.5 partial', () => {
    const r = scoreFillBlank(question(), {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { lo: '-128', hi: '255' },
    });
    expect(r.score).toBeCloseTo(0.5);
    expect(r.verdict).toBe('partial');
    expect(r.perBlank).toEqual({ lo: true, hi: false });
  });

  test('none correct → 0 incorrect', () => {
    const r = scoreFillBlank(question(), {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { lo: '0', hi: '255' },
    });
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('incorrect');
  });

  test('matching is normalized (case / spaces)', () => {
    const q: FillBlankQuestion = {
      ...question(),
      template: 'Используй {{type}} для денег.',
      blanks: [{ id: 'type', accept: ['BigDecimal'] }],
    };
    const r = scoreFillBlank(q, {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { type: '  bigdecimal ' },
    });
    expect(r.verdict).toBe('correct');
  });

  test('accepts any of the listed variants', () => {
    const q: FillBlankQuestion = {
      ...question(),
      template: 'Метод {{m}}.',
      blanks: [{ id: 'm', accept: ['equals', 'equals()'] }],
    };
    const r = scoreFillBlank(q, {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { m: 'equals()' },
    });
    expect(r.verdict).toBe('correct');
  });

  test('empty answer is never a match', () => {
    const r = scoreFillBlank(question(), {
      questionId: 'fb',
      type: 'fill-blank',
      answers: { lo: '', hi: '   ' },
    });
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('incorrect');
  });
});
