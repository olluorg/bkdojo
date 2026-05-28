import { describe, expect, test } from 'bun:test';
import type {
  LanguageModelPromptOptions,
  LanguageModelStatic,
} from '../../types/chrome-ai';
import type { AiAvailability, EvaluationInput } from '../models/evaluation';
import type { OpenQuestion } from '../models/question';
import { ChromePromptEvaluator } from './ChromePromptEvaluator';

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
    rubric: [{ id: 'c1', title: 'C1', description: 'd', required: true, weight: 1 }],
  };
}

function input(): EvaluationInput {
  return { question: question(), answer: 'some answer' };
}

interface MockOptions {
  availability?: AiAvailability;
  reply?: string;
  onPrompt?: (input: string, options?: LanguageModelPromptOptions) => Promise<string>;
}

function mockModel(opts: MockOptions): LanguageModelStatic {
  return {
    availability: () => Promise.resolve(opts.availability ?? 'available'),
    create: () =>
      Promise.resolve({
        prompt: (text: string, options?: LanguageModelPromptOptions) =>
          opts.onPrompt ? opts.onPrompt(text, options) : Promise.resolve(opts.reply ?? '{}'),
        destroy: () => {},
      }),
  };
}

describe('ChromePromptEvaluator', () => {
  test('availability reflects the model (and unavailable when absent)', async () => {
    const present = new ChromePromptEvaluator({
      getModel: () => mockModel({ availability: 'downloadable' }),
      timeoutMs: 1000,
    });
    expect(await present.availability()).toBe('downloadable');

    const absent = new ChromePromptEvaluator({ getModel: () => undefined, timeoutMs: 1000 });
    expect(await absent.availability()).toBe('unavailable');
  });

  test('parses a valid structured reply', async () => {
    const reply = JSON.stringify({
      concepts: [{ conceptId: 'c1', coverage: 'covered' }],
      feedback: 'ok',
    });
    const evaluator = new ChromePromptEvaluator({
      getModel: () => mockModel({ reply }),
      timeoutMs: 1000,
    });
    const result = await evaluator.evaluate(input());
    expect(result.source).toBe('chrome-prompt');
    expect(result.verdict).toBe('correct');
  });

  test('throws on unparseable reply', async () => {
    const evaluator = new ChromePromptEvaluator({
      getModel: () => mockModel({ reply: 'garbage' }),
      timeoutMs: 1000,
    });
    expect(evaluator.evaluate(input())).rejects.toThrow();
  });

  test('aborts and throws on timeout', async () => {
    const evaluator = new ChromePromptEvaluator({
      getModel: () =>
        mockModel({
          onPrompt: (_text, options) =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        }),
      timeoutMs: 10,
    });
    expect(evaluator.evaluate(input())).rejects.toThrow();
  });
});
