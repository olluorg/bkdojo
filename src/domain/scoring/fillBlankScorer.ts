import type { FillBlankSubmission } from '../models/answer';
import type { Verdict } from '../models/evaluation';
import type { FillBlankQuestion } from '../models/question';

export interface FillBlankScore {
  score: number; // 0..1
  verdict: Verdict;
  /** blankId → whether the typed answer matched an accepted variant. */
  perBlank: Record<string, boolean>;
}

/** Normalizes a gap answer for comparison: trim, lowercase, collapse inner whitespace. */
export function normalizeBlank(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deterministic local scoring for fill-blank questions. Each gap is compared
 * (after normalization) against its accepted variants; the score is the fraction
 * of gaps answered correctly. All correct → `correct`, some → `partial`, none →
 * `incorrect`.
 */
export function scoreFillBlank(
  question: FillBlankQuestion,
  submission: FillBlankSubmission,
): FillBlankScore {
  const perBlank: Record<string, boolean> = {};
  let hits = 0;

  for (const blank of question.blanks) {
    const given = normalizeBlank(submission.answers[blank.id] ?? '');
    const ok = given.length > 0 && blank.accept.some((a) => normalizeBlank(a) === given);
    perBlank[blank.id] = ok;
    if (ok) hits++;
  }

  const total = question.blanks.length;
  const score = total > 0 ? hits / total : 0;
  const verdict: Verdict = score >= 1 ? 'correct' : score > 0 ? 'partial' : 'incorrect';
  return { score, verdict, perBlank };
}
