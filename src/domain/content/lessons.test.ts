import { describe, expect, test } from 'bun:test';
import { lessonQuestionIds } from '../progress/lessonStatus';
import { buildContentIndex, getById, getByDomain } from './contentIndex';
import { loadContent } from './contentLoader';
import { loadLessons } from './lessonLoader';

describe('seed lessons', () => {
  test('all bundled lessons are valid', () => {
    const { lessons, issues } = loadLessons();
    expect(issues).toEqual([]);
    expect(lessons.length).toBeGreaterThanOrEqual(10);
  });

  test('every lesson has at least one section', () => {
    for (const lesson of loadLessons().lessons) {
      expect(lesson.sections.length).toBeGreaterThan(0);
    }
  });

  test('every cross-link (related) resolves to an existing lesson', () => {
    const lessons = loadLessons().lessons;
    const ids = new Set(lessons.map((l) => l.id));
    for (const lesson of lessons) {
      for (const relatedId of lesson.related ?? []) {
        expect(ids.has(relatedId)).toBe(true);
      }
    }
  });

  test('relatedTags match real questions so "practice topic" is never empty', () => {
    const index = buildContentIndex(loadContent().questions);
    for (const lesson of loadLessons().lessons) {
      if (!lesson.relatedTags || lesson.relatedTags.length === 0) continue;
      const wanted = new Set(lesson.relatedTags);
      const hasMatch = getByDomain(index, lesson.domain).some((q) =>
        q.tags.some((t) => wanted.has(t)),
      );
      expect(hasMatch).toBe(true);
    }
  });

  test('every explicit questionId resolves to a question in the same domain', () => {
    const index = buildContentIndex(loadContent().questions);
    for (const lesson of loadLessons().lessons) {
      for (const id of lesson.questionIds ?? []) {
        const q = getById(index, id);
        expect(q, `${lesson.id} → ${id}`).toBeDefined();
        expect(q?.domain).toBe(lesson.domain);
      }
    }
  });

  test('a lesson test contains only that lesson\'s own questions (strict scoping)', () => {
    const index = buildContentIndex(loadContent().questions);
    for (const lesson of loadLessons().lessons) {
      if (lesson.questionIds === undefined) continue; // un-migrated domain: tag fallback
      const declared = new Set(lesson.questionIds);
      for (const id of lessonQuestionIds(index, lesson)) {
        expect(declared.has(id), `${lesson.id} leaked off-topic question ${id}`).toBe(true);
      }
    }
  });

  test('every java-core lesson is migrated to explicit questionIds', () => {
    for (const lesson of loadLessons().lessons) {
      if (lesson.domain !== 'java-core') continue;
      expect(Array.isArray(lesson.questionIds), `${lesson.id} missing questionIds`).toBe(true);
    }
  });

  test('regression: primitives test includes Integer-cache but not the generics question', () => {
    const index = buildContentIndex(loadContent().questions);
    const primitives = loadLessons().lessons.find((l) => l.id === 'jc-lesson-primitives')!;
    const ids = new Set(lessonQuestionIds(index, primitives));
    expect(ids.has('jc-005')).toBe(true); // Integer cache & == — on topic
    expect(ids.has('jc-024')).toBe(false); // generics & wildcards — off topic
  });
});
