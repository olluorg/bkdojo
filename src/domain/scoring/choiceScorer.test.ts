import { describe, expect, test } from 'bun:test';
import type { ChoiceQuestion } from '../models/question';
import { scoreChoice } from './choiceScorer';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function single(): ChoiceQuestion {
  return {
    id: 's',
    domain: 'java-core',
    difficulty: 2,
    type: 'single',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionIds: ['a'],
  };
}

function multiple(): ChoiceQuestion {
  return {
    id: 'm',
    domain: 'java-core',
    difficulty: 2,
    type: 'multiple',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ],
    correctOptionIds: ['a', 'b'],
  };
}

describe('scoreChoice', () => {
  test('single: correct → 1', () => {
    expect(scoreChoice(single(), { questionId: 's', type: 'single', selectedOptionIds: ['a'] })).toEqual({
      score: 1,
      verdict: 'correct',
    });
  });

  test('single: wrong → 0', () => {
    expect(scoreChoice(single(), { questionId: 's', type: 'single', selectedOptionIds: ['b'] })).toEqual({
      score: 0,
      verdict: 'incorrect',
    });
  });

  test('multiple: all correct → 1', () => {
    const r = scoreChoice(multiple(), { questionId: 'm', type: 'multiple', selectedOptionIds: ['a', 'b'] });
    expect(r).toEqual({ score: 1, verdict: 'correct' });
  });

  test('multiple: half correct → 0.5 partial', () => {
    const r = scoreChoice(multiple(), { questionId: 'm', type: 'multiple', selectedOptionIds: ['a'] });
    expect(r.score).toBeCloseTo(0.5);
    expect(r.verdict).toBe('partial');
  });

  test('multiple: a wrong pick cancels a correct one', () => {
    const r = scoreChoice(multiple(), { questionId: 'm', type: 'multiple', selectedOptionIds: ['a', 'c'] });
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('incorrect');
  });
});
