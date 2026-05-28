import { streakInfo, type StreakState } from '../domain/progress/streak';
import { useProgress } from '../state/ProgressContext';

/** Effective daily streak for display (reflects whether it's still alive today). */
export function useStreak(): { days: number; state: StreakState } {
  const { progress } = useProgress();
  return streakInfo(progress, new Date());
}
