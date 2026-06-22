// Pure model behind the "HashMap put" stepper. Reproduces HashMap's real mechanics
// at a teachable scale: 32-bit String.hashCode, the spread `h ^ (h >>> 16)`, the
// bucket index `hash & (capacity - 1)`, separate chaining on collision, doubling
// resize past the load-factor threshold, and the treeify hint. Each emitted step
// carries a full table snapshot so the renderer is a pure function of the step.

export const TREEIFY_THRESHOLD = 8;

/** Java's `String.hashCode()`: h = 31*h + ch, wrapped to a signed 32-bit int. */
export function stringHashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** HashMap's `hash(key)` spread: mixes high bits down so they affect the index. */
export function spread(hash: number): number {
  return (hash ^ (hash >>> 16)) | 0;
}

export interface HashEntry {
  key: string;
  /** Spread hash (what HashMap stores and uses for the index). */
  hash: number;
}

/** A bucket is a chain of entries (collision list). */
export type Bucket = HashEntry[];

export type StepAction = 'init' | 'place' | 'collision' | 'resize' | 'treeify';

/** The index derivation shown as a pipeline for a put step. */
export interface StepCompute {
  key: string;
  /** Raw `String.hashCode()`. */
  hashCode: number;
  /** Spread hash `h ^ (h >>> 16)`. */
  spread: number;
  /** Final bucket index `spread & (capacity - 1)`. */
  index: number;
}

export interface HashMapStep {
  action: StepAction;
  /** Deep snapshot of every bucket at this step. */
  table: Bucket[];
  capacity: number;
  size: number;
  /** Bucket the step is about, for highlighting. */
  highlightBucket?: number;
  /** Key just inserted (place/collision), for emphasising its node. */
  newKey?: string;
  /** Index derivation for a put step. */
  compute?: StepCompute;
  /** Capacity before a resize step (the "from" of from→to). */
  resizeFrom?: number;
  /** Human-readable explanation of what just happened. */
  note: string;
}

export interface SimOptions {
  /** Must be a power of two. Default 4 — small so resize is reachable quickly. */
  initialCapacity?: number;
  /** Resize threshold ratio. Default 0.75. */
  loadFactor?: number;
}

/** A balanced default key set that triggers a collision and a resize at capacity 4. */
export const DEFAULT_HASHMAP_KEYS = ['red', 'green', 'blue', 'cyan', 'lime', 'gold'];

function snapshot(table: Bucket[]): Bucket[] {
  return table.map((bucket) => bucket.map((e) => ({ ...e })));
}

function indexFor(hash: number, capacity: number): number {
  return hash & (capacity - 1);
}

/**
 * Simulates inserting `keys` into a HashMap, returning one step per meaningful
 * event (init, each put — flagged as a collision when the bucket was occupied —
 * plus resize / treeify steps).
 */
export function simulateHashMap(keys: string[], opts: SimOptions = {}): HashMapStep[] {
  const loadFactor = opts.loadFactor ?? 0.75;
  let capacity = opts.initialCapacity ?? 4;

  let table: Bucket[] = Array.from({ length: capacity }, () => []);
  let size = 0;
  const steps: HashMapStep[] = [];

  steps.push({
    action: 'init',
    table: snapshot(table),
    capacity,
    size,
    note: `Пустая таблица на ${capacity} бакета. Порог resize = ${capacity} × ${loadFactor} = ${capacity * loadFactor}.`,
  });

  for (const key of keys) {
    const rawHash = stringHashCode(key);
    const hash = spread(rawHash);
    const idx = indexFor(hash, capacity);
    const bucket = table[idx]!; // idx is in range: indexFor masks to [0, capacity)
    const collided = bucket.length > 0;
    bucket.push({ key, hash });
    size++;

    steps.push({
      action: collided ? 'collision' : 'place',
      table: snapshot(table),
      capacity,
      size,
      highlightBucket: idx,
      newKey: key,
      compute: { key, hashCode: rawHash, spread: hash, index: idx },
      note: collided
        ? `«${key}»: индекс = hash & ${capacity - 1} = ${idx}. Бакет занят → коллизия, добавляем в цепочку.`
        : `«${key}»: индекс = hash & ${capacity - 1} = ${idx}. Бакет свободен → кладём напрямую.`,
    });

    // Treeify hint: a chain reaching the threshold (in real HashMap also requires
    // capacity ≥ 64, otherwise it resizes instead — noted for the learner).
    if (bucket.length >= TREEIFY_THRESHOLD) {
      steps.push({
        action: 'treeify',
        table: snapshot(table),
        capacity,
        size,
        highlightBucket: idx,
        note: `Цепочка в бакете ${idx} достигла ${TREEIFY_THRESHOLD} — при ёмкости ≥ 64 список превращается в красно-чёрное дерево (O(log n) вместо O(n)).`,
      });
    }

    // Resize: double capacity and rehash once the threshold is exceeded.
    while (size > capacity * loadFactor) {
      const oldCapacity = capacity;
      capacity *= 2;
      const rehashed: Bucket[] = Array.from({ length: capacity }, () => []);
      for (const oldBucket of table) {
        for (const entry of oldBucket) rehashed[indexFor(entry.hash, capacity)]!.push(entry);
      }
      table = rehashed;
      steps.push({
        action: 'resize',
        table: snapshot(table),
        capacity,
        size,
        resizeFrom: oldCapacity,
        note: `size ${size} > порога ${oldCapacity * loadFactor}: ёмкость ${oldCapacity} → ${capacity}, все элементы перехешированы (индекс = hash & ${capacity - 1}).`,
      });
    }
  }

  return steps;
}
