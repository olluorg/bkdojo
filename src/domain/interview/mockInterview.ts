import { getByDomain, type ContentIndex } from '../content/contentIndex';
import type { AnswerOutcome } from '../models/answer';
import { DOMAIN_LABELS, type Domain } from '../models/common';
import type { Question } from '../models/question';
import type { Session, SessionItem } from '../models/session';
import type { Rank } from '../progress/mastery';
import { shuffle } from '../util/shuffle';

export interface MockOptions {
  size?: number;
  rng?: () => number;
}

/**
 * Builds a mock interview for one domain: a spread across difficulties, ramped
 * easy→hard (like a real interview). Mixed types come naturally from the pool.
 */
export function buildMockInterview(
  index: ContentIndex,
  domain: Domain,
  options: MockOptions = {},
): Session {
  const size = options.size ?? 8;
  const rng = options.rng ?? Math.random;

  const byDifficulty = new Map<number, Question[]>();
  for (const q of getByDomain(index, domain)) {
    const bucket = byDifficulty.get(q.difficulty) ?? [];
    bucket.push(q);
    byDifficulty.set(q.difficulty, bucket);
  }
  const difficulties = [...byDifficulty.keys()].sort((a, b) => a - b);
  for (const d of difficulties) byDifficulty.set(d, shuffle(byDifficulty.get(d)!, rng));

  const picked: Question[] = [];
  let added = true;
  while (picked.length < size && added) {
    added = false;
    for (const d of difficulties) {
      if (picked.length >= size) break;
      const q = byDifficulty.get(d)!.pop();
      if (q) {
        picked.push(q);
        added = true;
      }
    }
  }

  const items: SessionItem[] = picked
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((question) => ({
      question,
      reason: 'daily' as const,
      reasonText: `Интервью по теме: ${DOMAIN_LABELS[domain]}.`,
    }));

  return { kind: 'daily', items };
}

export interface InterviewSummary {
  total: number;
  correct: number;
  avgScore: number; // 0..1
  level: Rank;
}

/** Maps the average answer score to an interview level (caps at architect). */
export function interviewLevel(avgScore: number): Rank {
  if (avgScore >= 0.9) return 'architect';
  if (avgScore >= 0.7) return 'senior';
  if (avgScore >= 0.45) return 'middle';
  return 'junior';
}

export function summarizeInterview(outcomes: AnswerOutcome[]): InterviewSummary {
  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.verdict === 'correct').length;
  const avgScore = total === 0 ? 0 : outcomes.reduce((s, o) => s + o.score, 0) / total;
  return { total, correct, avgScore, level: interviewLevel(avgScore) };
}
