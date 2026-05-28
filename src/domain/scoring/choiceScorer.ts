import type { ChoiceSubmission } from '../models/answer';
import type { Verdict } from '../models/evaluation';
import type { ChoiceQuestion } from '../models/question';
import { clamp01 } from '../util/math';

export interface ChoiceScore {
  score: number; // 0..1
  verdict: Verdict;
}

/**
 * Deterministic local scoring for choice questions.
 * - single: all-or-nothing.
 * - multiple: partial credit = (correct - wrong) / totalCorrect, clamped to 0..1.
 */
export function scoreChoice(question: ChoiceQuestion, submission: ChoiceSubmission): ChoiceScore {
  const correct = new Set(question.correctOptionIds);
  const selected = new Set(submission.selectedOptionIds);

  if (question.type === 'single') {
    const isCorrect = selected.size === 1 && [...selected].every((id) => correct.has(id));
    return { score: isCorrect ? 1 : 0, verdict: isCorrect ? 'correct' : 'incorrect' };
  }

  let hits = 0;
  let wrong = 0;
  for (const id of selected) {
    if (correct.has(id)) hits++;
    else wrong++;
  }
  const score = correct.size > 0 ? clamp01((hits - wrong) / correct.size) : 0;
  const verdict: Verdict = score >= 1 ? 'correct' : score > 0 ? 'partial' : 'incorrect';
  return { score, verdict };
}
