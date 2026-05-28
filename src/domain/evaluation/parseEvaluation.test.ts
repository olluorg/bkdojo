import { describe, expect, test } from 'bun:test';
import type { OpenQuestion } from '../models/question';
import { EvaluationParseError, parseEvaluation } from './parseEvaluation';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function question(): OpenQuestion {
  return {
    id: 'o',
    domain: 'java-core',
    difficulty: 3,
    type: 'open',
    mode: 'definition',
    prompt: '?',
    tags: [],
    answerGuide: guide,
    rubric: [
      { id: 'c1', title: 'C1', description: 'd', required: true, weight: 1 },
      { id: 'c2', title: 'C2', description: 'd', required: true, weight: 1 },
    ],
  };
}

describe('parseEvaluation', () => {
  test('full coverage → score 1, correct', () => {
    const raw = JSON.stringify({
      concepts: [
        { conceptId: 'c1', coverage: 'covered' },
        { conceptId: 'c2', coverage: 'covered', comment: 'nice' },
      ],
      feedback: 'good',
      suggestedLevel: 4,
    });
    const result = parseEvaluation(raw, question());
    expect(result.source).toBe('chrome-prompt');
    expect(result.score).toBe(1);
    expect(result.verdict).toBe('correct');
    expect(result.strengths).toEqual(['c1', 'c2']);
    expect(result.suggestedLevel).toBe(4);
    expect(result.concepts.find((c) => c.conceptId === 'c2')?.comment).toBe('nice');
  });

  test('concepts absent from the response default to missing', () => {
    const raw = JSON.stringify({ concepts: [{ conceptId: 'c1', coverage: 'covered' }], feedback: '' });
    const result = parseEvaluation(raw, question());
    expect(result.score).toBeCloseTo(0.5);
    expect(result.verdict).toBe('partial'); // c2 is required and missing
    expect(result.gaps).toEqual(['c2']);
  });

  test('handles JSON wrapped in a markdown code fence', () => {
    const raw = '```json\n{"concepts":[{"conceptId":"c1","coverage":"covered"}],"feedback":"ok"}\n```';
    expect(parseEvaluation(raw, question()).concepts.find((c) => c.conceptId === 'c1')?.coverage).toBe(
      'covered',
    );
  });

  test('handles JSON surrounded by prose', () => {
    const raw = 'Вот оценка: {"concepts":[{"conceptId":"c1","coverage":"covered"}],"feedback":"ok"} — всё.';
    expect(parseEvaluation(raw, question()).verdict).toBe('partial'); // c2 still missing
  });

  test('throws on non-JSON output', () => {
    expect(() => parseEvaluation('not json', question())).toThrow(EvaluationParseError);
  });

  test('throws when concepts is missing', () => {
    expect(() => parseEvaluation(JSON.stringify({ feedback: 'x' }), question())).toThrow(
      EvaluationParseError,
    );
  });
});
