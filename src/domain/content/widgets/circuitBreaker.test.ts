import { describe, expect, it } from 'bun:test';
import {
  allowsRequest,
  DEFAULT_BREAKER_CONFIG as CFG,
  initialBreaker,
  recordResult,
  recordTick,
  type BreakerState,
} from './circuitBreaker';

describe('circuit breaker', () => {
  it('starts CLOSED and allows requests', () => {
    const s = initialBreaker();
    expect(s.status).toBe('CLOSED');
    expect(allowsRequest(s)).toBe(true);
  });

  it('trips to OPEN after consecutive failures reach the threshold', () => {
    let s = initialBreaker();
    for (let i = 0; i < CFG.failureThreshold; i++) s = recordResult(s, false, 1000, CFG);
    expect(s.status).toBe('OPEN');
    expect(allowsRequest(s)).toBe(false);
    expect(s.openedAt).toBe(1000);
  });

  it('resets the failure count on any success while CLOSED', () => {
    let s = initialBreaker();
    s = recordResult(s, false, 0, CFG);
    s = recordResult(s, false, 0, CFG);
    s = recordResult(s, true, 0, CFG);
    expect(s.failures).toBe(0);
    s = recordResult(s, false, 0, CFG);
    expect(s.status).toBe('CLOSED'); // not enough consecutive failures to trip
  });

  it('moves OPEN → HALF_OPEN only after the cooldown elapses', () => {
    let s = initialBreaker();
    for (let i = 0; i < CFG.failureThreshold; i++) s = recordResult(s, false, 0, CFG);
    expect(s.status).toBe('OPEN');
    s = recordTick(s, CFG.cooldownMs - 1, CFG);
    expect(s.status).toBe('OPEN');
    s = recordTick(s, CFG.cooldownMs, CFG);
    expect(s.status).toBe('HALF_OPEN');
    expect(allowsRequest(s)).toBe(true);
  });

  it('closes from HALF_OPEN after enough trial successes', () => {
    let s: BreakerState = { status: 'HALF_OPEN', failures: 0, trialSuccesses: 0, openedAt: null };
    for (let i = 0; i < CFG.halfOpenTrials; i++) s = recordResult(s, true, 0, CFG);
    expect(s.status).toBe('CLOSED');
  });

  it('re-opens from HALF_OPEN on the first failed trial', () => {
    let s: BreakerState = { status: 'HALF_OPEN', failures: 0, trialSuccesses: 1, openedAt: null };
    s = recordResult(s, false, 5000, CFG);
    expect(s.status).toBe('OPEN');
    expect(s.openedAt).toBe(5000);
  });
});
