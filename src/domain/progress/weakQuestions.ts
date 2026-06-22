import type { ContentIndex } from '../content/contentIndex';
import { getById } from '../content/contentIndex';
import type { AnswerRecord, UserProgress } from '../models/progress';
import type { Question } from '../models/question';

/**
 * Question-level weak spots, derived from history (no persisted list, like
 * `rankWeakConcepts`).
 *
 * A question becomes weak once it has a "problem" — answered incorrectly/partially,
 * or only reached its verdict with help (a clarifying question or a repair,
 * recorded as `assisted`). It leaves the list once the learner answers it
 * **cleanly correct twice in a row** (verdict `correct` and unaided), mirroring
 * the concept-level "resolved after two covered" rule.
 */
function isCleanCorrect(record: AnswerRecord): boolean {
  return record.verdict === 'correct' && !record.assisted;
}

function isProblem(record: AnswerRecord): boolean {
  return record.verdict !== 'correct' || !!record.assisted;
}

/** The set of question ids currently considered weak. */
export function weakQuestionIds(progress: UserProgress): Set<string> {
  const byQuestion = new Map<string, AnswerRecord[]>();
  for (const record of progress.history) {
    const bucket = byQuestion.get(record.questionId) ?? [];
    bucket.push(record);
    byQuestion.set(record.questionId, bucket);
  }

  const weak = new Set<string>();
  for (const [questionId, records] of byQuestion) {
    let everProblem = false;
    let trailingClean = 0;
    for (const record of records) {
      if (isProblem(record)) everProblem = true;
      trailingClean = isCleanCorrect(record) ? trailingClean + 1 : 0;
    }
    if (everProblem && trailingClean < 2) weak.add(questionId);
  }
  return weak;
}

/**
 * Weak questions resolved against the content index (missing ids dropped),
 * ordered most-recently-attempted first so the freshest struggles come up first.
 */
export function weakQuestions(progress: UserProgress, index: ContentIndex): Question[] {
  const ids = weakQuestionIds(progress);
  if (ids.size === 0) return [];

  const lastSeen = new Map<string, number>();
  for (let i = 0; i < progress.history.length; i++) {
    lastSeen.set(progress.history[i]!.questionId, i);
  }

  return [...ids]
    .sort((a, b) => (lastSeen.get(b) ?? -1) - (lastSeen.get(a) ?? -1))
    .map((id) => getById(index, id))
    .filter((q): q is Question => q !== undefined);
}
