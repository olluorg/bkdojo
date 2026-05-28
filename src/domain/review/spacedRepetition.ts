import type { Verdict } from '../models/evaluation';
import type { AnswerRecord } from '../models/progress';

const DAY_MS = 86_400_000;

/** Leitner-style intervals (days) indexed by box (1-based). */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 30] as const;

export interface ReviewSchedule {
  nextReviewAt: string; // ISO
  intervalDays: number;
  box: number;
}

export interface ScheduleInput {
  /** Consecutive correct answers for this question BEFORE the current one. */
  priorConsecutiveCorrect: number;
  verdict: Verdict;
  now: Date;
}

/**
 * Schedules the next review. A correct answer promotes the item to a longer
 * interval; anything less resets it to box 1 so weak items resurface quickly.
 */
export function scheduleReview(input: ScheduleInput): ReviewSchedule {
  const correct = input.verdict === 'correct';
  const box = correct
    ? Math.min(input.priorConsecutiveCorrect + 1, REVIEW_INTERVALS_DAYS.length)
    : 1;
  const intervalDays = REVIEW_INTERVALS_DAYS[box - 1] ?? 1;
  const nextReviewAt = new Date(input.now.getTime() + intervalDays * DAY_MS).toISOString();
  return { nextReviewAt, intervalDays, box };
}

/** Counts the trailing run of correct answers for a question in chronological history. */
export function consecutiveCorrect(history: AnswerRecord[], questionId: string): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const record = history[i];
    if (!record || record.questionId !== questionId) continue;
    if (record.verdict === 'correct') streak++;
    else break;
  }
  return streak;
}
