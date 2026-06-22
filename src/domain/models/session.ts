import type { Question } from './question';

export type SessionKind = 'placement' | 'daily' | 'review';
export type SessionReason = 'placement' | 'daily' | 'review';

export interface SessionItem {
  question: Question;
  reason: SessionReason;
  /** Short learner-facing explanation of why this question is in the session. */
  reasonText?: string;
}

export interface Session {
  kind: SessionKind;
  items: SessionItem[];
}
