import type { AppEvent, AppEventInput } from '../models/event';
import type { UserProgress } from '../models/progress';

/**
 * Builds the stable id for an event. `at` is ISO-with-ms; including the type and
 * the subject ref keeps two events stamped in the same millisecond distinct
 * (and makes cross-device merge dedup by id deterministic).
 */
function eventId(at: string, input: AppEventInput): string {
  return `${at}#${input.type}#${input.refId ?? ''}`;
}

/** Pure fold: appends one event (stamping id/at) to the progress log. */
export function appendEvent(
  progress: UserProgress,
  input: AppEventInput,
  now: Date = new Date(),
): UserProgress {
  const at = now.toISOString();
  const event: AppEvent = { ...input, id: eventId(at, input), at };
  return { ...progress, events: [...(progress.events ?? []), event] };
}

/** Most recent events first, optionally capped to `limit`. */
export function recentEvents(progress: UserProgress, limit?: number): AppEvent[] {
  const sorted = [...(progress.events ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}
