import { describe, expect, test } from 'bun:test';
import type { Difficulty } from '../models/common';
import type { Question } from '../models/question';
import { pickByDifficulty, targetDifficulty } from './adaptiveSelector';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function q(id: string, difficulty: Difficulty): Question {
  return {
    id,
    domain: 'java-core',
    difficulty,
    type: 'open',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    rubric: [{ id: 'c', title: 'c', description: 'd', required: true, weight: 1 }],
  };
}

describe('targetDifficulty', () => {
  test('aims slightly above ability and clamps to 1..5', () => {
    expect(targetDifficulty(3)).toBe(4);
    expect(targetDifficulty(1)).toBe(2);
    expect(targetDifficulty(4.8)).toBe(5);
  });
});

describe('pickByDifficulty', () => {
  const pool = [q('a', 1), q('b', 3), q('c', 5)];

  test('picks the question closest to target', () => {
    expect(pickByDifficulty(pool, 3)?.id).toBe('b');
    expect(pickByDifficulty(pool, 1)?.id).toBe('a');
  });

  test('excludes given ids', () => {
    const picked = pickByDifficulty(pool, 3, { excludeIds: new Set(['b']) });
    expect(picked?.id).not.toBe('b');
  });

  test('returns undefined when everything is excluded', () => {
    const excludeIds = new Set(['a', 'b', 'c']);
    expect(pickByDifficulty(pool, 3, { excludeIds })).toBeUndefined();
  });

  test('rng breaks ties deterministically', () => {
    const tied = [q('x', 2), q('y', 4)]; // both distance 1 from target 3
    expect(pickByDifficulty(tied, 3, { rng: () => 0 })?.id).toBe('x');
    expect(pickByDifficulty(tied, 3, { rng: () => 0.99 })?.id).toBe('y');
  });
});
