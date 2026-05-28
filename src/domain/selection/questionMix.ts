import { isOpenQuestion, type Question } from '../models/question';

/**
 * Practice should lean on quick, single-answer questions: open answers make up at
 * most this share of a session (directive 5). It's a soft cap — when a pool runs
 * short of choice questions, the session is still filled with open ones rather
 * than left half-empty.
 */
export const MAX_OPEN_RATIO = 0.25;

/** How many open questions a session of `size` may contain at the cap. */
export function maxOpenForSize(size: number, ratio: number = MAX_OPEN_RATIO): number {
  return Math.floor(size * ratio);
}

/**
 * Picks up to `size` questions from an ordered candidate list, keeping open
 * questions to at most `ratio` of the result. Choice questions are taken in order;
 * open questions only while under the cap. If choice runs out before `size` is
 * reached, the remaining slots are backfilled with the deferred open questions so
 * the session is never starved. Order of kept items is preserved (deferred opens
 * appended); callers that care about ordering should re-sort.
 */
export function capOpenQuestions(
  ordered: Question[],
  size: number,
  ratio: number = MAX_OPEN_RATIO,
): Question[] {
  const maxOpen = maxOpenForSize(size, ratio);
  const result: Question[] = [];
  const deferred: Question[] = [];
  let open = 0;

  for (const q of ordered) {
    if (result.length >= size) break;
    if (isOpenQuestion(q)) {
      if (open < maxOpen) {
        result.push(q);
        open += 1;
      } else {
        deferred.push(q);
      }
    } else {
      result.push(q);
    }
  }

  for (const q of deferred) {
    if (result.length >= size) break;
    result.push(q);
  }

  return result;
}
