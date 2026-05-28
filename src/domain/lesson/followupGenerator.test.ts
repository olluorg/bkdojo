import { describe, expect, test } from 'bun:test';
import type { FreeformResult } from '../evaluation/freeformAi';
import { followupId, generateFollowupQuestion } from './followupGenerator';
import { openQ } from './questionFixtures';

const VALID = JSON.stringify({
  prompt: 'Что значит immutable?',
  concept: { title: 'Immutability', description: 'объект нельзя изменить после создания' },
  answerGuide: {
    short: 'нельзя менять состояние',
    normal: 'состояние фиксируется в конструкторе и далее не меняется',
    traps: ['путать с final-полем'],
    followUps: ['как сделать класс immutable?'],
  },
});

function run(text: string) {
  return async (): Promise<FreeformResult> => ({ source: 'server', text });
}

describe('generateFollowupQuestion', () => {
  test('assembles a valid AI-generated open question focused on the concept', async () => {
    const source = openQ('src', { difficulty: 3, tags: ['t'] });
    const q = await generateFollowupQuestion(source, 'gap', 'Immutability', {
      method: 'server',
      run: run(VALID),
    });

    expect(q).toBeDefined();
    expect(q!.id).toBe(followupId('src', 'gap'));
    expect(q!.type).toBe('open');
    expect(q!.difficulty).toBe(2); // one notch easier than the source
    expect(q!.tags).toEqual(['t']);
    expect(q!.rubric).toHaveLength(1);
    expect(q!.rubric[0]!.id).toBe('gap');
    expect(q!.meta?.source).toBe('ai-generated');
  });

  test('clamps difficulty at 1', async () => {
    const source = openQ('src', { difficulty: 1 });
    const q = await generateFollowupQuestion(source, 'gap', 'X', { method: 'server', run: run(VALID) });
    expect(q!.difficulty).toBe(1);
  });

  test('parses JSON wrapped in a code fence', async () => {
    const source = openQ('src');
    const q = await generateFollowupQuestion(source, 'gap', 'X', {
      method: 'server',
      run: run('```json\n' + VALID + '\n```'),
    });
    expect(q).toBeDefined();
  });

  test('returns undefined on unusable output', async () => {
    const source = openQ('src');
    expect(
      await generateFollowupQuestion(source, 'gap', 'X', { method: 'server', run: run('not json') }),
    ).toBeUndefined();
  });

  test('returns undefined when required fields are missing', async () => {
    const source = openQ('src');
    const missing = JSON.stringify({ concept: { title: 't', description: 'd' } });
    expect(
      await generateFollowupQuestion(source, 'gap', 'X', { method: 'server', run: run(missing) }),
    ).toBeUndefined();
  });

  test('returns undefined when the AI channel throws', async () => {
    const source = openQ('src');
    const q = await generateFollowupQuestion(source, 'gap', 'X', {
      method: 'server',
      run: async () => {
        throw new Error('no channel');
      },
    });
    expect(q).toBeUndefined();
  });
});
