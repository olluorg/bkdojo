import { getByDomain, type ContentIndex } from '../content/contentIndex';
import type { Lesson } from '../models/lesson';
import type { UserProgress } from '../models/progress';
import { isLessonDefended } from './lessonDefense';
import { isLessonRead } from './lessonProgress';

/**
 * Per-lesson completion state used by the Lessons UI.
 *
 * - `needs-work` — read, but some questions are still not correct.
 * - `practiced`  — every question answered correctly at least once, accumulated
 *   across sittings and with hints allowed. Enough to be ready for a defense,
 *   not enough to call the topic closed.
 * - `passed`     — defended: one pass, no hints, everything correct.
 *
 * The split exists because the old cheap rule (`practiced`) was what made
 * "пройдено" feel unearned. See `domain/lesson/defense`.
 */
export type LessonStatus = 'unread' | 'needs-work' | 'practiced' | 'passed';

/** Ids of every question answered correctly at least once. */
export function correctlyAnsweredIds(progress: UserProgress): Set<string> {
  const ids = new Set<string>();
  for (const record of progress.history) {
    if (record.verdict === 'correct') ids.add(record.questionId);
  }
  return ids;
}

/**
 * The practice-question pool of a lesson — the single source of truth shared by
 * the lesson test, status and review.
 *
 * When the lesson declares `questionIds` (even an empty array) that list is
 * authoritative: only those ids are returned (filtered to questions that exist
 * in the domain), with no tag fallback. This is what keeps a lesson's test
 * strictly on-topic. When `questionIds` is omitted, it falls back to questions
 * whose tags intersect `relatedTags` (legacy behaviour for un-migrated domains).
 */
export function lessonQuestionIds(index: ContentIndex, lesson: Lesson): string[] {
  if (lesson.questionIds !== undefined) {
    const inDomain = new Set(getByDomain(index, lesson.domain).map((q) => q.id));
    return lesson.questionIds.filter((id) => inDomain.has(id));
  }
  const tags = lesson.relatedTags ?? [];
  if (tags.length === 0) return [];
  const wanted = new Set(tags);
  return getByDomain(index, lesson.domain)
    .filter((q) => q.tags.some((t) => wanted.has(t)))
    .map((q) => q.id);
}

/**
 * 0..1 — how far the learner has completed THIS lesson's own test: the fraction
 * of its questions (`lessonQuestionIds`) answered correctly at least once.
 *
 * This is *completion*, matching the "✓ Пройдено" badge and the lesson's own
 * questions — deliberately distinct from the spaced-repetition
 * `topicMastery`/`domainMastery`, which need repeated correct answers and drive
 * the course level / rank. The course and lesson PROGRESS bars use this so that
 * reading a lesson and clearing its tasks actually fills the bar.
 */
export function lessonProgress(
  progress: UserProgress,
  index: ContentIndex,
  lesson: Lesson,
): number {
  const ids = lessonQuestionIds(index, lesson);
  if (ids.length === 0) return 1; // nothing to practise → counts as complete
  const correct = correctlyAnsweredIds(progress);
  let done = 0;
  for (const id of ids) if (correct.has(id)) done++;
  return done / ids.length;
}

export function lessonStatus(
  progress: UserProgress,
  index: ContentIndex,
  lesson: Lesson,
): LessonStatus {
  if (!isLessonRead(progress, lesson.id)) return 'unread';

  const poolIds = lessonQuestionIds(index, lesson);
  // Nothing to answer means nothing to defend — reading closes it.
  if (poolIds.length === 0) return 'passed';

  const correct = correctlyAnsweredIds(progress);
  if (!poolIds.every((id) => correct.has(id))) return 'needs-work';

  return isLessonDefended(progress, lesson.id) ? 'passed' : 'practiced';
}
