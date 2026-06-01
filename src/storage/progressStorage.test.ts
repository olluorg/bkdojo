import { describe, expect, test } from 'bun:test';
import { DOMAINS } from '../domain/models/common';
import type { AnswerRecord } from '../domain/models/progress';
import {
  clearProgress,
  createDefaultProgress,
  loadProgress,
  mergeProgress,
  PROGRESS_VERSION,
  saveProgress,
  type KeyValueStore,
} from './progressStorage';

function record(questionId: string, answeredAt: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'manual',
    answeredAt,
  };
}

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

describe('mergeProgress', () => {
  test('unions answer history and dedupes shared records', () => {
    const base = createDefaultProgress();
    base.history = [record('q1', '2026-05-01T10:00:00Z'), record('q2', '2026-05-02T10:00:00Z')];
    const incoming = createDefaultProgress();
    incoming.history = [
      record('q2', '2026-05-02T10:00:00Z'), // duplicate of base
      record('q3', '2026-05-03T10:00:00Z'),
    ];

    const merged = mergeProgress(base, incoming);
    expect(merged.history.map((r) => r.questionId)).toEqual(['q1', 'q2', 'q3']);
  });

  test('keeps existing local progress (nothing is wiped) and takes the stronger aggregates', () => {
    const base = createDefaultProgress();
    base.history = [record('q1', '2026-05-01T10:00:00Z')];
    base.streakDays = 3;
    const incoming = createDefaultProgress();
    incoming.streakDays = 10;

    const merged = mergeProgress(base, incoming);
    expect(merged.history).toHaveLength(1); // local record survives
    expect(merged.streakDays).toBe(10); // longer streak wins
  });

  test('unions read lessons and bookmarks, keeping the earliest timestamp', () => {
    const base = createDefaultProgress();
    base.lessonsRead = { 'lesson-a': '2026-05-10T00:00:00Z' };
    const incoming = createDefaultProgress();
    incoming.lessonsRead = {
      'lesson-a': '2026-05-01T00:00:00Z', // earlier read of the same lesson
      'lesson-b': '2026-05-05T00:00:00Z',
    };

    const merged = mergeProgress(base, incoming);
    expect(merged.lessonsRead).toEqual({
      'lesson-a': '2026-05-01T00:00:00Z',
      'lesson-b': '2026-05-05T00:00:00Z',
    });
  });

  test('unions event logs and dedupes by id', () => {
    const base = createDefaultProgress();
    base.events = [
      { id: 'e1', type: 'lesson_completed', at: '2026-05-01T10:00:00Z', refId: 'l1' },
      { id: 'e2', type: 'session_completed', at: '2026-05-02T10:00:00Z', refId: 'practice' },
    ];
    const incoming = createDefaultProgress();
    incoming.events = [
      { id: 'e2', type: 'session_completed', at: '2026-05-02T10:00:00Z', refId: 'practice' }, // dup
      { id: 'e3', type: 'term_drilled', at: '2026-05-03T10:00:00Z', refId: 't1', correct: true },
    ];

    const merged = mergeProgress(base, incoming);
    expect(merged.events?.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  test('per-domain skill from the device with more answers wins', () => {
    const base = createDefaultProgress();
    base.skills['java-core'] = { domain: 'java-core', ability: 2, answered: 3, correct: 1 };
    const incoming = createDefaultProgress();
    incoming.skills['java-core'] = { domain: 'java-core', ability: 4, answered: 20, correct: 18 };

    const merged = mergeProgress(base, incoming);
    expect(merged.skills['java-core'].answered).toBe(20);
    expect(merged.skills['java-core'].ability).toBe(4);
  });
});
