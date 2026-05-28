import type { TermProgress, UserProgress } from '../models/progress';
import { scheduleReview } from '../review/spacedRepetition';

/** Consecutive correct recalls that count a term as memorized. */
export const TERM_MASTERY_TARGET = 3;

export function getTermProgress(progress: UserProgress, termId: string): TermProgress | undefined {
  return progress.terms?.[termId];
}

/** 0..1 — how well a term is memorized (by recent correct streak). */
export function termMastery(progress: UserProgress, termId: string): number {
  const streak = getTermProgress(progress, termId)?.streak ?? 0;
  return Math.min(streak, TERM_MASTERY_TARGET) / TERM_MASTERY_TARGET;
}

export function isTermMastered(progress: UserProgress, termId: string): boolean {
  return (getTermProgress(progress, termId)?.streak ?? 0) >= TERM_MASTERY_TARGET;
}

export function countMasteredTerms(progress: UserProgress, termIds: string[]): number {
  return termIds.filter((id) => isTermMastered(progress, id)).length;
}

/** Pure fold of one drill result into per-term progress (no mutation). */
export function applyTermResult(
  progress: UserProgress,
  termId: string,
  correct: boolean,
  now: Date = new Date(),
): UserProgress {
  const prev = progress.terms?.[termId];
  const priorStreak = prev?.streak ?? 0;
  const schedule = scheduleReview({
    priorConsecutiveCorrect: priorStreak,
    verdict: correct ? 'correct' : 'incorrect',
    now,
  });

  const next: TermProgress = {
    termId,
    streak: correct ? priorStreak + 1 : 0,
    seen: (prev?.seen ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
    lastAnsweredAt: now.toISOString(),
    nextReviewAt: schedule.nextReviewAt,
  };

  return { ...progress, terms: { ...(progress.terms ?? {}), [termId]: next } };
}
