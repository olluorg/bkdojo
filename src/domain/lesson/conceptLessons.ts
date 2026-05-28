import type { ContentIndex } from '../content/contentIndex';
import type { Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import { isOpenQuestion } from '../models/question';

/**
 * Maps a rubric concept id → the lesson that teaches it. Prefers the lesson that
 * explicitly owns the concept's question (`questionIds`), falling back to
 * matching the question's tags against lesson `relatedTags` within the same
 * domain. Lets the UI link a weak concept straight to the relevant lesson.
 */
export function buildConceptLessonMap(
  index: ContentIndex,
  lessons: Lesson[],
): Map<string, string> {
  const byDomain = new Map<Domain, Lesson[]>();
  for (const lesson of lessons) {
    const bucket = byDomain.get(lesson.domain) ?? [];
    bucket.push(lesson);
    byDomain.set(lesson.domain, bucket);
  }

  const map = new Map<string, string>();
  for (const question of index.all) {
    if (!isOpenQuestion(question)) continue;
    const domainLessons = byDomain.get(question.domain) ?? [];
    const tags = new Set(question.tags);
    for (const concept of question.rubric) {
      if (map.has(concept.id)) continue;
      const lesson =
        domainLessons.find((l) => l.questionIds?.includes(question.id)) ??
        domainLessons.find((l) => (l.relatedTags ?? []).some((t) => tags.has(t)));
      if (lesson) map.set(concept.id, lesson.id);
    }
  }
  return map;
}
