import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import type { AnswerOutcome } from '../models/answer';
import { buildMockInterview, interviewLevel, summarizeInterview } from './mockInterview';

const index = buildContentIndex(loadContent().questions);
const rng = () => 0;

function outcome(score: number): AnswerOutcome {
  return {
    questionId: 'q',
    domain: 'java-core',
    difficulty: 3,
    tags: [],
    score,
    verdict: score >= 1 ? 'correct' : score > 0 ? 'partial' : 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-22T00:00:00.000Z',
  };
}

describe('buildMockInterview', () => {
  test('returns questions from the domain, ramped easy → hard', () => {
    const session = buildMockInterview(index, 'java-core', { size: 6, rng });
    expect(session.items).toHaveLength(6);
    expect(session.items.every((i) => i.question.domain === 'java-core')).toBe(true);

    const diffs = session.items.map((i) => i.question.difficulty);
    expect([...diffs].sort((a, b) => a - b)).toEqual(diffs);

    const ids = new Set(session.items.map((i) => i.question.id));
    expect(ids.size).toBe(6);
  });
});

describe('interviewLevel', () => {
  test('maps average score to a level', () => {
    expect(interviewLevel(0.2)).toBe('junior');
    expect(interviewLevel(0.5)).toBe('middle');
    expect(interviewLevel(0.75)).toBe('senior');
    expect(interviewLevel(0.95)).toBe('architect');
  });
});

describe('summarizeInterview', () => {
  test('counts correct answers and averages the score', () => {
    const summary = summarizeInterview([outcome(1), outcome(0.5), outcome(0)]);
    expect(summary.total).toBe(3);
    expect(summary.correct).toBe(1);
    expect(summary.avgScore).toBeCloseTo(0.5);
    expect(summary.level).toBe('middle');
  });
});
