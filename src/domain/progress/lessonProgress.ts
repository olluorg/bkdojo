import type { UserProgress } from '../models/progress';

/**
 * Lesson read/completion state. A lesson is "read" once the learner explicitly
 * marks it done; we store the timestamp so it can also feed daily/streak views.
 * All folds are pure (no mutation).
 */

export function isLessonRead(progress: UserProgress, lessonId: string): boolean {
  return Boolean(progress.lessonsRead?.[lessonId]);
}

export function lessonReadAt(progress: UserProgress, lessonId: string): string | undefined {
  return progress.lessonsRead?.[lessonId];
}

export function countLessonsRead(progress: UserProgress, lessonIds: string[]): number {
  return lessonIds.filter((id) => isLessonRead(progress, id)).length;
}

/** Marks a lesson read (records `now`) or unread (drops the entry to stay tidy). */
export function setLessonRead(
  progress: UserProgress,
  lessonId: string,
  read: boolean,
  now: Date = new Date(),
): UserProgress {
  const current = progress.lessonsRead ?? {};
  if (read) {
    return { ...progress, lessonsRead: { ...current, [lessonId]: now.toISOString() } };
  }
  if (!(lessonId in current)) return progress;
  const next = { ...current };
  delete next[lessonId];
  return { ...progress, lessonsRead: next };
}
