import type { Question } from './question';

export type SessionKind = 'placement' | 'daily' | 'review';
export type SessionReason = 'placement' | 'daily' | 'review';

export interface SessionItem {
  question: Question;
  reason: SessionReason;
}

export interface Session {
  kind: SessionKind;
  items: SessionItem[];
}
