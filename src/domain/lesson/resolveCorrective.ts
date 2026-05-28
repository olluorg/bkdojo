import { addToIndex, getById, type ContentIndex } from '../content/contentIndex';
import { saveGeneratedQuestion } from '../content/generatedQuestions';
import type { EvalMethod } from '../models/settings';
import { isOpenQuestion, type Question } from '../models/question';
import type { SessionItem } from '../models/session';
import type { CorrectiveNeed } from './correctiveRound';
import { selectFollowupFromBank } from './followupSelector';
import { generateFollowupQuestion } from './followupGenerator';

export interface ResolveCorrectiveDeps {
  index: ContentIndex;
  method: EvalMethod;
  /** Never surface these as follow-ups (e.g. already-cleared questions). */
  excludeIds?: ReadonlySet<string>;
  /** Injectable for tests; defaults to the LLM generator. */
  generate?: typeof generateFollowupQuestion;
  /** Injectable for tests; defaults to persisting + folding into the bank. */
  persist?: (q: Question) => void;
}

function conceptTitle(index: ContentIndex, source: Question, conceptId: string): string {
  if (isOpenQuestion(source)) {
    const hit = source.rubric.find((c) => c.id === conceptId);
    if (hit) return hit.title;
  }
  return index.conceptTitles.get(conceptId) ?? conceptId;
}

/**
 * Turns corrective needs into a playable list of session items (directives 1 & 2):
 * - `retry`    → the same question again.
 * - `followup` → a bank question on the missing concept; failing that, an
 *   AI-generated one (saved into the bank); failing that, the source question.
 *
 * Unknown question ids are skipped. Order follows the needs. A `persist` hook
 * folds generated questions into the runtime index and localStorage so they
 * become part of the bank for later sessions.
 */
export async function resolveCorrectiveItems(
  needs: readonly CorrectiveNeed[],
  deps: ResolveCorrectiveDeps,
): Promise<SessionItem[]> {
  const generate = deps.generate ?? generateFollowupQuestion;
  const persist =
    deps.persist ??
    ((q: Question) => {
      saveGeneratedQuestion(q);
      addToIndex(deps.index, q);
    });
  const exclude = deps.excludeIds ?? new Set<string>();

  const items: SessionItem[] = [];

  for (const need of needs) {
    const source = getById(deps.index, need.questionId);
    if (!source) continue;

    if (need.kind === 'retry') {
      items.push({ question: source, reason: 'review' });
      continue;
    }

    const fromBank = selectFollowupFromBank(deps.index, source, need.conceptId, exclude);
    if (fromBank) {
      items.push({ question: fromBank, reason: 'review' });
      continue;
    }

    const generated = await generate(
      source,
      need.conceptId,
      conceptTitle(deps.index, source, need.conceptId),
      { method: deps.method },
    );
    if (generated) {
      persist(generated);
      items.push({ question: generated, reason: 'review' });
    } else {
      // No bank match and no AI: still give a chance to recover on the original.
      items.push({ question: source, reason: 'review' });
    }
  }

  return items;
}
