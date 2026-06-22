import { describe, expect, it } from 'bun:test';
import { evalImmutability, GUARDS, type Guard } from './immutabilityRecipe';

const ALL: Guard[] = GUARDS.map((g) => g.id);

describe('evalImmutability', () => {
  it('is immutable only when every guard is applied', () => {
    const r = evalImmutability(ALL);
    expect(r.immutable).toBe(true);
    expect(r.holes).toHaveLength(0);
  });

  it('reports a hole for every missing guard', () => {
    const r = evalImmutability([]);
    expect(r.immutable).toBe(false);
    expect(r.holes.map((h) => h.guard).sort()).toEqual([...ALL].sort());
  });

  it('opens exactly the attack for a single forgotten step', () => {
    const r = evalImmutability(ALL.filter((g) => g !== 'copyOut'));
    expect(r.immutable).toBe(false);
    expect(r.holes).toHaveLength(1);
    expect(r.holes[0]?.guard).toBe('copyOut');
    expect(r.holes[0]?.attack).toContain('events()');
  });

  it('keeps holes in recipe order regardless of input order', () => {
    const r = evalImmutability(['copyOut', 'finalFields'] as Guard[]);
    const expectedOrder = GUARDS.filter((g) => g.id !== 'copyOut' && g.id !== 'finalFields').map(
      (g) => g.id,
    );
    expect(r.holes.map((h) => h.guard)).toEqual(expectedOrder);
  });

  it('covers all three locks in the recipe', () => {
    expect(new Set(GUARDS.map((g) => g.lock))).toEqual(new Set(['assign', 'access', 'reference']));
  });
});
