/**
 * Override credits — a small budget of "I think my answer was actually correct"
 * overrides the learner can spend when the AI evaluator disagrees.
 *
 * Economy ("на грани необходимого"):
 *   - 1 daily grant per day used (capped at CAP)
 *   - + up to 1 lesson grant per day (capped at CAP)
 *   - 1 missed day burns 1 credit (down to 0)
 *
 * All helpers are pure and operate on UTC calendar days (YYYY-MM-DD).
 */

export const OVERRIDE_CAP = 3;
const DAILY_GRANT = 1;

export interface OverrideCredits {
  balance: number; // 0..OVERRIDE_CAP
  /** ISO date (YYYY-MM-DD) of the last day touchCredits ran for this user. */
  lastTouchDate: string;
  /** ISO date (YYYY-MM-DD) of the last day a lesson grant was awarded (caps lesson grants at 1/day). */
  lessonEarnedOn?: string;
}

export function toDateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

function clampCap(n: number): number {
  if (n < 0) return 0;
  if (n > OVERRIDE_CAP) return OVERRIDE_CAP;
  return n;
}

/**
 * Folds calendar days forward. If `state` is missing the user is treated as new
 * (1 starting credit). For each missed day -1; on the current day +DAILY_GRANT.
 * Called lazily whenever credits matter (reading balance, granting from a
 * lesson, spending one), so we never need a background timer.
 */
export function touchCredits(
  state: OverrideCredits | undefined,
  now: Date = new Date(),
): OverrideCredits {
  const today = toDateKey(now);
  if (!state) {
    return { balance: 1, lastTouchDate: today };
  }
  if (state.lastTouchDate === today) return state;
  const diff = daysBetween(state.lastTouchDate, today);
  if (diff <= 0) {
    // Clock skew (e.g. timezone change) — pin to today, no fold.
    return { ...state, lastTouchDate: today };
  }
  const missed = diff - 1;
  const balance = clampCap(Math.max(0, state.balance - missed) + DAILY_GRANT);
  // Crossed midnight, so the lesson-grant slot resets.
  const next: OverrideCredits = { balance, lastTouchDate: today };
  return next;
}

export interface EarnResult {
  state: OverrideCredits;
  granted: boolean;
}

/**
 * Awards a lesson credit if today's lesson-grant slot is still open and the
 * balance is below cap. "Slot open" — at most one lesson grant per day. Slot is
 * marked used only on a successful grant, so completing more lessons after
 * spending a credit still works.
 */
export function earnFromLesson(
  state: OverrideCredits | undefined,
  now: Date = new Date(),
): EarnResult {
  const touched = touchCredits(state, now);
  const today = toDateKey(now);
  if (touched.lessonEarnedOn === today) return { state: touched, granted: false };
  if (touched.balance >= OVERRIDE_CAP) return { state: touched, granted: false };
  return {
    state: { ...touched, balance: touched.balance + 1, lessonEarnedOn: today },
    granted: true,
  };
}

export interface UseResult {
  state: OverrideCredits;
  used: boolean;
}

export function useCredit(
  state: OverrideCredits | undefined,
  now: Date = new Date(),
): UseResult {
  const touched = touchCredits(state, now);
  if (touched.balance <= 0) return { state: touched, used: false };
  return { state: { ...touched, balance: touched.balance - 1 }, used: true };
}

/** Reads today's balance without mutating storage. */
export function visibleBalance(
  state: OverrideCredits | undefined,
  now: Date = new Date(),
): number {
  return touchCredits(state, now).balance;
}
