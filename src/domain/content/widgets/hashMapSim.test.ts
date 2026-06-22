import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_HASHMAP_KEYS,
  simulateHashMap,
  spread,
  stringHashCode,
  TREEIFY_THRESHOLD,
  type HashMapStep,
} from './hashMapSim';

function totalEntries(step: HashMapStep): number {
  return step.table.reduce((n, bucket) => n + bucket.length, 0);
}

describe('stringHashCode', () => {
  it('matches Java String.hashCode for known values', () => {
    // "a" = 97; "ab" = 31*97 + 98 = 3105; "hello" = 99162322.
    expect(stringHashCode('a')).toBe(97);
    expect(stringHashCode('ab')).toBe(3105);
    expect(stringHashCode('hello')).toBe(99162322);
  });
});

describe('spread', () => {
  it('mixes the high 16 bits into the low bits', () => {
    expect(spread(0)).toBe(0);
    // h ^ (h >>> 16): for a value with only high bits set, low bits change.
    expect(spread(0x00010000)).toBe(0x00010001);
  });
});

describe('simulateHashMap', () => {
  it('starts with an init step and emits one put per key', () => {
    const steps = simulateHashMap(DEFAULT_HASHMAP_KEYS, { initialCapacity: 4 });
    expect(steps[0]?.action).toBe('init');
    const puts = steps.filter((s) => s.action === 'place' || s.action === 'collision');
    expect(puts.length).toBe(DEFAULT_HASHMAP_KEYS.length);
  });

  it('keeps size monotonic and the snapshot consistent with size', () => {
    const steps = simulateHashMap(DEFAULT_HASHMAP_KEYS, { initialCapacity: 4 });
    let prev = -1;
    for (const step of steps) {
      expect(step.size).toBeGreaterThanOrEqual(prev);
      prev = step.size;
      expect(totalEntries(step)).toBe(step.size);
      expect(step.table.length).toBe(step.capacity);
    }
  });

  it('resizes by doubling once the load-factor threshold is exceeded', () => {
    const steps = simulateHashMap(DEFAULT_HASHMAP_KEYS, { initialCapacity: 4, loadFactor: 0.75 });
    const resizes = steps.filter((s) => s.action === 'resize');
    expect(resizes.length).toBeGreaterThanOrEqual(1);
    // 6 keys, cap 4, threshold 3 → first resize on the 4th insert to capacity 8.
    expect(resizes[0]?.capacity).toBe(8);
  });

  it('preserves all keys across rehashing', () => {
    const steps = simulateHashMap(DEFAULT_HASHMAP_KEYS, { initialCapacity: 4 });
    const last = steps[steps.length - 1]!;
    const keys = last.table.flat().map((e) => e.key).sort();
    expect(keys).toEqual([...DEFAULT_HASHMAP_KEYS].sort());
  });

  it('emits a treeify step when a chain reaches the threshold (resize disabled)', () => {
    // capacity 1 → every key lands in bucket 0; infinite load factor → no resize.
    const keys = Array.from({ length: TREEIFY_THRESHOLD }, (_, i) => `k${i}`);
    const steps = simulateHashMap(keys, { initialCapacity: 1, loadFactor: Infinity });
    expect(steps.some((s) => s.action === 'treeify')).toBe(true);
  });
});
