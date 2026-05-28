import type { ContentIndex } from '../content/contentIndex';
import { getByDomain } from '../content/contentIndex';
import { isChoiceQuestion, isOpenQuestion, type Question } from '../models/question';

/**
 * Picks an existing bank question that probes a concept the learner missed,
 * staying in the same domain as the question they stumbled on. Preference order
 * (directive 2 "search the bank first", directive 5 "prefer simple questions"):
 *
 *   1. an open question whose rubric contains the exact missing concept;
 *   2. otherwise a question sharing a tag with the source.
 *
 * Within each tier, simpler comes first — choice before open, then lower
 * difficulty — so recovery starts gently. `excludeIds` drops the source question
 * and anything already cleared. Returns undefined when the bank offers nothing,
 * signalling the caller to generate one instead.
 */
export function selectFollowupFromBank(
  index: ContentIndex,
  source: Question,
  conceptId: string,
  excludeIds: ReadonlySet<string> = new Set(),
): Question | undefined {
  const candidates = getByDomain(index, source.domain).filter(
    (q) => q.id !== source.id && !excludeIds.has(q.id),
  );

  const byRubric = candidates.filter(
    (q) => isOpenQuestion(q) && q.rubric.some((c) => c.id === conceptId),
  );
  if (byRubric.length > 0) return byRubric.sort(simplerFirst)[0];

  const sourceTags = new Set(source.tags);
  const byTag = candidates.filter((q) => q.tags.some((t) => sourceTags.has(t)));
  if (byTag.length > 0) return byTag.sort(simplerFirst)[0];

  return undefined;
}

/** Sort comparator: choice questions before open, then easiest difficulty first. */
function simplerFirst(a: Question, b: Question): number {
  const aChoice = isChoiceQuestion(a) ? 0 : 1;
  const bChoice = isChoiceQuestion(b) ? 0 : 1;
  if (aChoice !== bChoice) return aChoice - bChoice;
  return a.difficulty - b.difficulty;
}
