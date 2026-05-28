import type { UserProgress } from '../models/progress';

const DAY_MS = 86_400_000;

export type StreakState = 'active' | 'at-risk' | 'none';

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Advances the daily streak when an activity happens "now": same day keeps it,
 * the day after extends it, a longer gap restarts at 1. Pure.
 */
export function touchStreak(
  progress: UserProgress,
  now: Date,
): { streakDays: number; lastPracticeDate: string } {
  const today = dayKey(now);
  if (progress.lastPracticeDate === today) {
    return { streakDays: Math.max(progress.streakDays, 1), lastPracticeDate: today };
  }
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
  if (progress.lastPracticeDate === yesterday) {
    return { streakDays: progress.streakDays + 1, lastPracticeDate: today };
  }
  return { streakDays: 1, lastPracticeDate: today };
}

/**
 * Effective streak for display: reflects whether it's still alive *today*.
 * - `active`: practiced today.
 * - `at-risk`: practiced yesterday — keep it alive by practicing today.
 * - `none`: streak is broken (returns 0 days).
 */
export function streakInfo(
  progress: UserProgress,
  now: Date = new Date(),
): { days: number; state: StreakState } {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
  if (progress.lastPracticeDate === today) return { days: progress.streakDays, state: 'active' };
  if (progress.lastPracticeDate === yesterday)
    return { days: progress.streakDays, state: 'at-risk' };
  return { days: 0, state: 'none' };
}
