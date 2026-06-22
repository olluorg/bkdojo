// Pure model behind the animated "Идемпотентность" widget. A payment request can be
// delivered more than once (at-least-once delivery / client retry). With an
// idempotency key the server remembers processed keys and skips the duplicate, so
// the effect (a charge) is applied exactly once; without it every delivery charges
// again. The component animates deliveries; the dedup decision lives here and is tested.

export type DeliveryOutcome = 'applied' | 'duplicate-skipped' | 'applied-no-key';

export interface DedupState {
  /** Idempotency keys the server has already processed. */
  processedKeys: string[];
  /** Number of times the business effect (the charge) was actually applied. */
  charges: number;
}

export interface DeliveryResult {
  state: DedupState;
  /** Whether the charge was applied for this delivery. */
  applied: boolean;
  outcome: DeliveryOutcome;
}

export function initialDedup(): DedupState {
  return { processedKeys: [], charges: 0 };
}

/**
 * Processes one delivery of a request carrying `key`. When `useKey` is on and the
 * key was already processed, the duplicate is skipped (no extra charge); otherwise
 * the charge is applied (and the key remembered, if dedup is on).
 */
export function deliver(state: DedupState, key: string, useKey: boolean): DeliveryResult {
  if (useKey && state.processedKeys.includes(key)) {
    return { state, applied: false, outcome: 'duplicate-skipped' };
  }
  const charges = state.charges + 1;
  const processedKeys = useKey ? [...state.processedKeys, key] : state.processedKeys;
  return {
    state: { processedKeys, charges },
    applied: true,
    outcome: useKey ? 'applied' : 'applied-no-key',
  };
}
