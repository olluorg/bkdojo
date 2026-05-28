import { describe, expect, test } from 'bun:test';
import { DOMAINS } from '../models/common';
import { loadContent } from './contentLoader';
import { buildContentIndex, getByDomain, getById, getByDomainDifficulty } from './contentIndex';

describe('seed content', () => {
  test('all bundled questions are valid (no issues)', () => {
    const { questions, issues } = loadContent();
    expect(issues).toEqual([]);
    expect(questions.length).toBeGreaterThanOrEqual(12);
  });

  test('every domain has a healthy pool of questions', () => {
    const index = buildContentIndex(loadContent().questions);
    for (const domain of DOMAINS) {
      expect(getByDomain(index, domain).length).toBeGreaterThanOrEqual(6);
    }
  });

  test('index resolves by id and by domain+difficulty', () => {
    const index = buildContentIndex(loadContent().questions);

    const found = getById(index, 'jc-001');
    expect(found?.domain).toBe('java-core');

    const bucket = getByDomainDifficulty(index, 'java-core', 1);
    expect(bucket.some((q) => q.id === 'jc-001')).toBe(true);

    // empty bucket falls back to []
    expect(getByDomainDifficulty(buildContentIndex([]), 'databases', 5)).toEqual([]);
  });

  test('question ids are globally unique', () => {
    const { questions } = loadContent();
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });

  test('concept titles are indexed from open-question rubrics', () => {
    const index = buildContentIndex(loadContent().questions);
    // jc-021 (open) rubric concept "treeify" → title "Tree bins"
    expect(index.conceptTitles.get('treeify')).toBe('Tree bins');
  });
});
