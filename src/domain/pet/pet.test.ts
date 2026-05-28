import { describe, expect, test } from 'bun:test';
import {
  canPlay,
  createDefaultPet,
  decayPet,
  feedPet,
  growthProgress,
  petStageFromXp,
  playPet,
} from './pet';

const t0 = new Date('2026-05-22T00:00:00.000Z');
const t2 = new Date('2026-05-22T02:00:00.000Z');
const tFar = new Date('2026-05-25T00:00:00.000Z');

describe('petStageFromXp', () => {
  test('maps xp to growth stage', () => {
    expect(petStageFromXp(0)).toBe('egg');
    expect(petStageFromXp(29)).toBe('egg');
    expect(petStageFromXp(30)).toBe('baby');
    expect(petStageFromXp(150)).toBe('teen');
    expect(petStageFromXp(500)).toBe('adult');
  });
});

describe('decayPet', () => {
  test('satiety drops and energy recovers over time', () => {
    const decayed = decayPet(createDefaultPet(t0), t2);
    expect(decayed.satiety).toBeCloseTo(50); // 60 - 5*2
    expect(decayed.energy).toBe(100); // 80 + 12*2, capped
    expect(decayed.updatedAt).toBe(t2.toISOString());
  });

  test('clamps to [0,100] over long neglect', () => {
    const decayed = decayPet(createDefaultPet(t0), tFar);
    expect(decayed.satiety).toBe(0);
    expect(decayed.energy).toBe(100);
  });
});

describe('feedPet', () => {
  test('a correct answer fills satiety, costs energy, and adds xp', () => {
    const fed = feedPet(createDefaultPet(t0), { domain: 'java-core', verdict: 'correct', difficulty: 3 }, t0);
    expect(fed.satiety).toBe(70); // 60 + 10
    expect(fed.energy).toBe(76); // 80 - 4
    expect(fed.xp).toBe(14); // 8 + 3*2
    expect(fed.recentFoods).toEqual(['java-core']);
  });

  test('variety: a new course cheers more than repeating the same one', () => {
    const base = feedPet(createDefaultPet(t0), { domain: 'java-core', verdict: 'correct', difficulty: 1 }, t0);
    const same = feedPet(base, { domain: 'java-core', verdict: 'correct', difficulty: 1 }, t0);
    const fresh = feedPet(base, { domain: 'spring-boot', verdict: 'correct', difficulty: 1 }, t0);
    expect(fresh.happiness).toBeGreaterThan(same.happiness);
  });

  test('overload (low energy) dampens gains', () => {
    const tired = { ...createDefaultPet(t0), energy: 10 };
    const fed = feedPet(tired, { domain: 'java-core', verdict: 'correct', difficulty: 3 }, t0);
    expect(fed.xp).toBe(7); // 14 * 0.5
    expect(fed.satiety).toBe(65); // 60 + 10*0.5
  });
});

describe('playPet / canPlay', () => {
  test('playing cheers the pet and starts a cooldown', () => {
    const played = playPet(createDefaultPet(t0), t0);
    expect(played.happiness).toBe(82);
    expect(played.energy).toBe(88);
    expect(canPlay(played, t0)).toBe(false);
    expect(canPlay(createDefaultPet(t0), t0)).toBe(true);
  });
});

describe('growthProgress', () => {
  test('measures xp toward the next stage', () => {
    expect(growthProgress({ ...createDefaultPet(t0), xp: 0, stage: 'egg' }).value).toBe(0);
    expect(growthProgress({ ...createDefaultPet(t0), xp: 90, stage: 'baby' }).value).toBeCloseTo(0.5);
    expect(growthProgress({ ...createDefaultPet(t0), xp: 1000, stage: 'adult' }).atMax).toBe(true);
  });
});
