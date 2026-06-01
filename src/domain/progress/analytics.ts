import type { AppEvent } from '../models/event';
import type { AnswerRecord, UserProgress } from '../models/progress';

/**
 * Read-only analytics over the learning record. Combines `history` (answers, with
 * verdict/score) and the append-only `events` log into time-series the UI can
 * chart and the predictor can extrapolate from. All functions are pure.
 *
 * Days are bucketed by the **local** calendar (matching streak/activity), so a
 * learner's "today" lines up with the daily mission.
 */

/** Local YYYY-MM-DD key for a date. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DayAccuracy {
  date: string; // YYYY-MM-DD
  answered: number;
  correct: number;
  accuracy: number; // 0..1, 0 on empty days
}

/** Continuous series of the last `days` calendar days (oldest→newest), accuracy per day. */
export function dailyAccuracy(
  records: readonly AnswerRecord[],
  days = 14,
  now: Date = new Date(),
): DayAccuracy[] {
  const buckets = new Map<string, { answered: number; correct: number }>();
  for (const r of records) {
    const key = dayKey(new Date(r.answeredAt));
    const b = buckets.get(key) ?? { answered: 0, correct: 0 };
    b.answered += 1;
    if (r.verdict === 'correct') b.correct += 1;
    buckets.set(key, b);
  }
  return lastNDays(days, now).map((date) => {
    const b = buckets.get(date) ?? { answered: 0, correct: 0 };
    return {
      date,
      answered: b.answered,
      correct: b.correct,
      accuracy: b.answered === 0 ? 0 : b.correct / b.answered,
    };
  });
}

export interface DayActivity {
  date: string;
  answers: number;
  sessions: number;
  lessons: number;
  terms: number;
}

/** Continuous per-day counts of the main learning actions (oldest→newest). */
export function activityByDay(
  progress: UserProgress,
  days = 14,
  now: Date = new Date(),
): DayActivity[] {
  const map = new Map<string, DayActivity>();
  const ensure = (key: string) =>
    map.get(key) ?? { date: key, answers: 0, sessions: 0, lessons: 0, terms: 0 };

  for (const r of progress.history ?? []) {
    const key = dayKey(new Date(r.answeredAt));
    const d = ensure(key);
    d.answers += 1;
    map.set(key, d);
  }
  for (const e of progress.events ?? []) {
    const key = dayKey(new Date(e.at));
    const d = ensure(key);
    if (e.type === 'session_completed') d.sessions += 1;
    else if (e.type === 'lesson_completed') d.lessons += 1;
    else if (e.type === 'term_drilled') d.terms += 1;
    map.set(key, d);
  }

  return lastNDays(days, now).map(
    (date) => map.get(date) ?? { date, answers: 0, sessions: 0, lessons: 0, terms: 0 },
  );
}

export interface TimelineEntry {
  at: string; // ISO
  source: 'answer' | 'event';
  answer?: AnswerRecord;
  event?: AppEvent;
}

/** Merged, most-recent-first timeline of answers and events for the history feed. */
export function unifiedTimeline(progress: UserProgress, limit?: number): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const a of progress.history ?? []) {
    entries.push({ at: a.answeredAt, source: 'answer', answer: a });
  }
  for (const e of progress.events ?? []) {
    entries.push({ at: e.at, source: 'event', event: e });
  }
  entries.sort((x, y) => y.at.localeCompare(x.at));
  return limit === undefined ? entries : entries.slice(0, limit);
}

/**
 * Least-squares slope of a numeric series (per-step). Positive = improving.
 * Returns 0 for fewer than two points.
 */
export function trendSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i]! - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Local date strings for the last `days` days, oldest→newest, ending today. */
function lastNDays(days: number, now: Date): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}
