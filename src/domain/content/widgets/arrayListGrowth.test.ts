import { describe, expect, it } from 'bun:test';
import { DEFAULT_CAPACITY, nextCapacity, simulateGrowth } from './arrayListGrowth';

describe('nextCapacity', () => {
  it('grows by half, like ArrayList.grow', () => {
    expect(nextCapacity(10)).toBe(15);
    expect(nextCapacity(15)).toBe(22);
    expect(nextCapacity(22)).toBe(33);
  });

  it('always makes progress on tiny capacities', () => {
    // 1 + (1 >> 1) = 1 would loop forever, so the rule must bump it.
    expect(nextCapacity(1)).toBe(2);
    expect(nextCapacity(2)).toBe(3);
  });
});

describe('simulateGrowth', () => {
  it('defers allocation and jumps to the default capacity on the first add', () => {
    const result = simulateGrowth(1);
    expect(result.events[0]).toEqual({ atSize: 0, from: 0, to: DEFAULT_CAPACITY, copied: 0 });
    expect(result.finalCapacity).toBe(DEFAULT_CAPACITY);
  });

  it('reproduces the documented capacity sequence', () => {
    const result = simulateGrowth(40);
    expect(result.events.map((e) => e.to)).toEqual([10, 15, 22, 33, 49]);
  });

  it('always ends with capacity enough for every element', () => {
    for (const adds of [0, 1, 7, 100, 1000, 12345]) {
      expect(simulateGrowth(adds).finalCapacity).toBeGreaterThanOrEqual(adds);
    }
  });

  it('never grows when the capacity was presized', () => {
    // Sizing the list up front allocates in the constructor, so no add ever
    // reallocates and nothing is copied — the practical takeaway of the topic.
    const result = simulateGrowth(1000, 1000);
    expect(result.events).toEqual([]);
    expect(result.totalCopied).toBe(0);
  });

  it('keeps copy work linear: cost per add stays under a small constant', () => {
    // This is the amortised O(1) claim, stated as something checkable.
    for (const adds of [100, 10_000, 1_000_000]) {
      expect(simulateGrowth(adds).copiesPerAdd).toBeLessThan(3);
    }
  });

  it('grows logarithmically often, not linearly', () => {
    const small = simulateGrowth(1_000).events.length;
    const large = simulateGrowth(1_000_000).events.length;
    // A thousandfold more elements costs only a handful more reallocations.
    expect(large - small).toBeLessThan(20);
  });

  it('reports the slack left in the backing array', () => {
    const result = simulateGrowth(11);
    expect(result.finalCapacity).toBe(15);
    expect(result.slack).toBe(4);
  });
});
