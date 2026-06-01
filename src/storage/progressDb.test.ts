import { describe, expect, test } from 'bun:test';
import { DOMAINS } from '../domain/models/common';
import type { AnswerRecord, UserProgress } from '../domain/models/progress';
import { createDefaultProgress, normalizeProgress } from './progressStorage';
import { decompose, recompose } from './progressDb';

function answer(questionId: string, answeredAt: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: ['gc'],
    score: 0.8,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt,
  };
}

function sampleProgress(): UserProgress {
  const p = createDefaultProgress();
  p.placementDone = true;
  p.streakDays = 4;
  p.skills['java-core'] = { domain: 'java-core', ability: 4.2, answered: 10, correct: 7 };
  p.history = [
    answer('q1', '2026-05-01T10:00:00.000Z'),
    answer('q2', '2026-05-02T11:30:00.000Z'),
  ];
  p.terms = { closures: { termId: 'closures', streak: 2, seen: 5, correct: 4 } };
  p.lessonsRead = { 'lesson-a': '2026-05-01T09:00:00.000Z' };
  p.lessonComments = {
    'lesson-a': {
      fingerprint: 'fp',
      text: 'nice',
      source: 'server',
      generatedAt: '2026-05-01T09:05:00.000Z',
    },
  };
  p.activity = { practice: '2026-05-02T11:30:00.000Z' };
  p.events = [
    {
      id: '2026-05-01T09:00:00.000Z#lesson_completed#lesson-a',
      type: 'lesson_completed',
      at: '2026-05-01T09:00:00.000Z',
      refId: 'lesson-a',
    },
    {
      id: '2026-05-02T11:30:00.000Z#session_completed#practice',
      type: 'session_completed',
      at: '2026-05-02T11:30:00.000Z',
      refId: 'practice',
    },
  ];
  return p;
}

describe('decompose / recompose', () => {
  test('round-trips a populated progress object', () => {
    const p = sampleProgress();
    const restored = recompose(decompose(p));
    // recompose runs the same normalization a localStorage load would.
    expect(restored).toEqual(normalizeProgress(p));
  });

  test('preserves history order regardless of stored record order', () => {
    const p = sampleProgress();
    const records = decompose(p);
    records.history = [...records.history].reverse();
    const restored = recompose(records);
    expect(restored.history.map((h) => h.questionId)).toEqual(['q1', 'q2']);
  });

  test('history records carry a stable per-attempt id', () => {
    const p = sampleProgress();
    const ids = (decompose(p).history as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual([
      '2026-05-01T10:00:00.000Z#q1',
      '2026-05-02T11:30:00.000Z#q2',
    ]);
  });

  test('preserves events order regardless of stored record order', () => {
    const p = sampleProgress();
    const records = decompose(p);
    records.events = [...records.events].reverse();
    const restored = recompose(records);
    expect(restored.events?.map((e) => e.type)).toEqual(['lesson_completed', 'session_completed']);
  });

  test('singletons round-trip scalar fields', () => {
    const p = sampleProgress();
    const restored = recompose(decompose(p));
    expect(restored.placementDone).toBe(true);
    expect(restored.streakDays).toBe(4);
  });

  test('an empty decomposition recomposes to a fresh-default shape', () => {
    const restored = recompose({
      skills: [],
      history: [],
      terms: [],
      lessonsRead: [],
      lessonComments: [],
      activity: [],
      events: [],
      singletons: [],
    });
    // Don't deep-compare to createDefaultProgress(): the default pet carries a
    // `new Date()` timestamp, so two independent defaults differ by ~1ms.
    expect(restored.version).toBe(createDefaultProgress().version);
    expect(restored.placementDone).toBe(false);
    expect(restored.history).toEqual([]);
    expect(Object.keys(restored.skills).sort()).toEqual([...DOMAINS].sort());
    expect(restored.pet?.stage).toBe('egg');
  });
});
