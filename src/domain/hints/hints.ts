import type { AnswerOutcome } from '../models/answer';
import { isOpenQuestion, type Question } from '../models/question';

/**
 * Progressive, no-spoiler hints for a question, revealed one at a time.
 *
 * - Open questions surface their rubric concept *titles* (highest weight first):
 *   "what a strong answer touches" without handing over the wording.
 * - Choice questions eliminate one wrong option per hint.
 *
 * Deterministic so the same question always yields the same hint order.
 */
export function hintsFor(question: Question): string[] {
  if (isOpenQuestion(question)) {
    return [...question.rubric]
      .sort((a, b) => b.weight - a.weight)
      .map((c) => `Затронь в ответе: ${c.title}`);
  }
  const correct = new Set(question.correctOptionIds);
  return question.options
    .filter((o) => !correct.has(o.id))
    .map((o) => `Это точно не: «${o.text}»`);
}

/**
 * Score ceiling after using `hintsUsed` hints. No hints → no cap. The cap is
 * mild on purpose: a hinted answer should still feel like a win, it just counts
 * a little less so difficulty doesn't ratchet up off help.
 */
export function hintCap(hintsUsed: number): number {
  if (hintsUsed <= 0) return 1;
  if (hintsUsed === 1) return 0.85;
  if (hintsUsed === 2) return 0.7;
  return 0.55;
}

/**
 * Applies the mild hint penalty to an outcome: caps the recorded `score` (which
 * feeds the ability/Elo update) while leaving the on-screen `verdict` untouched
 * — a hint never turns a pass into a fail, it only tempers how much mastery the
 * answer is credited with. A no-op when no hints were used or the score is
 * already at or below the cap.
 */
export function applyHintPenalty(outcome: AnswerOutcome, hintsUsed: number): AnswerOutcome {
  const cap = hintCap(hintsUsed);
  if (outcome.score <= cap) return outcome;
  return { ...outcome, score: cap };
}
