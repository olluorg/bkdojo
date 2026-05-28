import { describe, expect, test } from 'bun:test';
import { DOMAINS } from '../domain/models/common';
import {
  clearProgress,
  createDefaultProgress,
  loadProgress,
  PROGRESS_VERSION,
  saveProgress,
  type KeyValueStore,
} from './progressStorage';

function fakeStore(initial?: string): KeyValueStore {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set('bkdojo.progress', initial);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('progressStorage', () => {
  test('migrates an older save by backfilling a newly added domain skill', () => {
    const old = createDefaultProgress();
    // simulate a save made before the system-design course existed
    delete (old.skills as Record<string, unknown>)['system-design'];
    old.streakDays = 7;

    const loaded = loadProgress(fakeStore(JSON.stringify(old)));
    expect(loaded.skills['system-design']?.ability).toBeGreaterThan(0); // backfilled
    expect(loaded.streakDays).toBe(7); // existing progress preserved
  });

  test('default progress has all domains and current version', () => {
    const progress = createDefaultProgress();
    expect(progress.version).toBe(PROGRESS_VERSION);
    expect(progress.placementDone).toBe(false);
    for (const domain of DOMAINS) {
      expect(progress.skills[domain].ability).toBeGreaterThan(0);
    }
  });

  test('save then load round-trips', () => {
    const store = fakeStore();
    const progress = createDefaultProgress();
    progress.streakDays = 5;
    saveProgress(progress, store);

    const loaded = loadProgress(store);
    expect(loaded.streakDays).toBe(5);
  });

  test('missing data returns a fresh default', () => {
    const loaded = loadProgress(fakeStore());
    expect(loaded.streakDays).toBe(0);
    expect(loaded.placementDone).toBe(false);
  });

  test('corrupt JSON falls back to default', () => {
    const loaded = loadProgress(fakeStore('{not json'));
    expect(loaded.version).toBe(PROGRESS_VERSION);
  });

  test('outdated version falls back to default', () => {
    const stale = JSON.stringify({ ...createDefaultProgress(), version: 0 });
    const loaded = loadProgress(fakeStore(stale));
    expect(loaded.version).toBe(PROGRESS_VERSION);
  });

  test('clear removes stored progress', () => {
    const store = fakeStore();
    saveProgress(createDefaultProgress(), store);
    clearProgress(store);
    expect(loadProgress(store).streakDays).toBe(0);
  });
});
