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

  test('completePlacement is idempotent and logs one event', () => {
    const once = progressReducer(createDefaultProgress(), { type: 'completePlacement' });
    expect(once.placementDone).toBe(true);
    expect(once.events?.filter((e) => e.type === 'placement_completed')).toHaveLength(1);
    expect(progressReducer(once, { type: 'completePlacement' })).toBe(once); // same reference, no extra event
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

  test('learning actions append events, toggling read off does not', () => {
    let p = createDefaultProgress();
    p = progressReducer(p, { type: 'setLessonRead', lessonId: 'java-core-oop', read: true });
    p = progressReducer(p, { type: 'recordTerm', termId: 'closures', correct: true });
    p = progressReducer(p, { type: 'recordActivity', kind: 'practice' });
    p = progressReducer(p, { type: 'setLessonRead', lessonId: 'java-core-oop', read: false });

    const types = (p.events ?? []).map((e) => e.type).sort();
    expect(types).toEqual(['lesson_completed', 'session_completed', 'term_drilled']);
    const term = p.events!.find((e) => e.type === 'term_drilled');
    expect(term).toMatchObject({ refId: 'closures', correct: true });
  });

  test('logEvent appends an arbitrary event (session_started)', () => {
    const next = progressReducer(createDefaultProgress(), {
      type: 'logEvent',
      event: { type: 'session_started', refId: 'practice' },
    });
    expect(next.events).toHaveLength(1);
    expect(next.events![0]).toMatchObject({ type: 'session_started', refId: 'practice' });
  });

  test('reset returns a fresh default', () => {
    const dirty = progressReducer(createDefaultProgress(), { type: 'record', outcome: outcome() });
    expect(progressReducer(dirty, { type: 'reset' }).history).toHaveLength(0);
  });
});
