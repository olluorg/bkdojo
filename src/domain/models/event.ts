import type { Domain } from './common';

/**
 * Append-only log of learning actions, kept alongside `history`.
 *
 * `history` already records every *answer* (with verdict/score/concepts), so we
 * deliberately do NOT duplicate answers here — analytics merges `history` and
 * this log into one timeline. This log captures the actions that otherwise leave
 * no trace over time (lesson opened/completed, term drilled, session lifecycle,
 * placement, override spent), enabling dynamics analysis and on-device forecasts.
 */
export type AppEventType =
  | 'lesson_started'
  | 'lesson_completed'
  | 'term_drilled'
  | 'session_started'
  | 'session_completed'
  | 'placement_completed'
  | 'override_used';

export type SessionKind = 'practice' | 'review' | 'interview';

export interface AppEvent {
  /** Stable primary key (IndexedDB keyPath). Built from `at` + type + ref. */
  id: string;
  type: AppEventType;
  at: string; // ISO
  /** Domain context where applicable (lesson/session). */
  domain?: Domain;
  /** lessonId / termId / session kind — the subject of the event. */
  refId?: string;
  /** For `term_drilled`: whether the answer was correct. */
  correct?: boolean;
}

/** What a caller supplies; `appendEvent` stamps `id` and `at`. */
export type AppEventInput = Omit<AppEvent, 'id' | 'at'>;
