import { describe, expect, test } from 'bun:test';
import type { GlossaryTerm } from '../models/glossary';
import { buildCandidates, findTermMatches } from './termHighlight';

function term(over: Partial<GlossaryTerm> & { id: string; term: string }): GlossaryTerm {
  return { domain: 'java-core', level: 1, definition: 'd', ...over };
}

describe('findTermMatches', () => {
  test('finds a term as a whole word, case-insensitive', () => {
    const c = buildCandidates([term({ id: 'jvm', term: 'JVM' })]);
    const m = findTermMatches('Что такое jvm и зачем нужен JVM?', c);
    expect(m).toHaveLength(1);
    expect(m[0]!.start).toBe(10);
    expect(m[0]!.end).toBe(13);
    expect(m[0]!.term.id).toBe('jvm');
  });

  test('respects word boundaries for ASCII and Cyrillic', () => {
    const c = buildCandidates([term({ id: 'cas', term: 'CAS' })]);
    // не должно матчить внутри слова "CASCADE" или "касание"
    const m = findTermMatches('CASCADE и касание не считаются — CAS — да', c);
    expect(m).toHaveLength(1);
    expect('CASCADE и касание не считаются — '.length).toBe(m[0]!.start);
  });

  test('aliases match and resolve to the same term', () => {
    const t = term({ id: 'lru', term: 'LRU-кэш', aliases: ['LRU', 'Least Recently Used'] });
    const c = buildCandidates([t]);
    const m = findTermMatches('Стратегия Least Recently Used часто называется LRU', c);
    // только ОДНО подсвечивание (один и тот же term)
    expect(m).toHaveLength(1);
    // и победил более длинный алиас
    expect(m[0]!.end - m[0]!.start).toBe('Least Recently Used'.length);
  });

  test('longer candidate wins over shorter overlapping one', () => {
    const cas = term({ id: 'cas', term: 'CAS' });
    const casLong = term({ id: 'cas-long', term: 'compare-and-swap' });
    const c = buildCandidates([cas, casLong]);
    const m = findTermMatches('Атомарная инструкция compare-and-swap, она же CAS', c);
    // оба разных термина подсветятся, но НЕ внутри длинного матча
    expect(m).toHaveLength(2);
    const ids = m.map((x) => x.term.id).sort();
    expect(ids).toEqual(['cas', 'cas-long']);
  });

  test('matches do not overlap', () => {
    const heap = term({ id: 'binary-heap', term: 'двоичная куча', aliases: ['binary heap'] });
    const c = buildCandidates([heap]);
    const m = findTermMatches('двоичная куча — это binary heap по сути', c);
    // один термин — одно подсвечивание (правило first-per-term)
    expect(m).toHaveLength(1);
  });

  test('returns matches sorted by start position', () => {
    const a = term({ id: 'a', term: 'foo' });
    const b = term({ id: 'b', term: 'bar' });
    const c = buildCandidates([a, b]);
    const m = findTermMatches('bar потом foo', c);
    expect(m.map((x) => x.term.id)).toEqual(['b', 'a']);
  });

  test('empty inputs return empty list', () => {
    expect(findTermMatches('', buildCandidates([term({ id: 'a', term: 'foo' })]))).toEqual([]);
    expect(findTermMatches('foo', buildCandidates([]))).toEqual([]);
  });
});
