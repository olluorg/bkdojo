import type { UserProgress } from '../models/progress';

/**
 * Session-level activity log. History records can't tell practice from review
 * from interview (all land as plain answers), so we stamp the completed activity
 * explicitly. This is what the daily mission uses to tick steps off as done.
 */
export type ActivityKind = 'practice' | 'review' | 'interview';

export function activityAt(progress: UserProgress, kind: ActivityKind): string | undefined {
  return progress.activity?.[kind];
}

/** Pure fold: stamps `kind` as completed at `now`. */
export function recordActivity(
  progress: UserProgress,
  kind: ActivityKind,
  now: Date = new Date(),
): UserProgress {
  return {
    ...progress,
    activity: { ...(progress.activity ?? {}), [kind]: now.toISOString() },
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True if `kind` was last done on the same calendar day as `day`. */
export function wasActiveOn(progress: UserProgress, kind: ActivityKind, day: Date): boolean {
  const at = progress.activity?.[kind];
  if (!at) return false;
  const when = new Date(at);
  return !Number.isNaN(when.getTime()) && isSameDay(when, day);
}
