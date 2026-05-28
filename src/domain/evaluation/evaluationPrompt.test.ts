import { describe, expect, test } from 'bun:test';
import type { OpenQuestion } from '../models/question';
import { buildEvaluationPrompt } from './evaluationPrompt';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function open(overrides: Partial<OpenQuestion> = {}): OpenQuestion {
  return {
    id: 'o',
    domain: 'java-core',
    difficulty: 3,
    type: 'open',
    mode: 'definition',
    prompt: 'prompt?',
    tags: [],
    answerGuide: guide,
    rubric: [{ id: 'c1', title: 'C1', description: 'd', required: true, weight: 1 }],
    ...overrides,
  };
}

describe('buildEvaluationPrompt', () => {
  test('plain open question asks for an answer', () => {
    const { user } = buildEvaluationPrompt({ question: open(), answer: 'a' });
    expect(user).toContain('Ответ кандидата:');
    expect(user).not.toContain('задача на код');
  });

  test('code question mentions the language and asks for a solution', () => {
    const { user } = buildEvaluationPrompt({
      question: open({ mode: 'live_coding', language: 'java' }),
      answer: 'class X {}',
    });
    expect(user).toContain('язык: java');
    expect(user).toContain('Решение кандидата:');
  });

  test('system prompt forbids reference-similarity scoring', () => {
    const { system } = buildEvaluationPrompt({ question: open(), answer: 'a' });
    // The evaluator must judge content vs description, not similarity to any reference.
    expect(system).toMatch(/Эталона/);
    expect(system).toMatch(/парафраз/);
    // And it must carry a calibration example so the model knows what "covered" looks like.
    expect(system).toMatch(/Пример/);
  });
});
