// Pure state machine behind the animated "Circuit breaker" widget. Reproduces the
// three-state breaker from the lesson: CLOSED counts failures and trips to OPEN at a
// threshold; OPEN short-circuits every call (protecting threads) until a cooldown
// elapses, then moves to HALF_OPEN; HALF_OPEN lets a few trial calls through and
// either closes again (enough successes) or re-opens on the first failure. The
// component drives this with timers; the transitions themselves are pure & tested.

export type BreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerConfig {
  /** Consecutive failures in CLOSED that trip the breaker to OPEN. */
  failureThreshold: number;
  /** Successful trial calls in HALF_OPEN needed to return to CLOSED. */
  halfOpenTrials: number;
  /** How long OPEN lasts before a HALF_OPEN probe is allowed (ms). */
  cooldownMs: number;
}

export interface BreakerState {
  status: BreakerStatus;
  /** Consecutive failures counted while CLOSED. */
  failures: number;
  /** Successful trial calls accumulated while HALF_OPEN. */
  trialSuccesses: number;
  /** Timestamp the breaker entered OPEN, for the cooldown (null otherwise). */
  openedAt: number | null;
}

export const DEFAULT_BREAKER_CONFIG: BreakerConfig = {
  failureThreshold: 3,
  halfOpenTrials: 2,
  cooldownMs: 4000,
};

export function initialBreaker(): BreakerState {
  return { status: 'CLOSED', failures: 0, trialSuccesses: 0, openedAt: null };
}

/**
 * Whether a request is let through to the dependency. OPEN short-circuits (the
 * whole point of the breaker); CLOSED and HALF_OPEN allow the call.
 */
export function allowsRequest(s: BreakerState): boolean {
  return s.status !== 'OPEN';
}

/**
 * Applies the outcome of an *allowed* request. Must not be called while OPEN
 * (those requests are short-circuited, not executed).
 */
export function recordResult(
  s: BreakerState,
  ok: boolean,
  now: number,
  cfg: BreakerConfig = DEFAULT_BREAKER_CONFIG,
): BreakerState {
  if (s.status === 'CLOSED') {
    if (ok) return { ...s, failures: 0 };
    const failures = s.failures + 1;
    if (failures >= cfg.failureThreshold) {
      return { status: 'OPEN', failures: 0, trialSuccesses: 0, openedAt: now };
    }
    return { ...s, failures };
  }

  if (s.status === 'HALF_OPEN') {
    if (!ok) return { status: 'OPEN', failures: 0, trialSuccesses: 0, openedAt: now };
    const trialSuccesses = s.trialSuccesses + 1;
    if (trialSuccesses >= cfg.halfOpenTrials) return initialBreaker();
    return { ...s, trialSuccesses };
  }

  // OPEN: requests are short-circuited and should not reach here; ignore.
  return s;
}

/**
 * Advances time. The only time-driven transition is OPEN → HALF_OPEN once the
 * cooldown has elapsed.
 */
export function recordTick(
  s: BreakerState,
  now: number,
  cfg: BreakerConfig = DEFAULT_BREAKER_CONFIG,
): BreakerState {
  if (s.status === 'OPEN' && s.openedAt !== null && now - s.openedAt >= cfg.cooldownMs) {
    return { status: 'HALF_OPEN', failures: 0, trialSuccesses: 0, openedAt: null };
  }
  return s;
}
