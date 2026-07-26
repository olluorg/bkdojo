import { getById, type ContentIndex } from '../content/contentIndex';
import type { AnswerOutcome } from '../models/answer';
import type { Lesson } from '../models/lesson';
import type { Question } from '../models/question';
import type { Session, SessionItem } from '../models/session';
import { lessonQuestionIds } from '../progress/lessonStatus';

/**
 * Defending a topic.
 *
 * Closing a lesson used to cost two clicks: each of its questions answered
 * correctly *at least once, ever* — accumulated across separate sittings, with
 * hints available and "я не знаю" one button away. A checkmark that cheap cannot
 * turn into confidence, because nothing was ever demonstrated in one piece.
 *
 * A defense is the same questions under interview conditions: one pass, no
 * hints, no skipping, every answer correct. That makes closing expensive without
 * needing more content — which matters, because a lesson here averages about two
 * questions.
 */

/** Every question of the lesson, ramped easy → hard like a real interview. */
export function buildDefenseSession(index: ContentIndex, lesson: Lesson): Session {
  const items: SessionItem[] = lessonQuestionIds(index, lesson)
    .map((id) => getById(index, id))
    .filter((question): question is Question => question !== undefined)
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((question) => ({ question, reason: 'daily' as const }));

  return { kind: 'daily', items };
}

/**
 * A defense passes only when every answer of the single pass was correct. An
 * empty pass is not a pass — there was nothing to demonstrate.
 */
export function isDefensePassed(outcomes: readonly AnswerOutcome[]): boolean {
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.verdict === 'correct');
}
