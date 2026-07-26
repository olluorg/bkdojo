import type { ContentIndex } from '../content/contentIndex';
import { DOMAINS, type Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import type { UserProgress } from '../models/progress';
import { lessonStatus } from '../progress/lessonStatus';

/**
 * The gap between the learner and their goal, stated as work rather than as a
 * percentage.
 *
 * "Готовность 62%" tells you nothing you can act on and, worse, is a number a
 * model assigned to you. "До Middle по Spring Boot: 4 темы" names the remaining
 * work, which is both actionable and checkable — and shrinking it is something
 * the learner does, not something the app declares.
 */

export interface DomainGap {
  domain: Domain;
  /** Current readiness for this domain, 0..1. */
  readiness: number;
  /** Lessons in this domain not yet passed — the concrete work left. */
  remainingLessons: number;
}

export interface GapsInput {
  progress: UserProgress;
  index: ContentIndex;
  lessons: Lesson[];
  readinessByDomain: Record<Domain, number>;
  /** Readiness at or above this counts as "closed" and drops out of the list. */
  closedAt?: number;
}

/** Readiness that counts as "this domain is no longer a gap". */
export const GAP_CLOSED_AT = 0.9;

/**
 * Domains still short of the goal, weakest first, each with the number of lessons
 * left to pass. Domains with no remaining lessons are dropped even when readiness
 * is low — there is nothing concrete left to point the learner at.
 */
export function goalGaps({
  progress,
  index,
  lessons,
  readinessByDomain,
  closedAt = GAP_CLOSED_AT,
}: GapsInput): DomainGap[] {
  const byDomain = new Map<Domain, Lesson[]>();
  for (const lesson of lessons) {
    const bucket = byDomain.get(lesson.domain) ?? [];
    bucket.push(lesson);
    byDomain.set(lesson.domain, bucket);
  }

  const gaps: DomainGap[] = [];
  for (const domain of DOMAINS) {
    const readiness = readinessByDomain[domain];
    if (readiness >= closedAt) continue;

    const remainingLessons = (byDomain.get(domain) ?? []).filter(
      (lesson) => lessonStatus(progress, index, lesson) !== 'passed',
    ).length;
    if (remainingLessons === 0) continue;

    gaps.push({ domain, readiness, remainingLessons });
  }

  return gaps.sort((a, b) => a.readiness - b.readiness);
}

/** Russian plural for the lesson count: 1 тема, 2 темы, 5 тем. */
export function pluralTopics(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'тем';
  if (mod10 === 1) return 'тема';
  if (mod10 >= 2 && mod10 <= 4) return 'темы';
  return 'тем';
}
