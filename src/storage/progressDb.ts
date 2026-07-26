/**
 * Bridges the in-memory `UserProgress` model and the per-record IndexedDB stores
 * defined in `db.ts`.
 *
 * `decompose`/`recompose` are pure (and unit-tested): they map the single progress
 * object to/from the flat record sets that the @ollu sync proxy captures per-record.
 * `persistProgress` diffs the previous vs next decomposition and writes only the
 * records that actually changed, so a local edit produces the minimal set of sync
 * ops (and incoming-sync reloads produce none).
 */

import type { Domain } from '../domain/models/common';
import type { AppEvent } from '../domain/models/event';
import type {
  AnswerRecord,
  CachedLessonComment,
  DomainSkill,
  TermProgress,
  UserProgress,
} from '../domain/models/progress';
import {
  PROGRESS_STORES,
  STORE_KEY_PATHS,
  isDbEmpty,
  readAll,
  writeStore,
  type ProgressStoreName,
} from './db';
import { createDefaultProgress, loadProgress, normalizeProgress } from './progressStorage';

/**
 * Window event dispatched after incoming sync ops are applied to IndexedDB.
 * Declared here (sync-free) so `ProgressContext` can listen for it without
 * statically importing the SDK bundle.
 */
export const INCOMING_EVENT = 'bkdojo-incoming';

// Stored record shapes (each carries its store's inline key).
type SkillRecord = DomainSkill; // keyPath 'domain'
type HistoryRecord = AnswerRecord & { id: string }; // keyPath 'id'
type TermRecord = TermProgress; // keyPath 'termId'
interface LessonReadRecord {
  id: string;
  readAt: string;
}
interface LessonCommentRecord {
  id: string;
  comment: CachedLessonComment;
}
interface ActivityRecord {
  id: string;
  at: string;
}
type EventRecord = AppEvent; // keyPath 'id'
interface SingletonRecord {
  key: string;
  value: unknown;
}

/** Scalar / singleton progress fields, each stored as one `singletons` row. */
const SINGLETON_KEYS = [
  'version',
  'placementDone',
  'streakDays',
  'lastPracticeDate',
  'lastAiAvailability',
  'settings',
  // Stored whole rather than per-record: the map is small and adding a store
  // would need a db version bump for no practical gain.
  'defendedLessons',
] as const;
type SingletonKey = (typeof SINGLETON_KEYS)[number];

export type DecomposedProgress = Record<ProgressStoreName, unknown[]>;

/** Stable per-attempt key. `answeredAt` is ISO-with-ms, unique enough per question. */
function historyId(record: AnswerRecord): string {
  return `${record.answeredAt}#${record.questionId}`;
}

export function decompose(progress: UserProgress): DecomposedProgress {
  const skills: SkillRecord[] = Object.values(progress.skills ?? {});
  const history: HistoryRecord[] = (progress.history ?? []).map((r) => ({
    ...r,
    id: historyId(r),
  }));
  const terms: TermRecord[] = Object.values(progress.terms ?? {});
  const lessonsRead: LessonReadRecord[] = Object.entries(progress.lessonsRead ?? {}).map(
    ([id, readAt]) => ({ id, readAt }),
  );
  const lessonComments: LessonCommentRecord[] = Object.entries(
    progress.lessonComments ?? {},
  ).map(([id, comment]) => ({ id, comment }));
  const activity: ActivityRecord[] = Object.entries(progress.activity ?? {}).map(
    ([id, at]) => ({ id, at }),
  );
  const events: EventRecord[] = [...(progress.events ?? [])];
  const singletons: SingletonRecord[] = SINGLETON_KEYS.flatMap((key) => {
    const value = (progress as unknown as Record<string, unknown>)[key];
    return value === undefined ? [] : [{ key, value }];
  });

  return { skills, history, terms, lessonsRead, lessonComments, activity, events, singletons };
}

export function recompose(records: DecomposedProgress): UserProgress {
  const skills = {} as Record<Domain, DomainSkill>;
  for (const s of records.skills as SkillRecord[]) skills[s.domain] = s;

  const history = [...(records.history as HistoryRecord[])]
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
    .map(({ id: _id, ...rest }) => rest as AnswerRecord);

  const terms: Record<string, TermProgress> = {};
  for (const t of records.terms as TermRecord[]) terms[t.termId] = t;

  const lessonsRead: Record<string, string> = {};
  for (const l of records.lessonsRead as LessonReadRecord[]) lessonsRead[l.id] = l.readAt;

  const lessonComments: Record<string, CachedLessonComment> = {};
  for (const c of records.lessonComments as LessonCommentRecord[]) {
    lessonComments[c.id] = c.comment;
  }

  const activity: Record<string, string> = {};
  for (const a of records.activity as ActivityRecord[]) activity[a.id] = a.at;

  const events = [...(records.events as EventRecord[])].sort((a, b) => a.at.localeCompare(b.at));

  const singletons: Partial<Record<SingletonKey, unknown>> = {};
  for (const row of records.singletons as SingletonRecord[]) {
    singletons[row.key as SingletonKey] = row.value;
  }

  // Reuse the canonical migration/backfill so missing domains, settings, pet etc.
  // are populated exactly as a localStorage load would produce.
  const assembled = {
    ...createDefaultProgress(),
    ...singletons,
    skills,
    history,
    terms,
    lessonsRead,
    lessonComments,
    activity,
    events,
  } as UserProgress;
  return normalizeProgress(assembled);
}

interface StoreDiff {
  puts: unknown[];
  deletes: IDBValidKey[];
}

function keyOf(store: ProgressStoreName, record: unknown): string {
  return String((record as Record<string, unknown>)[STORE_KEY_PATHS[store]]);
}

function diffStore(
  store: ProgressStoreName,
  prev: readonly unknown[],
  next: readonly unknown[],
): StoreDiff {
  const prevMap = new Map(prev.map((r) => [keyOf(store, r), r]));
  const nextMap = new Map(next.map((r) => [keyOf(store, r), r]));
  const puts: unknown[] = [];
  for (const [key, record] of nextMap) {
    const before = prevMap.get(key);
    if (before === undefined || JSON.stringify(before) !== JSON.stringify(record)) {
      puts.push(record);
    }
  }
  const deletes: IDBValidKey[] = [];
  for (const key of prevMap.keys()) {
    if (!nextMap.has(key)) deletes.push(key);
  }
  return { puts, deletes };
}

const EMPTY: DecomposedProgress = {
  skills: [],
  history: [],
  terms: [],
  lessonsRead: [],
  lessonComments: [],
  activity: [],
  events: [],
  singletons: [],
};

/**
 * Writes the difference between `prev` and `next` into IndexedDB. Pass `null` for
 * `prev` to write everything (used when seeding). When the sync proxy is installed
 * these writes are captured into the outbox automatically.
 */
export async function persistProgress(
  prev: UserProgress | null,
  next: UserProgress,
): Promise<void> {
  const before = prev ? decompose(prev) : EMPTY;
  const after = decompose(next);
  for (const store of PROGRESS_STORES) {
    const { puts, deletes } = diffStore(store, before[store], after[store]);
    await writeStore(store, puts, deletes);
  }
}

/** Reassembles the full progress object from the IndexedDB stores. */
export async function loadProgressFromDb(): Promise<UserProgress> {
  const records = {} as DecomposedProgress;
  for (const store of PROGRESS_STORES) {
    records[store] = await readAll(store);
  }
  return recompose(records);
}

/**
 * One-time move from the legacy localStorage blob into IndexedDB. Runs only when
 * the DB is still empty; the localStorage key is left in place as a fallback.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (!(await isDbEmpty())) return;
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem('bkdojo.progress') ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return;
  await persistProgress(null, loadProgress());
}
