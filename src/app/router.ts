import { useSyncExternalStore } from 'react';

/**
 * Minimal dependency-free hash router.
 *
 * The whole app lives under `location.hash`, e.g. `#/lessons/java-core-gc/practice`.
 * Screens read the current path via {@link useHashPath} and move with {@link navigate}
 * or plain `<a href={hrefFor(...)}>` links (so back/forward and open-in-new-tab work).
 */

/** Current path without the leading `#`, always starting with `/` (`/` when empty). */
export function getHashPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** Reactive current hash path. Re-renders the component on every navigation. */
export function useHashPath(): string {
  return useSyncExternalStore(subscribe, getHashPath, () => '/');
}

/** Imperative navigation; no-op when already on the target path. */
export function navigate(path: string): void {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (getHashPath() !== clean) {
    window.location.hash = clean;
  }
}

/** Build an `href` for a route, e.g. `hrefFor('/lessons')` → `#/lessons`. */
export function hrefFor(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

/** Split a path into non-empty segments: `/lessons/x/practice` → `['lessons','x','practice']`. */
export function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Session progress is encoded as a trailing `/q<n>` segment (1-based question
 * number), e.g. `/practice/q3` or `/lessons/x/practice/surface/q3`. Keeping the
 * current question in the hash lets a refresh resume the session instead of
 * restarting it. Screens that parse positional segments must ignore this marker
 * (see `STEP_SEGMENT`).
 */
export const STEP_SEGMENT = /^q(\d+)$/;

/** The path with any trailing `/q<n>` step marker stripped. */
export function routeBase(path: string = getHashPath()): string {
  const segs = segments(path);
  if (segs.length > 0 && STEP_SEGMENT.test(segs[segs.length - 1]!)) segs.pop();
  return `/${segs.join('/')}`;
}

/** The 0-based question step encoded in the hash (`…/q3` → 2), or undefined. */
export function stepFromHash(path: string = getHashPath()): number | undefined {
  const last = segments(path).at(-1);
  const match = last ? STEP_SEGMENT.exec(last) : null;
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 ? n - 1 : undefined;
}

/**
 * Reflects the current step in the hash WITHOUT adding a history entry or firing
 * `hashchange` (so it neither spams Back nor triggers a re-render). The URL is
 * updated in place so a refresh can read it back.
 */
export function writeStepToHash(step: number): void {
  if (typeof window === 'undefined') return;
  const base = routeBase();
  const path = `${base === '/' ? '' : base}/q${step + 1}`;
  window.history.replaceState(null, '', `#${path}`);
}

/** Removes the `/q<n>` step marker from the hash (session ended / restarted). */
export function clearStepFromHash(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `#${routeBase()}`);
}
