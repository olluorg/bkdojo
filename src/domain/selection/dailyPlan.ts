import type { ContentIndex } from '../content/contentIndex';
import { getByDomain, getById } from '../content/contentIndex';
import { DOMAIN_LABELS, type Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import type { Question } from '../models/question';
import type { UserProgress } from '../models/progress';
import type { Session, SessionItem } from '../models/session';
import { correctlyAnsweredIds, lessonQuestionIds } from '../progress/lessonStatus';
import { weakQuestions } from '../progress/weakQuestions';
import { pickByDifficulty, targetDifficulty } from './adaptiveSelector';
import { buildDailySession } from './dailySelector';
import { capOpenQuestions } from './questionMix';
import { buildReviewSession } from './reviewSelector';

export interface DailyPlanOptions {
  size?: number;
  now?: Date;
  rng?: () => number;
}

/**
 * The day's plan in one feed: due spaced-repetition reviews first (most overdue),
 * then ~10% weak-spot questions (ones that earlier needed help or were wrong, even
 * if not yet due), then fresh adaptive questions to fill the rest. Deduped and
 * capped at `size`. (Glossary terms stay a separate quick drill — different UI.)
 */
export function buildDailyPlan(
  index: ContentIndex,
  progress: UserProgress,
  options: DailyPlanOptions = {},
): Session {
  const size = options.size ?? 8;
  const now = options.now ?? new Date();
  const rng = options.rng ?? Math.random;

  const items: SessionItem[] = [];
  const used = new Set<string>();
  const push = (item: SessionItem) => {
    if (items.length >= size || used.has(item.question.id)) return;
    items.push(item);
    used.add(item.question.id);
  };

  // Reserve ~10% of the feed (≈1 per session of 8) for weak-spot questions that
  // aren't necessarily due, so struggles keep resurfacing in daily practice.
  const weakPool = weakQuestions(progress, index);
  const mixTarget = weakPool.length > 0 ? Math.max(1, Math.round(size / 10)) : 0;

  const review = buildReviewSession(index, progress, { now, size }).items;
  // Leave room for the weak mix before filling with reviews.
  for (const item of review) {
    if (items.length >= size - mixTarget) break;
    push(item);
  }

  let mixed = 0;
  for (const question of weakPool) {
    if (mixed >= mixTarget) break;
    if (used.has(question.id)) continue;
    push({
      question,
      reason: 'review',
      reasonText: 'Подмешано слабое место: вопрос, который раньше не получился.',
    });
    mixed++;
  }

  for (const item of review) push(item); // remaining reviews if room is left

  if (items.length < size) {
    const fresh = buildDailySession(index, progress, { size: size * 2, rng }).items.filter(
      (i) => !used.has(i.question.id),
    );
    for (const item of fresh) push(item);
  }

  return { kind: 'daily', items: items.slice(0, size) };
}

export interface FocusedDailyPlanOptions extends DailyPlanOptions {
  domain: Domain;
  lesson?: Lesson;
}

/**
 * Builds the executable practice step for today's mission. It keeps the learner
 * inside the promised focus: due reviews from the focus lesson/domain first,
 * then unanswered lesson questions, then adaptive questions from the same
 * domain. The regular daily plan remains available as free practice.
 */
export function buildFocusedDailyPlan(
  index: ContentIndex,
  progress: UserProgress,
  options: FocusedDailyPlanOptions,
): Session {
  const size = options.size ?? 8;
  const now = options.now ?? new Date();
  const rng = options.rng ?? Math.random;
  const items: SessionItem[] = [];
  const used = new Set<string>();

  const add = (question: Question, reason: SessionItem['reason'], reasonText: string) => {
    if (items.length >= size || used.has(question.id)) return;
    items.push({ question, reason, reasonText });
    used.add(question.id);
  };

  const lessonIds = options.lesson
    ? new Set(lessonQuestionIds(index, options.lesson))
    : undefined;
  const correct = correctlyAnsweredIds(progress);

  const due = buildReviewSession(index, progress, { now, size: 100 }).items;
  for (const item of due) {
    if (lessonIds ? lessonIds.has(item.question.id) : item.question.domain === options.domain) {
      add(item.question, 'review', 'Повторение по фокусу дня: вопрос уже пора закрепить.');
    }
  }

  if (options.lesson && items.length < size) {
    const lessonQuestions = lessonQuestionIds(index, options.lesson)
      .map((id) => getById(index, id))
      .filter((q): q is Question => q !== undefined && !correct.has(q.id) && !used.has(q.id));
    for (const question of capOpenQuestions(
      lessonQuestions.sort((a, b) => a.difficulty - b.difficulty),
      size - items.length,
    )) {
      add(
        question,
        'daily',
        options.lesson
          ? `Фокус дня: тест по уроку «${options.lesson.title}».`
          : `Фокус дня: ${DOMAIN_LABELS[options.domain]}.`,
      );
    }
  }

  if (lessonIds) {
    for (const id of lessonIds) {
      if (correct.has(id)) used.add(id);
    }
  }

  for (const item of due) {
    if (items.length >= size) break;
    if (item.question.domain === options.domain) {
      add(item.question, 'review', `Повторение внутри фокуса дня: ${DOMAIN_LABELS[options.domain]}.`);
    }
  }

  if (items.length < size) {
    const pool = getByDomain(index, options.domain);
    const target = targetDifficulty(progress.skills[options.domain].ability);
    let guard = pool.length;
    while (items.length < size && guard-- > 0) {
      const question = pickByDifficulty(pool, target, { excludeIds: used, rng });
      if (!question) break;
      add(question, 'daily', `Добор по фокусу дня: ${DOMAIN_LABELS[options.domain]}.`);
    }
  }

  return { kind: 'daily', items };
}
