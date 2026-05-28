import { describe, expect, test } from 'bun:test';
import type { LanguageModelStatic } from '../../types/chrome-ai';
import type { AiAvailability } from '../models/evaluation';
import type { ChoiceQuestion, OpenQuestion } from '../models/question';
import { ChromePromptEvaluator } from './ChromePromptEvaluator';
import { ManualFallbackEvaluator } from './ManualFallbackEvaluator';
import { RuleBasedFallbackEvaluator } from './RuleBasedFallbackEvaluator';
import { evaluateAnswer, skipAnswer, submitManualAssessment } from './evaluationService';

const guide = { short: '', normal: '', traps: [], followUps: [] };

function choiceQuestion(): ChoiceQuestion {
  return {
    id: 'c',
    domain: 'java-core',
    difficulty: 2,
    type: 'single',
    mode: 'definition',
    prompt: '?',
    tags: ['t'],
    answerGuide: guide,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionIds: ['a'],
  };
}

function openQuestion(): OpenQuestion {
  return {
    id: 'o',
    domain: 'databases',
    difficulty: 3,
    type: 'open',
    mode: 'definition',
    prompt: '?',
    tags: ['t'],
    answerGuide: guide,
    rubric: [
      { id: 'c1', title: 'C1', description: 'd', required: true, weight: 1, keywords: ['alpha'] },
      { id: 'c2', title: 'C2', description: 'd', required: true, weight: 1, keywords: ['beta'] },
    ],
  };
}

function mockModel(availability: AiAvailability, reply: string): LanguageModelStatic {
  return {
    availability: () => Promise.resolve(availability),
    create: () => Promise.resolve({ prompt: () => Promise.resolve(reply), destroy: () => {} }),
  };
}

const fullCoverageReply = JSON.stringify({
  concepts: [
    { conceptId: 'c1', coverage: 'covered' },
    { conceptId: 'c2', coverage: 'covered' },
  ],
  feedback: 'ok',
});

describe('evaluateAnswer', () => {
  test('choice question is scored locally', async () => {
    const result = await evaluateAnswer(choiceQuestion(), {
      questionId: 'c',
      type: 'single',
      selectedOptionIds: ['a'],
    });
    expect(result.kind).toBe('outcome');
    if (result.kind !== 'outcome') return;
    expect(result.outcome.evaluatedBy).toBe('local-choice');
    expect(result.outcome.score).toBe(1);
    expect(result.outcome.evaluation).toBeUndefined();
  });

  test('open question uses Chrome AI when available', async () => {
    const chrome = new ChromePromptEvaluator({
      getModel: () => mockModel('available', fullCoverageReply),
      timeoutMs: 1000,
    });
    const result = await evaluateAnswer(
      openQuestion(),
      { questionId: 'o', type: 'open', text: 'alpha beta' },
      { resolver: { evaluators: [chrome, new ManualFallbackEvaluator()] } },
    );
    expect(result.kind).toBe('outcome');
    if (result.kind !== 'outcome') return;
    expect(result.outcome.evaluatedBy).toBe('chrome-prompt');
    expect(result.outcome.verdict).toBe('correct');
  });

  test('falls back to the next evaluator when Chrome fails', async () => {
    const chrome = new ChromePromptEvaluator({
      getModel: () => mockModel('available', 'garbage-not-json'),
      timeoutMs: 1000,
    });
    const result = await evaluateAnswer(
      openQuestion(),
      { questionId: 'o', type: 'open', text: 'alpha beta' },
      { resolver: { evaluators: [chrome, new RuleBasedFallbackEvaluator()] } },
    );
    expect(result.kind).toBe('outcome');
    if (result.kind !== 'outcome') return;
    expect(result.outcome.evaluatedBy).toBe('rule-based');
    expect(result.outcome.verdict).toBe('correct'); // keywords alpha + beta matched
  });

  test('requests manual self-assessment when AI is unavailable', async () => {
    const chrome = new ChromePromptEvaluator({
      getModel: () => mockModel('unavailable', '{}'),
      timeoutMs: 1000,
    });
    const result = await evaluateAnswer(
      openQuestion(),
      { questionId: 'o', type: 'open', text: 'whatever' },
      { resolver: { evaluators: [chrome, new ManualFallbackEvaluator()] } },
    );
    expect(result.kind).toBe('manual');
    if (result.kind !== 'manual') return;
    expect(result.evaluation.status).toBe('manual_required');
  });
});

describe('skipAnswer', () => {
  test('"I don\'t know" records an incorrect, skipped outcome', () => {
    const outcome = skipAnswer(openQuestion());
    expect(outcome.evaluatedBy).toBe('skipped');
    expect(outcome.verdict).toBe('incorrect');
    expect(outcome.score).toBe(0);
    expect(outcome.evaluation).toBeUndefined();
  });
});

describe('submitManualAssessment', () => {
  test('turns self-assessment into an outcome', async () => {
    const outcome = await submitManualAssessment(openQuestion(), 'my answer', {
      coveredConceptIds: ['c1'],
      selfScore: 0.5,
    });
    expect(outcome.evaluatedBy).toBe('manual');
    expect(outcome.score).toBeCloseTo(0.5);
    expect(outcome.verdict).toBe('partial'); // c2 required but not covered
  });
});
