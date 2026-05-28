import { describe, expect, test } from 'bun:test';
import { loadGlossary } from './glossaryLoader';

describe('seed glossary', () => {
  test('all bundled terms are valid', () => {
    const { terms, issues } = loadGlossary();
    expect(issues).toEqual([]);
    expect(terms.length).toBeGreaterThanOrEqual(30);
  });

  test('covers the requested core terms', () => {
    const ids = new Set(loadGlossary().terms.map((t) => t.id));
    for (const id of ['volatile', 'acid', 'cap', 'aop', 'btree', 'gin', 'spgist', 'faas', 'saas', 'gc']) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test('term ids are unique', () => {
    const terms = loadGlossary().terms;
    expect(new Set(terms.map((t) => t.id)).size).toBe(terms.length);
  });
});
