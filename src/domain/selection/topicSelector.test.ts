import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { buildTopicSession, selectTopicPool } from './topicSelector';

const index = buildContentIndex(loadContent().questions);

describe('buildTopicSession', () => {
  test('filters by tag and stays within the domain', () => {
    const session = buildTopicSession(index, 'java-core', { tags: ['oop'] });
    expect(session.items.length).toBeGreaterThan(0);
    expect(session.items.every((i) => i.question.domain === 'java-core')).toBe(true);
    expect(session.items.some((i) => i.question.id === 'jc-001')).toBe(true);
  });

  test('orders questions easiest-first', () => {
    const items = buildTopicSession(index, 'spring-boot').items;
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.question.difficulty).toBeGreaterThanOrEqual(items[i - 1]!.question.difficulty);
    }
  });

  test('respects the size limit', () => {
    expect(buildTopicSession(index, 'databases', { size: 2 }).items).toHaveLength(2);
  });

  test('falls back to the whole domain when no tag matches', () => {
    const session = buildTopicSession(index, 'java-core', { tags: ['no-such-tag'] });
    expect(session.items.length).toBeGreaterThan(0);
  });

  test('filters by difficulty band (depth)', () => {
    const session = buildTopicSession(index, 'java-core', { difficulties: [1, 2] });
    expect(session.items.length).toBeGreaterThan(0);
    expect(session.items.every((i) => i.question.difficulty <= 2)).toBe(true);
  });

  test('falls back to all difficulties when the band is empty', () => {
    const session = buildTopicSession(index, 'java-core', { difficulties: [] });
    expect(session.items.length).toBeGreaterThan(0);
  });

  test('excludeIds drops already-answered questions', () => {
    const pool = selectTopicPool(index, 'java-core', { tags: ['oop'] });
    const first = pool[0]!.id;
    const session = buildTopicSession(index, 'java-core', {
      tags: ['oop'],
      excludeIds: new Set([first]),
    });
    expect(session.items.some((i) => i.question.id === first)).toBe(false);
  });

  test('excluding the whole pool leaves nothing — exclusion never falls back', () => {
    const pool = selectTopicPool(index, 'java-core', { tags: ['oop'] });
    expect(pool.length).toBeGreaterThan(0);
    const session = buildTopicSession(index, 'java-core', {
      tags: ['oop'],
      excludeIds: new Set(pool.map((q) => q.id)),
    });
    expect(session.items.length).toBe(0);
  });
});

describe('selectTopicPool', () => {
  test('returns the tag-filtered pool before slicing or exclusion', () => {
    const pool = selectTopicPool(index, 'java-core', { tags: ['oop'] });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((q) => q.domain === 'java-core')).toBe(true);
  });
});
