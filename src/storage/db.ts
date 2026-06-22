/**
 * Shared IndexedDB connection for bkdojo's learning progress.
 *
 * Progress used to live in a single localStorage blob (`bkdojo.progress`).
 * To enable per-record cross-device sync through the @ollu SDK (which captures
 * IndexedDB writes transparently), the blob is decomposed into the object stores
 * below. The in-memory model is unchanged — see `progressDb.ts` for the
 * blob <-> stores mapping.
 *
 * Object stores (all inline keyPath, so each record carries its own primary key):
 *   skills          keyPath 'domain'  — per-domain ability/counters
 *   history         keyPath 'id'      — answered-question records
 *   terms           keyPath 'termId'  — glossary spaced-repetition state
 *   lessonsRead     keyPath 'id'      — lessonId -> read-at ISO
 *   lessonComments  keyPath 'id'      — lessonId -> cached AI comment
 *   activity        keyPath 'id'      — activity kind -> last-done ISO
 *   events          keyPath 'id'      — append-only learning-event log
 *   singletons      keyPath 'key'     — scalar/singleton progress fields
 *
 * The SDK's own internal stores (`_outbox`, `_kv`, `_meta`) are underscore-prefixed
 * and are created by the proxy on upgrade — they do not collide with ours.
 */

export const DB_NAME = 'bkdojo';
// v2: also create the SDK's internal stores up front (see SDK_INTERNAL_STORES),
// so enabling sync against a DB first created without the proxy still works.
// v3: add the `events` store (append-only learning-event log).
export const DB_VERSION = 3;

/**
 * Stores the @ollu sync proxy keeps for itself (outbox / kv / cursor meta). The
 * proxy creates these on its own upgrade hook, but only fires when the proxy is
 * installed *and* the DB version bumps. Creating them here too means they exist
 * regardless of whether sync was enabled when the DB was first opened — avoiding
 * a broken off→on transition. Names/keyPaths must match the SDK's `INTERNAL_STORES`.
 */
const SDK_INTERNAL_STORES: ReadonlyArray<{ name: string; keyPath: string }> = [
  { name: '_outbox', keyPath: 'id' },
  { name: '_kv', keyPath: 'key' },
  { name: '_meta', keyPath: 'key' },
];

export type ProgressStoreName =
  | 'skills'
  | 'history'
  | 'terms'
  | 'lessonsRead'
  | 'lessonComments'
  | 'activity'
  | 'events'
  | 'singletons';

/** Store -> inline keyPath. Order is the on-disk creation order; also the sync set. */
export const STORE_KEY_PATHS: Record<ProgressStoreName, string> = {
  skills: 'domain',
  history: 'id',
  terms: 'termId',
  lessonsRead: 'id',
  lessonComments: 'id',
  activity: 'id',
  events: 'id',
  singletons: 'key',
};

export const PROGRESS_STORES = Object.keys(STORE_KEY_PATHS) as ProgressStoreName[];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of PROGRESS_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: STORE_KEY_PATHS[name] });
        }
      }
      for (const { name, keyPath } of SDK_INTERNAL_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

export function awaitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

/** Read every record from a single store. */
export async function readAll<T>(store: ProgressStoreName): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return (await awaitReq(tx.objectStore(store).getAll())) as T[];
}

/** Apply a set of puts/deletes to one store in a single transaction. */
export async function writeStore(
  store: ProgressStoreName,
  puts: readonly unknown[],
  deletes: readonly IDBValidKey[],
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const value of puts) os.put(value);
  for (const key of deletes) os.delete(key);
  await awaitTx(tx);
}

/** True when no progress store holds any record (used to gate one-time migration). */
export async function isDbEmpty(): Promise<boolean> {
  const db = await openDb();
  const tx = db.transaction(PROGRESS_STORES, 'readonly');
  for (const name of PROGRESS_STORES) {
    const count = await awaitReq(tx.objectStore(name).count());
    if (count > 0) return false;
  }
  return true;
}
