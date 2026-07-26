/**
 * The learner's actual goal.
 *
 * A hardcoded "Middle Java Backend Interview" is nobody's goal. What drives a
 * backend developer to open a trainer daily is a real destination — a grade they
 * want, often a named company, and very often a date already in the calendar.
 * Without one, daily practice is a treadmill: motion without arrival.
 *
 * The goal lives in settings (localStorage, like everything else) and is
 * optional at every level: no company, no date, and a sane default grade.
 */

export type TargetGrade = 'junior' | 'middle' | 'senior';

export interface InterviewGoal {
  grade: TargetGrade;
  /** Optional — a named company makes the goal concrete. */
  company?: string;
  /** Optional interview date, `YYYY-MM-DD`. */
  interviewDate?: string;
}

export const DEFAULT_GOAL: InterviewGoal = { grade: 'middle' };

export const GRADE_LABELS: Record<TargetGrade, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
};

export const GRADES: readonly TargetGrade[] = ['junior', 'middle', 'senior'];

/**
 * Ability (1..5) that counts as "comfortably at this grade". Readiness is scored
 * against this, so raising the goal honestly lowers today's readiness rather than
 * quietly rescaling the same number.
 */
export const GRADE_TARGET_ABILITY: Record<TargetGrade, number> = {
  junior: 2.5,
  middle: 3.5,
  senior: 4.5,
};

export function goalLabel(goal: InterviewGoal): string {
  const base = `${GRADE_LABELS[goal.grade]} Java Backend`;
  const company = goal.company?.trim();
  return company ? `${base} — ${company}` : base;
}

/** Local calendar day as `YYYY-MM-DD`, matching the `<input type="date">` value. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Whole days until the interview: 0 = today, negative once it has passed,
 * `undefined` when no date is set or the stored value is unparseable.
 */
export function daysUntilInterview(goal: InterviewGoal, now: Date): number | undefined {
  const target = goal.interviewDate;
  if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return undefined;
  const from = Date.parse(`${toDateKey(now)}T00:00:00Z`);
  const to = Date.parse(`${target}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
  return Math.round((to - from) / 86_400_000);
}

/** Russian day plural: 1 день, 2 дня, 5 дней. */
export function pluralDays(days: number): string {
  const abs = Math.abs(days);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

/** The countdown line for Today, or `undefined` when there is nothing to count. */
export function countdownLabel(goal: InterviewGoal, now: Date): string | undefined {
  const days = daysUntilInterview(goal, now);
  if (days === undefined) return undefined;
  if (days < 0) return 'Собеседование уже прошло — обнови цель.';
  if (days === 0) return 'Собеседование сегодня.';
  if (days === 1) return 'Собеседование завтра.';
  return `До собеседования ${days} ${pluralDays(days)}.`;
}
