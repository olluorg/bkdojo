import { DOMAINS, type Domain } from '../domain/models/common';
import type {
  CachedLessonComment,
  DomainSkill,
  TermProgress,
  UserProgress,
} from '../domain/models/progress';
import { DEFAULT_SETTINGS } from '../domain/models/settings';
import { createDefaultPet } from '../domain/pet/pet';

export const PROGRESS_VERSION = 1;
const STORAGE_KEY = 'bkdojo.progress';
const INITIAL_ABILITY = 3;

/** Minimal key/value backend so storage is testable without a real DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStore(): KeyValueStore | null {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch {
    // Accessing localStorage can throw (e.g. disabled cookies).
  }
  return null;
}

function defaultSkill(domain: Domain): DomainSkill {
  return { domain, ability: INITIAL_ABILITY, answered: 0, correct: 0 };
}

export function createDefaultProgress(): UserProgress {
  const skills = {} as Record<Domain, DomainSkill>;
  for (const domain of DOMAINS) skills[domain] = defaultSkill(domain);
  return {
    version: PROGRESS_VERSION,
    skills,
    history: [],
    placementDone: false,
    streakDays: 0,
    terms: {},
    lessonsRead: {},
    lessonBookmarks: {},
    questionBookmarks: {},
    lessonComments: {},
    activity: {},
    pet: createDefaultPet(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Lenient sanity check — the shape must be recognizable; missing domains are backfilled. */
function isValidProgress(value: unknown): value is UserProgress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  if (p.version !== PROGRESS_VERSION) return false;
  if (!Array.isArray(p.history)) return false;
  if (typeof p.placementDone !== 'boolean') return false;
  return typeof p.skills === 'object' && p.skills !== null;
}

/**
 * Forward-compatible migration: keeps existing progress (history, streak, pet,
 * terms) and backfills any newly added domain skills (e.g. when a course is
 * introduced) so the save isn't wiped.
 */
export function normalizeProgress(parsed: UserProgress): UserProgress {
  const defaults = createDefaultProgress();
  const skills = { ...defaults.skills };
  for (const domain of DOMAINS) {
    const existing = parsed.skills?.[domain];
    if (existing && typeof existing.ability === 'number') skills[domain] = existing;
  }
  return {
    ...defaults,
    ...parsed,
    version: PROGRESS_VERSION,
    skills,
    terms: parsed.terms ?? {},
    lessonsRead: parsed.lessonsRead ?? {},
    lessonBookmarks: parsed.lessonBookmarks ?? {},
    questionBookmarks: parsed.questionBookmarks ?? {},
    lessonComments: parsed.lessonComments ?? {},
    activity: parsed.activity ?? {},
    pet: parsed.pet ?? defaults.pet,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    overrideCredits: parsed.overrideCredits,
  };
}

/** Loads progress; returns a fresh default on missing / corrupt data, migrating older saves. */
export function loadProgress(store: KeyValueStore | null = resolveStore()): UserProgress {
  if (!store) return createDefaultProgress();
  const rawValue = store.getItem(STORAGE_KEY);
  if (!rawValue) return createDefaultProgress();
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (isValidProgress(parsed)) return normalizeProgress(parsed);
  } catch {
    // fall through to default
  }
  return createDefaultProgress();
}

export function saveProgress(
  progress: UserProgress,
  store: KeyValueStore | null = resolveStore(),
): void {
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(store: KeyValueStore | null = resolveStore()): void {
  if (!store) return;
  store.removeItem(STORAGE_KEY);
}

/** Serializes progress for export (download). */
export function serializeProgress(progress: UserProgress): string {
  return JSON.stringify(progress, null, 2);
}

/** Parses imported progress JSON, migrating it; returns null if unusable. */
export function parseProgress(raw: string): UserProgress | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidProgress(parsed)) return normalizeProgress(parsed);
  } catch {
    // fall through
  }
  return null;
}

function laterIso(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Union of two id→ISO maps, keeping the earliest timestamp for shared keys. */
function mergeIsoMap(
  base: Record<string, string> = {},
  incoming: Record<string, string> = {},
): Record<string, string> {
  const out: Record<string, string> = { ...incoming, ...base };
  for (const [key, iso] of Object.entries(incoming)) {
    const existing = out[key];
    out[key] = existing && existing <= iso ? existing : iso;
  }
  return out;
}

/**
 * Merges imported progress into the current save without discarding either
 * side. History is unioned (deduped by question + timestamp), aggregates take
 * the stronger value, and id→date maps are unioned. Device-local preferences
 * (settings, theme-independent pet, override credits) stay as they are on this
 * device. This is what import uses, so loading a backup can only add progress,
 * never wipe it.
 */
export function mergeProgress(base: UserProgress, incoming: UserProgress): UserProgress {
  const seen = new Set<string>();
  const history = [...base.history, ...incoming.history]
    .filter((rec) => {
      const key = `${rec.questionId}|${rec.answeredAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  const skills = {} as Record<Domain, DomainSkill>;
  for (const domain of DOMAINS) {
    const a = base.skills?.[domain] ?? defaultSkill(domain);
    const b = incoming.skills?.[domain] ?? defaultSkill(domain);
    // The device that answered more questions has the better-calibrated skill.
    skills[domain] = b.answered > a.answered ? b : a;
  }

  const terms: Record<string, TermProgress> = { ...incoming.terms };
  for (const [id, term] of Object.entries(base.terms ?? {})) {
    const other = terms[id];
    terms[id] = other && other.seen > term.seen ? other : term;
  }

  const lessonComments: Record<string, CachedLessonComment> = { ...incoming.lessonComments };
  for (const [id, comment] of Object.entries(base.lessonComments ?? {})) {
    const other = lessonComments[id];
    lessonComments[id] = other && other.generatedAt > comment.generatedAt ? other : comment;
  }

  const activity: Record<string, string> = { ...incoming.activity };
  for (const [kind, iso] of Object.entries(base.activity ?? {})) {
    activity[kind] = laterIso(activity[kind], iso)!;
  }

  return {
    ...base,
    version: PROGRESS_VERSION,
    history,
    skills,
    terms,
    placementDone: base.placementDone || incoming.placementDone,
    streakDays: Math.max(base.streakDays, incoming.streakDays),
    lastPracticeDate: laterIso(base.lastPracticeDate, incoming.lastPracticeDate),
    lessonsRead: mergeIsoMap(base.lessonsRead, incoming.lessonsRead),
    lessonBookmarks: mergeIsoMap(base.lessonBookmarks, incoming.lessonBookmarks),
    questionBookmarks: mergeIsoMap(base.questionBookmarks, incoming.questionBookmarks),
    lessonComments,
    activity,
  };
}
