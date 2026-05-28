import type { Session } from '../domain/models/session';

/**
 * Per-tab persistence of the in-progress session so a page refresh resumes at
 * the same question instead of rebuilding a (potentially different) session.
 *
 * Uses `sessionStorage`: it survives refresh but is scoped to the tab and cleared
 * when the tab closes — exactly the lifetime we want for a transient session.
 * Keyed by the route base (e.g. `/practice`, `/lessons/x/practice/surface`).
 */

const PREFIX = 'bkdojo.activeSession:';

export interface StoredSession {
  session: Session;
  step: number;
}

function store(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null; // access can throw (privacy mode, disabled storage)
  }
}

export function loadActiveSession(key: string): StoredSession | null {
  const s = store();
  if (!s) return null;
  const raw = s.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      Array.isArray((value as StoredSession).session?.items) &&
      typeof (value as StoredSession).step === 'number'
    ) {
      return value as StoredSession;
    }
  } catch {
    // corrupt entry — ignore
  }
  return null;
}

export function saveActiveSession(key: string, session: Session, step: number): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(PREFIX + key, JSON.stringify({ session, step }));
  } catch {
    // quota / serialization failure — non-fatal
  }
}

export function clearActiveSession(key: string): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
