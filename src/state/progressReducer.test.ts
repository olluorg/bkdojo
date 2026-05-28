import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../storage/progressStorage';
import type { AnswerOutcome } from '../domain/models/answer';
import { progressReducer } from './progressReducer';

function outcome(): AnswerOutcome {
  return {
    questionId: 'jc-001',
    domain: 'java-core',
    difficulty: 3,
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-21T08:00:00.000Z',
  };
}

describe('progressReducer', () => {
  test('record folds an outcome into progress', () => {
    const next = progressReducer(createDefaultProgress(), { type: 'record', outcome: outcome() });
    expect(next.history).toHaveLength(1);
  });

  test('completePlacement is idempotent', () => {
    const once = progressReducer(createDefaultProgress(), { type: 'completePlacement' });
    expect(once.placementDone).toBe(true);
    expect(progressReducer(once, { type: 'completePlacement' })).toBe(once); // same reference
  });

  test('setAiAvailability stores and de-dupes', () => {
    const set = progressReducer(createDefaultProgress(), {
      type: 'setAiAvailability',
      availability: 'unavailable',
    });
    expect(set.lastAiAvailability).toBe('unavailable');
    expect(progressReducer(set, { type: 'setAiAvailability', availability: 'unavailable' })).toBe(set);
  });

  test('setEvalMethod stores the chosen evaluation method', () => {
    const next = progressReducer(createDefaultProgress(), { type: 'setEvalMethod', method: 'server' });
    expect(next.settings?.evalMethod).toBe('server');
  });

  test('setLessonRead records and clears a lesson', () => {
    const read = progressReducer(createDefaultProgress(), {
      type: 'setLessonRead',
      lessonId: 'java-core-oop',
      read: true,
    });
    expect(read.lessonsRead?.['java-core-oop']).toBeTruthy();

    const cleared = progressReducer(read, {
      type: 'setLessonRead',
      lessonId: 'java-core-oop',
      read: false,
    });
    expect(cleared.lessonsRead?.['java-core-oop']).toBeUndefined();
  });

  test('recordActivity stamps the given kind', () => {
    const next = progressReducer(createDefaultProgress(), {
      type: 'recordActivity',
      kind: 'review',
    });
    expect(next.activity?.review).toBeTruthy();
    expect(next.activity?.practice).toBeUndefined();
  });

  test('reset returns a fresh default', () => {
    const dirty = progressReducer(createDefaultProgress(), { type: 'record', outcome: outcome() });
    expect(progressReducer(dirty, { type: 'reset' }).history).toHaveLength(0);
  });
});
