import { describe, expect, test } from 'bun:test';
import { breathAt, DEFAULT_BREATH, inSync, totalDuration } from './kiBreathing';

const cfg = { inhaleMs: 4000, exhaleMs: 4000, cycles: 2 };

describe('breathAt', () => {
  test('inhale grows the ring from 0 to 1', () => {
    expect(breathAt(0, cfg)).toMatchObject({ phase: 'inhale', cycle: 0 });
    expect(breathAt(0, cfg).scale).toBe(0);
    expect(breathAt(2000, cfg).scale).toBeCloseTo(0.5);
  });

  test('exhale shrinks the ring from 1 to 0', () => {
    expect(breathAt(4000, cfg).phase).toBe('exhale');
    expect(breathAt(4000, cfg).scale).toBeCloseTo(1);
    expect(breathAt(6000, cfg).scale).toBeCloseTo(0.5);
  });

  test('advances cycles and finishes at the end', () => {
    expect(breathAt(8000, cfg).cycle).toBe(1);
    expect(breathAt(totalDuration(cfg), cfg).phase).toBe('done');
  });

  test('default config is 4 cycles', () => {
    expect(totalDuration(DEFAULT_BREATH)).toBe((4000 + 4000) * 4);
  });
});

describe('inSync', () => {
  test('hold on inhale, release on exhale', () => {
    expect(inSync('inhale', true)).toBe(true);
    expect(inSync('inhale', false)).toBe(false);
    expect(inSync('exhale', false)).toBe(true);
    expect(inSync('exhale', true)).toBe(false);
    expect(inSync('done', true)).toBe(false);
  });
});
