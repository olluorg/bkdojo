import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_BATCHES,
  EDEN_CAPACITY,
  simulateGenerations,
  SURVIVOR_CAPACITY,
  TENURING_THRESHOLD,
  type GcStep,
} from './gcGenerationsSim';

const steps = simulateGenerations();
const minors = steps.filter((s) => s.action === 'minor');

function live(step: GcStep): number {
  return step.eden.length + step.survivor.length + step.old.length;
}

describe('simulateGenerations', () => {
  it('starts empty and emits an alloc + minor pair per batch', () => {
    expect(steps[0]?.action).toBe('init');
    expect(live(steps[0]!)).toBe(0);
    expect(steps.filter((s) => s.action === 'alloc').length).toBe(DEFAULT_BATCHES.length);
    expect(minors.length).toBe(DEFAULT_BATCHES.length);
  });

  it('never exceeds the Eden or Survivor capacities', () => {
    for (const step of steps) {
      expect(step.eden.length).toBeLessThanOrEqual(EDEN_CAPACITY);
      expect(step.survivor.length).toBeLessThanOrEqual(SURVIVOR_CAPACITY);
    }
  });

  it('empties Eden on every collection', () => {
    for (const step of minors) expect(step.eden).toEqual([]);
  });

  it('conserves objects: live + collected accounts for everything allocated', () => {
    let allocated = 0;
    let collected = 0;
    for (const step of steps) {
      if (step.action === 'alloc') allocated += step.eden.length;
      collected += step.collected;
      if (step.action === 'minor') expect(live(step) + collected).toBe(allocated);
    }
  });

  it('never resurrects an object: the old generation only grows', () => {
    let previous = 0;
    for (const step of steps) {
      expect(step.old.length).toBeGreaterThanOrEqual(previous);
      previous = step.old.length;
    }
  });

  it('promotes objects that reach the tenuring threshold', () => {
    const tenured = minors.some((s) => s.promoted.length > 0 && !s.premature);
    expect(tenured).toBe(true);
    // Nothing sits in a survivor space at or past the threshold — it must be promoted.
    for (const step of steps) {
      for (const o of step.survivor) expect(o.age).toBeLessThan(TENURING_THRESHOLD);
    }
  });

  it('promotes prematurely when the survivor space overflows', () => {
    const overflow = minors.find((s) => s.premature);
    expect(overflow).toBeDefined();
    expect(overflow!.survivor.length).toBe(SURVIVOR_CAPACITY);
    expect(overflow!.note).toContain('преждевременное продвижение');
  });

  it('ages every surviving object by exactly one per collection', () => {
    // b7 survives 2 collections, so after the second minor GC its age must be 2.
    const afterSecond = minors[1]!;
    const b7 = [...afterSecond.survivor, ...afterSecond.old].find((o) => o.id === 'b7');
    expect(b7?.age).toBe(1);
    const afterThird = minors[2]!;
    const b7Later = [...afterThird.survivor, ...afterThird.old].find((o) => o.id === 'b7');
    expect(b7Later?.age).toBe(2);
  });

  it('collects the short-lived majority on the first pass', () => {
    // Five of the eight objects in the first batch die immediately — the whole
    // point of the generational hypothesis.
    expect(minors[0]?.collected).toBe(5);
  });
});
