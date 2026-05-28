import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { loadLessons } from '../content/lessonLoader';
import { buildConceptLessonMap } from './conceptLessons';

describe('buildConceptLessonMap', () => {
  const map = buildConceptLessonMap(
    buildContentIndex(loadContent().questions),
    loadLessons().lessons,
  );

  test('links a concept to a lesson whose tags match its question', () => {
    // jc-021 "treeify" is tagged collections/hashmap/hashcode → a matching collections lesson
    const lessonId = map.get('treeify');
    expect(lessonId).toBeDefined();
    const lesson = loadLessons().lessons.find((l) => l.id === lessonId);
    const wanted = new Set(['collections', 'hashmap', 'hashcode']);
    expect(lesson?.relatedTags?.some((t) => wanted.has(t))).toBe(true);
  });

  test('every mapped lesson id is non-empty', () => {
    for (const lessonId of map.values()) expect(lessonId.length).toBeGreaterThan(0);
  });
});
