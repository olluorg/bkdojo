import { describe, expect, it } from 'bun:test';
import { deliver, initialDedup } from './idempotency';

describe('idempotency dedup', () => {
  it('applies the charge on first delivery', () => {
    const r = deliver(initialDedup(), 'k1', true);
    expect(r.applied).toBe(true);
    expect(r.outcome).toBe('applied');
    expect(r.state.charges).toBe(1);
    expect(r.state.processedKeys).toEqual(['k1']);
  });

  it('skips a duplicate delivery when the key was already processed', () => {
    const first = deliver(initialDedup(), 'k1', true);
    const second = deliver(first.state, 'k1', true);
    expect(second.applied).toBe(false);
    expect(second.outcome).toBe('duplicate-skipped');
    expect(second.state.charges).toBe(1); // still charged exactly once
  });

  it('double-charges when no idempotency key is used', () => {
    let s = initialDedup();
    s = deliver(s, 'k1', false).state;
    const second = deliver(s, 'k1', false);
    expect(second.applied).toBe(true);
    expect(second.outcome).toBe('applied-no-key');
    expect(second.state.charges).toBe(2);
    expect(second.state.processedKeys).toEqual([]); // nothing remembered
  });

  it('treats different keys as independent operations', () => {
    let s = initialDedup();
    s = deliver(s, 'k1', true).state;
    s = deliver(s, 'k2', true).state;
    expect(s.charges).toBe(2);
    expect(s.processedKeys).toEqual(['k1', 'k2']);
  });
});
