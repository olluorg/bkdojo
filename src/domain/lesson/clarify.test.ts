import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ConceptCoverage, EvaluationResult, Verdict } from '../models/evaluation';
import type { OpenQuestion } from '../models/question';
import {
  BRIEF_WORD_LIMIT,
  combineAnswers,
  fallbackHint,
  pickBetterOutcome,
  shouldClarify,
} from './clarify';

function evaluation(
  verdict: Verdict,
  concepts: { conceptId: string; coverage: ConceptCoverage }[] = [],
): EvaluationResult {
  return {
    source: 'chrome-prompt',
    status: 'ok',
    score: verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0,
    verdict,
    concepts,
    strengths: [],
    gaps: [],
    feedback: '',
  };
}

function outcome(score: number): AnswerOutcome {
  return {
    questionId: 'q',
    domain: 'java-core',
    difficulty: 2,
    tags: [],
    score,
    verdict: score >= 0.7 ? 'correct' : score > 0 ? 'partial' : 'incorrect',
    evaluatedBy: 'chrome-prompt',
    answeredAt: '2026-01-01T00:00:00Z',
  };
}

describe('shouldClarify', () => {
  test('probes a brief but on-track (partial) answer', () => {
    expect(shouldClarify('коротко', evaluation('partial'))).toBe(true);
  });

  test('probes a brief correct answer to verify depth', () => {
    expect(shouldClarify('да, immutable', evaluation('correct'))).toBe(true);
  });

  test('does not probe a clearly wrong answer', () => {
    expect(shouldClarify('коротко', evaluation('incorrect'))).toBe(false);
  });

  test('probes a long near-miss (partial) — the "almost" second chance', () => {
    const long = Array.from({ length: BRIEF_WORD_LIMIT + 5 }, (_, i) => `слово${i}`).join(' ');
    expect(shouldClarify(long, evaluation('partial'))).toBe(true);
  });

  test('does not probe a long, detailed correct answer', () => {
    const long = Array.from({ length: BRIEF_WORD_LIMIT + 5 }, (_, i) => `слово${i}`).join(' ');
    expect(shouldClarify(long, evaluation('correct'))).toBe(false);
  });

  test('does not probe without an evaluation', () => {
    expect(shouldClarify('коротко', undefined)).toBe(false);
  });
});

describe('fallbackHint', () => {
  const question = {
    id: 'q',
    domain: 'java-core',
    difficulty: 2,
    tags: [],
    type: 'open',
    prompt: 'Что такое volatile?',
    rubric: [
      { id: 'c-visibility', title: 'Видимость между потоками' },
      { id: 'c-atomicity', title: 'Не гарантирует атомарность' },
    ],
    answerGuide: { summary: '', points: [] },
  } as unknown as OpenQuestion;

  test('names the weakest uncovered aspect without revealing the answer', () => {
    const ev = evaluation('partial', [
      { conceptId: 'c-visibility', coverage: 'covered' },
      { conceptId: 'c-atomicity', coverage: 'missing' },
    ]);
    const hint = fallbackHint(question, ev);
    expect(hint).toContain('Не гарантирует атомарность');
    expect(hint).not.toContain('volatile'); // the prompt's term/answer isn't echoed
  });
});

describe('combineAnswers', () => {
  test('merges the original answer with the clarification', () => {
    expect(combineAnswers('  основа  ', '  детали  ')).toBe('основа\n\nУточнение: детали');
  });
});

describe('pickBetterOutcome', () => {
  test('keeps the clarified outcome when it scores at least as high', () => {
    expect(pickBetterOutcome(outcome(0.5), outcome(0.9)).score).toBe(0.9);
    expect(pickBetterOutcome(outcome(0.5), outcome(0.5)).score).toBe(0.5);
  });

  test('never lets probing lower the score', () => {
    const base = outcome(0.8);
    expect(pickBetterOutcome(base, outcome(0.3))).toBe(base);
  });
});
