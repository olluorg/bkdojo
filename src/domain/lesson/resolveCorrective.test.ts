import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import type { OpenQuestion } from '../models/question';
import type { CorrectiveNeed } from './correctiveRound';
import { resolveCorrectiveItems } from './resolveCorrective';
import { choiceQ, openQ } from './questionFixtures';

function deps(index: ReturnType<typeof buildContentIndex>, over: Partial<Parameters<typeof resolveCorrectiveItems>[1]> = {}) {
  const persisted: OpenQuestion[] = [];
  const base = {
    index,
    method: 'manual' as const,
    persist: (q: any) => persisted.push(q),
    ...over,
  };
  return { base, persisted };
}

describe('resolveCorrectiveItems', () => {
  test('retry need plays the same question again', async () => {
    const src = openQ('src');
    const index = buildContentIndex([src]);
    const needs: CorrectiveNeed[] = [{ kind: 'retry', questionId: 'src' }];
    const { base } = deps(index, { generate: async () => undefined });

    const items = await resolveCorrectiveItems(needs, base);
    expect(items.map((i) => i.question.id)).toEqual(['src']);
  });

  test('follow-up uses a bank match and does not generate', async () => {
    const src = openQ('src', { tags: ['t'], rubricIds: ['gap'] });
    const bank = openQ('bank', { rubricIds: ['gap'] });
    const index = buildContentIndex([src, bank]);
    const needs: CorrectiveNeed[] = [{ kind: 'followup', questionId: 'src', conceptId: 'gap' }];
    let generated = 0;
    const { base } = deps(index, {
      generate: async () => {
        generated += 1;
        return undefined;
      },
    });

    const items = await resolveCorrectiveItems(needs, base);
    expect(items.map((i) => i.question.id)).toEqual(['bank']);
    expect(generated).toBe(0);
  });

  test('follow-up generates and persists when the bank has nothing', async () => {
    const src = openQ('src', { rubricIds: ['gap'] });
    const index = buildContentIndex([src]);
    const fresh = openQ('gen-src-gap', { rubricIds: ['gap'] });
    const needs: CorrectiveNeed[] = [{ kind: 'followup', questionId: 'src', conceptId: 'gap' }];
    const { base, persisted } = deps(index, { generate: async () => fresh });

    const items = await resolveCorrectiveItems(needs, base);
    expect(items.map((i) => i.question.id)).toEqual(['gen-src-gap']);
    expect(persisted.map((q) => q.id)).toEqual(['gen-src-gap']);
  });

  test('follow-up falls back to the source when nothing can be found or generated', async () => {
    const src = openQ('src', { rubricIds: ['gap'] });
    const index = buildContentIndex([src]);
    const needs: CorrectiveNeed[] = [{ kind: 'followup', questionId: 'src', conceptId: 'gap' }];
    const { base, persisted } = deps(index, { generate: async () => undefined });

    const items = await resolveCorrectiveItems(needs, base);
    expect(items.map((i) => i.question.id)).toEqual(['src']);
    expect(persisted).toHaveLength(0);
  });

  test('unknown question ids are skipped', async () => {
    const index = buildContentIndex([choiceQ('only')]);
    const needs: CorrectiveNeed[] = [{ kind: 'retry', questionId: 'ghost' }];
    const { base } = deps(index, { generate: async () => undefined });

    expect(await resolveCorrectiveItems(needs, base)).toEqual([]);
  });
});
