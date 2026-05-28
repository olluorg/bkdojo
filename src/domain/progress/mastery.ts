import { getByDomain, type ContentIndex } from '../content/contentIndex';
import { DOMAINS, type Domain } from '../models/common';
import type { UserProgress } from '../models/progress';
import { consecutiveCorrect } from '../review/spacedRepetition';
import { clamp01 } from '../util/math';

/** Correct answers in a row that count a question as fully mastered. */
export const MASTERY_TARGET = 2;

/** 0..1 — how well a single question is learned (graded by recent correct streak). */
export function questionMastery(progress: UserProgress, questionId: string): number {
  const streak = consecutiveCorrect(progress.history, questionId);
  return Math.min(streak, MASTERY_TARGET) / MASTERY_TARGET;
}

function averageMastery(progress: UserProgress, questionIds: string[]): number {
  if (questionIds.length === 0) return 0;
  let sum = 0;
  for (const id of questionIds) sum += questionMastery(progress, id);
  return sum / questionIds.length;
}

export function domainMastery(
  progress: UserProgress,
  index: ContentIndex,
  domain: Domain,
): number {
  return averageMastery(
    progress,
    getByDomain(index, domain).map((q) => q.id),
  );
}

/** Mastery across the questions of a domain whose tags intersect `tags`. */
export function topicMastery(
  progress: UserProgress,
  index: ContentIndex,
  domain: Domain,
  tags: string[],
): number {
  if (tags.length === 0) return 0;
  const wanted = new Set(tags);
  const ids = getByDomain(index, domain)
    .filter((q) => q.tags.some((t) => wanted.has(t)))
    .map((q) => q.id);
  return averageMastery(progress, ids);
}

export function overallMastery(progress: UserProgress, index: ContentIndex): number {
  return averageMastery(
    progress,
    index.all.map((q) => q.id),
  );
}

export type Rank = 'junior' | 'middle' | 'senior' | 'architect' | 'staff';

export const RANK_LABELS: Record<Rank, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  architect: 'Architect',
  staff: 'Staff',
};

export interface RankResult {
  rank: Rank;
  score: number; // 0..1 composite
  avgAbility: number; // 1..5
  coverage: number; // 0..1 overall mastery
}

/**
 * Overall interview-readiness rank. Climbing requires BOTH skill (Elo ability)
 * and breadth (how much content is mastered), so a strong user still has to
 * cover the material to reach the top ranks.
 */
export function overallRank(progress: UserProgress, index: ContentIndex): RankResult {
  const avgAbility =
    DOMAINS.reduce((sum, d) => sum + progress.skills[d].ability, 0) / DOMAINS.length;
  const coverage = overallMastery(progress, index);

  const abilityNorm = clamp01((avgAbility - 1) / 4);
  const score = clamp01(0.5 * abilityNorm + 0.5 * coverage);

  const rank: Rank =
    score >= 0.88
      ? 'staff'
      : score >= 0.7
        ? 'architect'
        : score >= 0.5
          ? 'senior'
          : score >= 0.3
            ? 'middle'
            : 'junior';

  return { rank, score, avgAbility, coverage };
}
