import type { UserProgress } from '../models/progress';

/**
 * Which topics the learner has actually defended (see `domain/lesson/defense`).
 *
 * Stored as an optional map, so saves made before defenses existed still load:
 * those learners simply have nothing defended yet and see their lessons as
 * "готово к защите" rather than being silently demoted from "пройдено".
 */

export function isLessonDefended(progress: UserProgress, lessonId: string): boolean {
  return Boolean(progress.defendedLessons?.[lessonId]);
}

/** Records a passed defense. Idempotent — the first defense keeps its date. */
export function markLessonDefended(
  progress: UserProgress,
  lessonId: string,
  now: Date = new Date(),
): UserProgress {
  if (isLessonDefended(progress, lessonId)) return progress;
  return {
    ...progress,
    defendedLessons: { ...(progress.defendedLessons ?? {}), [lessonId]: now.toISOString() },
  };
}

export function defendedLessonIds(progress: UserProgress): string[] {
  return Object.keys(progress.defendedLessons ?? {});
}
