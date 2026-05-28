import { describe, expect, test } from 'bun:test';
import type { OpenQuestion } from '../models/question';
import { evaluateByKeywords, RuleBasedFallbackEvaluator } from './RuleBasedFallbackEvaluator';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function question(): OpenQuestion {
  return {
    id: 'o',
    domain: 'java-core',
    difficulty: 2,
    type: 'open',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    rubric: [
      { id: 'c1', title: 'C1', description: 'd', required: true, weight: 1, keywords: ['alpha'] },
      { id: 'c2', title: 'C2', description: 'd', required: true, weight: 1, keywords: ['beta'] },
    ],
  };
}

describe('evaluateByKeywords', () => {
  test('full coverage → correct', () => {
    const r = evaluateByKeywords({ question: question(), answer: 'alpha and beta' });
    expect(r.score).toBe(1);
    expect(r.verdict).toBe('correct');
    expect(r.gaps).toEqual([]);
    expect(r.source).toBe('rule-based');
  });

  test('partial coverage with a missing required concept is not correct', () => {
    const r = evaluateByKeywords({ question: question(), answer: 'only alpha here' });
    expect(r.score).toBeCloseTo(0.5);
    expect(r.verdict).toBe('partial');
    expect(r.gaps).toEqual(['c2']);
  });

  test('no coverage → incorrect', () => {
    const r = evaluateByKeywords({ question: question(), answer: 'nothing relevant' });
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('incorrect');
  });
});

describe('RuleBasedFallbackEvaluator', () => {
  test('implements the AnswerEvaluator contract', async () => {
    const evaluator = new RuleBasedFallbackEvaluator();
    expect(evaluator.id).toBe('rule-based');
    expect(await evaluator.availability()).toBe('available');
    const result = await evaluator.evaluate({ question: question(), answer: 'alpha beta' });
    expect(result.verdict).toBe('correct');
  });
});
