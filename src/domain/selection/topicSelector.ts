import type { ContentIndex } from '../content/contentIndex';
import { getByDomain } from '../content/contentIndex';
import type { Domain } from '../models/common';
import type { Question } from '../models/question';
import type { Session, SessionItem } from '../models/session';
import { capOpenQuestions } from './questionMix';

export interface TopicOptions {
  /** Keep only questions whose tags intersect these (falls back to all if none match). */
  tags?: string[];
  /** Keep only questions of these difficulties (falls back to all if none match). */
  difficulties?: number[];
  /** Drop these question ids outright (e.g. already answered correctly). No fallback. */
  excludeIds?: ReadonlySet<string>;
  size?: number;
}

/**
 * The candidate questions for a topic: domain questions narrowed by tag and
 * difficulty bands. Each band falls back to the wider pool when it would empty
 * the result, so a learner is never left with nothing to practise. The
 * `excludeIds` filter is intentionally NOT subject to fallback — see
 * `buildTopicSession`. Exposed so callers can tell "topic has no questions" from
 * "everything here is already done".
 */
export function selectTopicPool(
  index: ContentIndex,
  domain: Domain,
  options: TopicOptions = {},
): Question[] {
  let pool = getByDomain(index, domain);

  if (options.tags && options.tags.length > 0) {
    const wanted = new Set(options.tags);
    const filtered = pool.filter((q) => q.tags.some((t) => wanted.has(t)));
    if (filtered.length > 0) pool = filtered;
  }

  if (options.difficulties && options.difficulties.length > 0) {
    const wanted = new Set(options.difficulties);
    const filtered = pool.filter((q) => wanted.has(q.difficulty));
    if (filtered.length > 0) pool = filtered;
  }

  return pool;
}

/**
 * Builds a daily session from an explicit set of questions (e.g. a lesson's
 * `questionIds`). Questions are ordered easiest-first, open answers capped to
 * ≤25% of the session (directive 5), and already-correct questions removed via
 * `excludeIds` so a retake only surfaces what still needs work.
 */
export function buildSessionFromQuestions(
  questions: Question[],
  options: { size?: number; excludeIds?: ReadonlySet<string> } = {},
): Session {
  let pool = questions;
  if (options.excludeIds && options.excludeIds.size > 0) {
    pool = pool.filter((q) => !options.excludeIds!.has(q.id));
  }

  const ordered = [...pool].sort((a, b) => a.difficulty - b.difficulty);
  const items: SessionItem[] = capOpenQuestions(ordered, options.size ?? 10)
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((question) => ({ question, reason: 'daily' as const }));

  return { kind: 'daily', items };
}

/**
 * Builds a focused session for "practice this topic" by tag/difficulty.
 * Retained for tag-based practice; lesson tests build from explicit
 * `questionIds` via `buildSessionFromQuestions` instead.
 */
export function buildTopicSession(
  index: ContentIndex,
  domain: Domain,
  options: TopicOptions = {},
): Session {
  return buildSessionFromQuestions(selectTopicPool(index, domain, options), {
    size: options.size,
    excludeIds: options.excludeIds,
  });
}
