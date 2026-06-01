import type { UserProgress } from '../models/progress';

/**
 * Lesson bookmarks — lessons the learner has saved to re-read and give more
 * attention later. Independent of read/completion state: a learner can bookmark
 * a tricky lesson they've already passed, or one they haven't opened yet.
 * We store the timestamp so the list can be ordered most-recent-first.
 * All folds are pure (no mutation).
 */

export function isLessonBookmarked(progress: UserProgress, lessonId: string): boolean {
  return Boolean(progress.lessonBookmarks?.[lessonId]);
}

/**
 * Bookmarked lesson ids, most recently bookmarked first.
 */
export function bookmarkedLessonIds(progress: UserProgress): string[] {
  const marks = progress.lessonBookmarks ?? {};
  return Object.keys(marks).sort((a, b) => (marks[b] ?? '').localeCompare(marks[a] ?? ''));
}

/** Bookmarks a lesson (records `now`) or removes the bookmark (drops the entry to stay tidy). */
export function setLessonBookmark(
  progress: UserProgress,
  lessonId: string,
  bookmarked: boolean,
  now: Date = new Date(),
): UserProgress {
  const current = progress.lessonBookmarks ?? {};
  if (bookmarked) {
    return { ...progress, lessonBookmarks: { ...current, [lessonId]: now.toISOString() } };
  }
  if (!(lessonId in current)) return progress;
  const next = { ...current };
  delete next[lessonId];
  return { ...progress, lessonBookmarks: next };
}
