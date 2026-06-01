import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ChoiceQuestion, OpenQuestion } from '../models/question';
import { applyHintPenalty, hintCap, hintsFor } from './hints';

const guide = { short: '', normal: '', traps: [], followUps: [] };

const open: OpenQuestion = {
  id: 'o1',
  domain: 'java-core',
  difficulty: 3,
  type: 'open',
  mode: 'definition',
  prompt: '?',
  tags: [],
  answerGuide: guide,
  rubric: [
    { id: 'a', title: 'Low weight', description: 'd', required: false, weight: 1 },
    { id: 'b', title: 'High weight', description: 'd', required: true, weight: 3 },
  ],
};

const choice: ChoiceQuestion = {
  id: 'c1',
  domain: 'java-core',
  difficulty: 2,
  type: 'single',
  mode: 'definition',
  prompt: '?',
  tags: [],
  answerGuide: guide,
  options: [
    { id: 'x', text: 'right' },
    { id: 'y', text: 'wrong1' },
    { id: 'z', text: 'wrong2' },
  ],
  correctOptionIds: ['x'],
};

function outcome(score: number, verdict: AnswerOutcome['verdict']): AnswerOutcome {
  return {
    questionId: 'o1',
    domain: 'java-core',
    difficulty: 3,
    tags: [],
    score,
    verdict,
    evaluatedBy: 'server',
    answeredAt: '2026-05-20T00:00:00.000Z',
  };
}

describe('hintsFor', () => {
  test('open: rubric titles, highest weight first, no spoiler text', () => {
    expect(hintsFor(open)).toEqual(['Затронь в ответе: High weight', 'Затронь в ответе: Low weight']);
  });

  test('choice: eliminates wrong options only', () => {
    expect(hintsFor(choice)).toEqual(['Это точно не: «wrong1»', 'Это точно не: «wrong2»']);
  });
});

describe('hintCap', () => {
  test('no cap without hints, then a mild graduated ceiling', () => {
    expect(hintCap(0)).toBe(1);
    expect(hintCap(1)).toBe(0.85);
    expect(hintCap(2)).toBe(0.7);
    expect(hintCap(5)).toBe(0.55);
  });
});

describe('applyHintPenalty', () => {
  test('caps the score but leaves the verdict untouched', () => {
    const result = applyHintPenalty(outcome(1, 'correct'), 1);
    expect(result.score).toBe(0.85);
    expect(result.verdict).toBe('correct');
  });

  test('is a no-op when no hints were used', () => {
    const o = outcome(1, 'correct');
    expect(applyHintPenalty(o, 0)).toBe(o);
  });

  test('is a no-op when the score is already at or below the cap', () => {
    const o = outcome(0.5, 'partial');
    expect(applyHintPenalty(o, 1)).toBe(o);
  });
});
