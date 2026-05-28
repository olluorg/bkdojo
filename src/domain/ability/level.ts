export type Level = 'junior' | 'middle' | 'senior';

export const LEVEL_LABELS: Record<Level, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
};

/** Maps a numeric ability (1..5) to a coarse interview level for the UI. */
export function levelLabel(ability: number): Level {
  if (ability < 2.5) return 'junior';
  if (ability < 4) return 'middle';
  return 'senior';
}
