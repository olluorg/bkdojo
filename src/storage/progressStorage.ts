import { DOMAINS, type Domain } from '../domain/models/common';
import type { DomainSkill, UserProgress } from '../domain/models/progress';
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
function normalizeProgress(parsed: UserProgress): UserProgress {
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
