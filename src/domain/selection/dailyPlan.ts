import type { ContentIndex } from '../content/contentIndex';
import type { UserProgress } from '../models/progress';
import type { Session, SessionItem } from '../models/session';
import { buildDailySession } from './dailySelector';
import { buildReviewSession } from './reviewSelector';

export interface DailyPlanOptions {
  size?: number;
  now?: Date;
  rng?: () => number;
}

/**
 * The day's plan in one feed: due spaced-repetition reviews first (most overdue),
 * then fresh adaptive questions to fill the rest. Deduped and capped at `size`.
 * (Glossary terms stay a separate quick drill — different UI.)
 */
export function buildDailyPlan(
  index: ContentIndex,
  progress: UserProgress,
  options: DailyPlanOptions = {},
): Session {
  const size = options.size ?? 8;
  const now = options.now ?? new Date();
  const rng = options.rng ?? Math.random;

  const review = buildReviewSession(index, progress, { now, size }).items;
  const used = new Set(review.map((i) => i.question.id));
  const items: SessionItem[] = [...review];

  if (items.length < size) {
    const fresh = buildDailySession(index, progress, { size: size * 2, rng }).items.filter(
      (i) => !used.has(i.question.id),
    );
    for (const item of fresh) {
      if (items.length >= size) break;
      items.push(item);
      used.add(item.question.id);
    }
  }

  return { kind: 'daily', items: items.slice(0, size) };
}
