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

function deps(over: Partial<ServerDeps>): ServerDeps {
  return { endpoint: '/api/evaluate', timeoutMs: 1000, fetchFn: () => Promise.resolve(new Response('{}')), ...over };
}

describe('ServerAiEvaluator', () => {
  test('availability reflects whether an endpoint is configured', async () => {
    expect(await new ServerAiEvaluator(deps({ endpoint: '' })).availability()).toBe('unavailable');
    expect(await new ServerAiEvaluator(deps({ endpoint: '/api/evaluate' })).availability()).toBe(
      'available',
    );
  });

  test('parses a successful server response (source = server)', async () => {
    const reply = JSON.stringify({
      concepts: [{ conceptId: 'c1', coverage: 'covered' }],
      feedback: 'ok',
    });
    const evaluator = new ServerAiEvaluator(
      deps({ fetchFn: () => Promise.resolve(new Response(reply, { status: 200 })) }),
    );
    const result = await evaluator.evaluate(input());
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
});
