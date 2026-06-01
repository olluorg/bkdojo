import type { ContentIndex } from '../content/contentIndex';
import { getByDomain } from '../content/contentIndex';
import { DOMAINS, type Domain } from '../models/common';
import { isChoiceQuestion, isOpenQuestion } from '../models/question';
import type { DomainSkill, UserProgress } from '../models/progress';
import type { Session, SessionItem } from '../models/session';
import { pickByDifficulty, targetDifficulty } from './adaptiveSelector';
import { maxOpenForSize } from './questionMix';
import { recoveryOffset } from './recovery';

export interface DailyOptions {
  size?: number;
  /** How many of the most recent answers to avoid repeating. */
  recentWindow?: number;
  rng?: () => number;
}

function accuracy(skill: DomainSkill): number {
  return skill.answered === 0 ? 0 : skill.correct / skill.answered;
}

/** Weakest domains first: lower ability, then lower accuracy. */
export function domainsByWeakness(progress: UserProgress): Domain[] {
  return [...DOMAINS].sort((a, b) => {
    const sa = progress.skills[a];
    const sb = progress.skills[b];
    if (sa.ability !== sb.ability) return sa.ability - sb.ability;
    return accuracy(sa) - accuracy(sb);
  });
}

/**
 * Builds a daily practice session. Cycles through domains weakest-first (so weak
 * domains get slightly more questions), picking each domain's question at its
 * desirable difficulty and avoiding recently seen questions.
 */
export function buildDailySession(
  index: ContentIndex,
  progress: UserProgress,
  options: DailyOptions = {},
): Session {
  const size = options.size ?? 8;
  const recentWindow = options.recentWindow ?? 30;
  const rng = options.rng ?? Math.random;

  const recentIds = progress.history.slice(-recentWindow).map((r) => r.questionId);
  const used = new Set<string>(recentIds);
  const order = domainsByWeakness(progress);
  const items: SessionItem[] = [];

  // Cap open answers at ≤25% (directive 5): prefer choice questions; only once
  // choice is exhausted do we relax the cap so the session isn't left short.
  const maxOpen = maxOpenForSize(size);
  let openCount = 0;
  let relaxed = false;

  while (items.length < size) {
    let progressed = false;
    for (const domain of order) {
      if (items.length >= size) break;
      const offset = recoveryOffset(progress.history, domain);
      const target = targetDifficulty(progress.skills[domain].ability, offset);
      const full = getByDomain(index, domain);
      const pool = relaxed || openCount < maxOpen ? full : full.filter(isChoiceQuestion);
      const question = pickByDifficulty(pool, target, { excludeIds: used, rng });
      if (question) {
        used.add(question.id);
        items.push({ question, reason: 'daily' });
        if (isOpenQuestion(question)) openCount += 1;
        progressed = true;
      }
    }
    if (!progressed) {
      if (relaxed) break; // content exhausted even with open answers allowed
      relaxed = true; // choice ran out — allow open answers to fill the session
    }
  }

  return { kind: 'daily', items };
}
