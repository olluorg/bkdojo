import { describe, expect, it } from 'bun:test';
import { evalIntegerEquality, INTEGER_CACHE_LOW } from './integerCache';

describe('evalIntegerEquality', () => {
  it('treats equal small values as the same reference (cache hit)', () => {
    const r = evalIntegerEquality(100, 100, 127);
    expect(r.aCached).toBe(true);
    expect(r.bCached).toBe(true);
    expect(r.refEqual).toBe(true);
    expect(r.valueEqual).toBe(true);
  });

  it('treats equal large values as distinct references (outside cache)', () => {
    const r = evalIntegerEquality(1000, 1000, 127);
    expect(r.aCached).toBe(false);
    expect(r.bCached).toBe(false);
    expect(r.refEqual).toBe(false);
    expect(r.valueEqual).toBe(true);
  });

  it('never reports reference equality for different values', () => {
    const r = evalIntegerEquality(5, 6, 127);
    expect(r.refEqual).toBe(false);
    expect(r.valueEqual).toBe(false);
  });

  it('honours the cache boundaries [-128, cacheMax]', () => {
    expect(evalIntegerEquality(INTEGER_CACHE_LOW, INTEGER_CACHE_LOW, 127).refEqual).toBe(true);
    expect(evalIntegerEquality(127, 127, 127).refEqual).toBe(true);
    expect(evalIntegerEquality(128, 128, 127).refEqual).toBe(false);
    expect(evalIntegerEquality(-129, -129, 127).refEqual).toBe(false);
  });

  it('extends reference equality when AutoBoxCacheMax is raised', () => {
    expect(evalIntegerEquality(1000, 1000, 127).refEqual).toBe(false);
    expect(evalIntegerEquality(1000, 1000, 1000).refEqual).toBe(true);
  });
});
