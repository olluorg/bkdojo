// Pure model behind the "Integer cache" sandbox widget. Mirrors how the JVM
// resolves `==` vs `equals` on boxed Integer: `Integer.valueOf` caches instances
// in the range [-128, cacheMax] (cacheMax is 127 by default, raisable via
// -XX:AutoBoxCacheMax). Two autoboxed values are the *same reference* only when
// both fall in the cache AND have equal value; `equals` always compares by value.

/** Fixed lower bound of the Integer cache per the JLS — not configurable. */
export const INTEGER_CACHE_LOW = -128;

export interface IntegerEquality {
  /** Whether `a` is served from the cache (in [-128, cacheMax]). */
  aCached: boolean;
  /** Whether `b` is served from the cache. */
  bCached: boolean;
  /** Result of `a == b` on the boxed Integers (reference identity). */
  refEqual: boolean;
  /** Result of `a.equals(b)` (value equality). */
  valueEqual: boolean;
}

function inCache(value: number, cacheMax: number): boolean {
  return value >= INTEGER_CACHE_LOW && value <= cacheMax;
}

/**
 * Computes how two autoboxed `Integer`s compare under `==` and `equals`, given the
 * current upper bound of the Integer cache.
 */
export function evalIntegerEquality(a: number, b: number, cacheMax: number): IntegerEquality {
  const aCached = inCache(a, cacheMax);
  const bCached = inCache(b, cacheMax);
  const valueEqual = a === b;
  // `==` is reference identity: same instance only when equal AND both come from
  // the shared cache. Outside the cache each autobox allocates a fresh object.
  const refEqual = valueEqual && aCached && bCached;
  return { aCached, bCached, refEqual, valueEqual };
}
