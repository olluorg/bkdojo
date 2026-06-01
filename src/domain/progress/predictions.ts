import type { ContentIndex } from '../content/contentIndex';
import { DOMAINS, type Domain } from '../models/common';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { levelLabel, type Level } from '../ability/level';
import { dailyAccuracy, trendSlope } from './analytics';
import { domainMastery, MASTERY_TARGET, overallMastery, overallRank } from './mastery';
import { streakInfo } from './streak';

/**
 * On-device forecasts derived purely from the local record — no network, no keys
 * (per the MVP constraints). The heuristics are intentionally simple and
 * transparent: recent pace (correct answers per active day) projected linearly
 * onto the remaining mastery gap, plus a slope of recent accuracy for the trend.
 */

/** Composite readiness at/above which we call the learner "interview-ready". */
const READY_SCORE = 0.6;
/** Per-domain mastery target used for the domain ETA. */
const DOMAIN_TARGET = 0.8;
/** Window (days) used to estimate recent learning pace and accuracy trend. */
const PACE_WINDOW = 14;

export type Trend = 'up' | 'flat' | 'down';

function accuracyTrend(history: readonly AnswerRecord[], now: Date): Trend {
  const active = dailyAccuracy(history, PACE_WINDOW, now).filter((d) => d.answered > 0);
  const slope = trendSlope(active.map((d) => d.accuracy));
  if (slope > 0.01) return 'up';
  if (slope < -0.01) return 'down';
  return 'flat';
}

/**
 * Correct answers per active day over the window — our proxy for learning speed.
 * Roughly `MASTERY_TARGET` correct answers turn one question from unseen to
 * mastered, so `pace / MASTERY_TARGET` ≈ questions mastered per active day.
 */
function correctPerActiveDay(history: readonly AnswerRecord[], now: Date): number {
  const active = dailyAccuracy(history, PACE_WINDOW, now).filter((d) => d.answered > 0);
  if (active.length === 0) return 0;
  return active.reduce((s, d) => s + d.correct, 0) / active.length;
}

/** Days to close a coverage gap at the current pace; undefined when pace is zero. */
function coverageEta(
  remainingFraction: number,
  totalQuestions: number,
  correctPerDay: number,
): number | undefined {
  if (remainingFraction <= 0) return 0;
  const masteredPerDay = correctPerDay / MASTERY_TARGET;
  if (masteredPerDay <= 0) return undefined;
  const remaining = remainingFraction * totalQuestions;
  return Math.ceil(remaining / masteredPerDay);
}

export interface ReadinessForecast {
  score: number; // 0..1 composite (rank score)
  ready: boolean; // score >= READY_SCORE
  trend: Trend; // recent accuracy direction
  etaDays?: number; // projected days to READY_SCORE (0 if already ready, undefined if no pace)
}

export function interviewReadiness(
  progress: UserProgress,
  index: ContentIndex,
  now: Date = new Date(),
): ReadinessForecast {
  const { score, coverage } = overallRank(progress, index);
  const trend = accuracyTrend(progress.history ?? [], now);
  // Project via coverage (the half of the score we can grow by answering);
  // close the gap from current overall mastery up to READY_SCORE.
  const remaining = Math.max(0, READY_SCORE - coverage);
  const etaDays =
    score >= READY_SCORE
      ? 0
      : coverageEta(remaining, index.all.length, correctPerActiveDay(progress.history ?? [], now));
  return { score, ready: score >= READY_SCORE, trend, etaDays };
}

export type StreakRiskLevel = 'safe' | 'at-risk' | 'none';

export interface StreakRisk {
  level: StreakRiskLevel;
  days: number;
  /** True when the streak will break unless the learner practices today. */
  willBreak: boolean;
}

export function streakRisk(progress: UserProgress, now: Date = new Date()): StreakRisk {
  const info = streakInfo(progress, now);
  if (info.state === 'active') return { level: 'safe', days: info.days, willBreak: false };
  if (info.state === 'at-risk') return { level: 'at-risk', days: info.days, willBreak: true };
  return { level: 'none', days: 0, willBreak: false };
}

export interface DomainForecast {
  domain: Domain;
  mastery: number; // 0..1
  level: Level;
  etaDays?: number; // days to DOMAIN_TARGET mastery at current pace
}

export function domainForecast(
  progress: UserProgress,
  index: ContentIndex,
  domain: Domain,
  now: Date = new Date(),
): DomainForecast {
  const mastery = domainMastery(progress, index, domain);
  const ability = progress.skills[domain]?.ability ?? 1;
  const domainHistory = (progress.history ?? []).filter((r) => r.domain === domain);
  const total = index.byDomain.get(domain)?.length ?? 0;
  const etaDays = coverageEta(
    Math.max(0, DOMAIN_TARGET - mastery),
    total,
    correctPerActiveDay(domainHistory, now),
  );
  return { domain, mastery, level: levelLabel(ability), etaDays };
}

/** Forecast for every domain that has any content. */
export function allDomainForecasts(
  progress: UserProgress,
  index: ContentIndex,
  now: Date = new Date(),
): DomainForecast[] {
  return DOMAINS.filter((d) => (index.byDomain.get(d)?.length ?? 0) > 0).map((d) =>
    domainForecast(progress, index, d, now),
  );
}

/** Re-export so callers can show the same overall coverage the rank uses. */
export { overallMastery };
