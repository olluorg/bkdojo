import type { AnswerOutcome } from '../models/answer';
import { correctiveNeeds, type CorrectiveNeed } from './correctiveRound';

/**
 * Corrective work for a LESSON pass ("работа над ошибками").
 *
 * Unlike the general corrective round, a lesson re-asks ONLY the learner's own
 * missed questions that belong to THIS lesson, and always as a `retry` (the very
 * same question) — never a concept follow-up pulled from the wider question
 * bank. Two reasons:
 *  - it stays strictly on-topic (no off-topic question can leak in via a shared
 *    tag), matching the lesson the learner is studying;
 *  - clearing a miss actually flips the lesson to "passed", because the original
 *    lesson question is what gets re-answered (a follow-up is a different id and
 *    would never clear the original).
 */
export function lessonCorrectiveNeeds(
  outcomes: readonly AnswerOutcome[],
  lessonQuestionIds: ReadonlySet<string>,
): CorrectiveNeed[] {
  return correctiveNeeds(outcomes)
    .filter((need) => lessonQuestionIds.has(need.questionId))
    .map((need) => ({ kind: 'retry', questionId: need.questionId }));
}
