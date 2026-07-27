// Pure model behind the "ArrayList growth" sandbox. Reproduces the real growth
// rule from OpenJDK's `ArrayList.grow`: capacity goes up by half (oldCapacity +
// (oldCapacity >> 1)), starting from 10 for the default constructor, and every
// growth copies the whole backing array. It exists to make the amortised O(1)
// claim checkable rather than memorised: the sandbox shows how few copies happen
// and how the total copy work stays linear in the number of elements.

/** Capacity the default (no-arg) constructor lands on at the first add. */
export const DEFAULT_CAPACITY = 10;

export interface GrowthEvent {
  /** Size at which the array ran out of room and had to grow. */
  atSize: number;
  from: number;
  to: number;
  /** Elements copied by this growth — the cost of the operation. */
  copied: number;
}

export interface GrowthResult {
  /** Capacity after the last add. */
  finalCapacity: number;
  events: GrowthEvent[];
  /** Total elements copied across all growths. */
  totalCopied: number;
  /** Wasted slots: allocated but unused. */
  slack: number;
  /**
   * Average number of element copies per add. The whole point: it stays below a
   * small constant no matter how many elements are added.
   */
  copiesPerAdd: number;
}

/** OpenJDK's rule: grow by half, but never below what the caller asked for. */
export function nextCapacity(current: number): number {
  const grown = current + (current >> 1);
  return grown > current ? grown : current + 1;
}

/**
 * Simulates `adds` calls to `add` on a list created with `initialCapacity`
 * (0 meaning the default constructor, which defers allocation until the first add).
 */
export function simulateGrowth(adds: number, initialCapacity = 0): GrowthResult {
  const events: GrowthEvent[] = [];
  let capacity = initialCapacity;
  let totalCopied = 0;

  for (let size = 0; size < adds; size++) {
    if (size < capacity) continue;

    const from = capacity;
    // The default constructor allocates lazily, and the first add jumps to 10.
    const to = capacity === 0 ? Math.max(DEFAULT_CAPACITY, initialCapacity) : nextCapacity(capacity);
    // Growing from nothing allocates but copies no elements.
    const copied = from;
    capacity = to;
    totalCopied += copied;
    events.push({ atSize: size, from, to, copied });
  }

  return {
    finalCapacity: capacity,
    events,
    totalCopied,
    slack: Math.max(0, capacity - adds),
    copiesPerAdd: adds === 0 ? 0 : totalCopied / adds,
  };
}
