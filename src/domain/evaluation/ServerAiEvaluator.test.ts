import { describe, expect, test } from 'bun:test';
import type { EvaluationInput } from '../models/evaluation';
import type { OpenQuestion } from '../models/question';
import { ServerAiEvaluator, type ServerDeps } from './ServerAiEvaluator';

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

/** Wraps a model JSON string in the proxy's passthrough chat-completion shape. */
function completion(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function deps(over: Partial<ServerDeps>): ServerDeps {
  return {
    endpoint: 'https://api.test/functions/llm',
    apiKey: 'sk-test',
    baseUrl: 'https://provider.test/v1',
    model: 'test/model',
    timeoutMs: 1000,
    fetchFn: () => Promise.resolve(completion('{}')),
    ...over,
  };
}

describe('ServerAiEvaluator', () => {
  test('availability needs both an endpoint and a provider key', async () => {
    expect(await new ServerAiEvaluator(deps({ endpoint: '' })).availability()).toBe('unavailable');
    expect(await new ServerAiEvaluator(deps({ apiKey: '' })).availability()).toBe('unavailable');
    expect(await new ServerAiEvaluator(deps({})).availability()).toBe('available');
  });

  test('sends the provider key, base URL and model, and parses the passthrough', async () => {
    let sentKey = '';
    let sentBaseUrl = '';
    let sentBody = '';
    const reply = JSON.stringify({
      concepts: [{ conceptId: 'c1', coverage: 'covered' }],
      feedback: 'ok',
    });
    const evaluator = new ServerAiEvaluator(
      deps({
        fetchFn: (_url, init) => {
          const h = new Headers(init?.headers);
          sentKey = h.get('x-provider-key') ?? '';
          sentBaseUrl = h.get('x-provider-base-url') ?? '';
          sentBody = String(init?.body ?? '');
          return Promise.resolve(completion(reply));
        },
      }),
    );
    const result = await evaluator.evaluate(input());
    expect(sentKey).toBe('sk-test');
    expect(sentBaseUrl).toBe('https://provider.test/v1');
    expect(JSON.parse(sentBody).model).toBe('test/model');
    expect(result.source).toBe('server');
    expect(result.verdict).toBe('correct');
  });

  test('throws on a non-ok response (so the resolver falls back)', () => {
    const evaluator = new ServerAiEvaluator(
      deps({ fetchFn: () => Promise.resolve(new Response('nope', { status: 502 })) }),
    );
    expect(evaluator.evaluate(input())).rejects.toThrow();
  });

  test('throws when the endpoint is not configured', () => {
    expect(new ServerAiEvaluator(deps({ endpoint: '' })).evaluate(input())).rejects.toThrow();
  });

  test('throws when the provider key is missing', () => {
    expect(new ServerAiEvaluator(deps({ apiKey: '' })).evaluate(input())).rejects.toThrow();
  });
});
