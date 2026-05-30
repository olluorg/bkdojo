import { describe, expect, test } from 'bun:test';
import type { LanguageModelStatic } from '../../types/chrome-ai';
import { FreeformUnavailableError, runFreeformChat, type ChatMessage } from './freeformAi';

function mockModel(reply: string, available = true): LanguageModelStatic {
  return {
    availability: () => Promise.resolve(available ? 'available' : 'unavailable'),
    create: () => Promise.resolve({ prompt: () => Promise.resolve(reply), destroy: () => {} }),
  };
}

const turn: ChatMessage[] = [{ role: 'user', content: 'почему так?' }];

describe('runFreeformChat', () => {
  test('uses Chrome AI when available', async () => {
    const result = await runFreeformChat('sys', turn, {
      getModel: () => mockModel('ответ модели'),
      method: 'chrome',
    });
    expect(result.source).toBe('chrome-prompt');
    expect(result.text).toBe('ответ модели');
  });

  test('falls back to the server proxy when Chrome AI is unavailable (auto)', async () => {
    let sentBody = '';
    let sentKey = '';
    const result = await runFreeformChat(
      'sys',
      [
        { role: 'user', content: 'вопрос 1' },
        { role: 'assistant', content: 'ответ 1' },
        { role: 'user', content: 'вопрос 2' },
      ],
      {
        getModel: () => undefined,
        endpoint: 'https://example.test/functions/llm',
        apiKey: 'sk-test',
        method: 'auto',
        fetchFn: async (_url, init) => {
          sentBody = String(init?.body ?? '');
          sentKey = new Headers(init?.headers).get('x-provider-key') ?? '';
          return new Response(
            JSON.stringify({ choices: [{ message: { content: 'ответ сервера' } }] }),
            { status: 200 },
          );
        },
      },
    );
    expect(result.source).toBe('server');
    expect(result.text).toBe('ответ сервера');
    expect(sentKey).toBe('sk-test');
    // The transcript is flattened into the user message for the server path.
    expect(sentBody).toContain('вопрос 1');
    expect(sentBody).toContain('ответ 1');
    expect(sentBody).toContain('вопрос 2');
  });

  test('throws when no channel is available', async () => {
    await expect(
      runFreeformChat('sys', turn, { getModel: () => undefined, endpoint: '', method: 'auto' }),
    ).rejects.toBeInstanceOf(FreeformUnavailableError);
  });

  test('manual method never calls AI', async () => {
    await expect(
      runFreeformChat('sys', turn, {
        getModel: () => mockModel('ignored'),
        endpoint: 'https://example.test/eval',
        method: 'manual',
        fetchFn: async () => new Response('ignored', { status: 200 }),
      }),
    ).rejects.toBeInstanceOf(FreeformUnavailableError);
  });
});
