import { describe, expect, it } from 'bun:test';
import { chooseLock, type Need } from './lockChooser';

describe('chooseLock', () => {
  it('defaults to synchronized when nothing extra is needed', () => {
    const r = chooseLock([]);
    expect(r.choice).toBe('synchronized');
    expect(r.caveats).toHaveLength(0);
  });

  it('escalates to ReentrantLock for any synchronized-beating extra', () => {
    for (const need of ['tryTimeout', 'interruptible', 'fair', 'conditions'] as Need[]) {
      const r = chooseLock([need]);
      expect(r.choice).toBe('ReentrantLock');
      expect(r.caveats.join(' ')).toContain('finally');
    }
  });

  it('names the selected features in the ReentrantLock reason', () => {
    const r = chooseLock(['tryTimeout', 'fair']);
    expect(r.choice).toBe('ReentrantLock');
    expect(r.reason).toContain('tryLock/таймаут');
    expect(r.reason).toContain('честность');
  });

  it('chooses ReentrantReadWriteLock for read-heavy sharing', () => {
    const r = chooseLock(['concurrentReads']);
    expect(r.choice).toBe('ReentrantReadWriteLock');
    expect(r.caveats.join(' ')).toContain('частой записи');
  });

  it('warns Condition lives on writeLock for RW locks', () => {
    const r = chooseLock(['concurrentReads', 'conditions']);
    expect(r.choice).toBe('ReentrantReadWriteLock');
    expect(r.caveats.join(' ')).toContain('writeLock');
  });

  it('prefers StampedLock for optimistic reads and flags non-reentrancy', () => {
    const r = chooseLock(['optimisticRead']);
    expect(r.choice).toBe('StampedLock');
    expect(r.caveats.join(' ')).toContain('реентерабелен');
  });

  it('warns when optimistic read is combined with Condition', () => {
    const r = chooseLock(['optimisticRead', 'conditions']);
    expect(r.choice).toBe('StampedLock');
    expect(r.caveats.join(' ')).toContain('Condition');
  });

  it('lets optimistic read win over plain read-heavy', () => {
    expect(chooseLock(['optimisticRead', 'concurrentReads']).choice).toBe('StampedLock');
  });
});
