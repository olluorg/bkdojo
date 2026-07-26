import type { Domain } from '../models/common';
import type { AnswerRecord, UserProgress } from '../models/progress';

/**
 * "My answers" — the artifact of the learner's own successful performance.
 *
 * Confidence before an interview comes from remembering yourself succeed. A
 * readiness percentage cannot supply that (it is a number a model assigned to
 * you), and neither can `answerGuide` (that is somebody else's good answer).
 * What does is re-reading the thing you yourself managed to say.
 *
 * Every open answer is already stored verbatim in history, so this is a pure
 * derivation — nothing new is persisted, nothing to migrate or sync.
 */

export interface MyAnswer {
  questionId: string;
  domain: Domain;
  /** The learner's own words, including any interviewer follow-ups they answered. */
  text: string;
  score: number;
  answeredAt: string; // ISO
}

/** Only an answer that would actually pass is worth keeping as an artifact. */
function keepableText(record: AnswerRecord): string | undefined {
  if (record.verdict !== 'correct') return undefined;
  if (record.evaluatedBy === 'skipped') return undefined;
  const text = record.answer?.trim();
  return text ? text : undefined;
}

/**
 * The learner's best answer per question — highest score wins, ties go to the
 * more recent telling (a later retelling is usually the more fluent one, and
 * history is chronological, so `>=` keeps the newer record). Newest first.
 */
export function myAnswers(progress: UserProgress): MyAnswer[] {
  const best = new Map<string, MyAnswer>();

  for (const record of progress.history) {
    const text = keepableText(record);
    if (!text) continue;
    const current = best.get(record.questionId);
    if (current && record.score < current.score) continue;
    best.set(record.questionId, {
      questionId: record.questionId,
      domain: record.domain,
      text,
      score: record.score,
      answeredAt: record.answeredAt,
    });
  }

  return [...best.values()].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
}

/** Groups the artifact by domain for the review screen, preserving newest-first order. */
export function myAnswersByDomain(progress: UserProgress): Map<Domain, MyAnswer[]> {
  const grouped = new Map<Domain, MyAnswer[]>();
  for (const answer of myAnswers(progress)) {
    const bucket = grouped.get(answer.domain) ?? [];
    bucket.push(answer);
    grouped.set(answer.domain, bucket);
  }
  return grouped;
}
