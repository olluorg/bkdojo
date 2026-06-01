import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { appendEvent, recentEvents } from './eventLog';

describe('eventLog', () => {
  test('appendEvent stamps id and at, and does not mutate input', () => {
    const base = createDefaultProgress();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const next = appendEvent(base, { type: 'lesson_completed', refId: 'lesson-a' }, now);

    expect(base.events).toEqual([]); // immutable
    expect(next.events).toHaveLength(1);
    const ev = next.events![0]!;
    expect(ev.at).toBe('2026-05-01T10:00:00.000Z');
    expect(ev.id).toBe('2026-05-01T10:00:00.000Z#lesson_completed#lesson-a');
    expect(ev.type).toBe('lesson_completed');
  });

  test('appends in order and recentEvents returns newest-first', () => {
    let p = createDefaultProgress();
    p = appendEvent(p, { type: 'lesson_started', refId: 'a' }, new Date('2026-05-01T09:00:00Z'));
    p = appendEvent(p, { type: 'lesson_completed', refId: 'a' }, new Date('2026-05-01T09:30:00Z'));
    p = appendEvent(p, { type: 'session_completed', refId: 'practice' }, new Date('2026-05-02T08:00:00Z'));

    expect(recentEvents(p).map((e) => e.type)).toEqual([
      'session_completed',
      'lesson_completed',
      'lesson_started',
    ]);
    expect(recentEvents(p, 1).map((e) => e.type)).toEqual(['session_completed']);
  });
});
