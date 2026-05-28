import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { countLessonsRead, isLessonRead, lessonReadAt, setLessonRead } from './lessonProgress';

const now = new Date('2026-05-22T12:00:00.000Z');

describe('lessonProgress', () => {
  test('a lesson starts unread', () => {
    expect(isLessonRead(createDefaultProgress(), 'java-core-oop')).toBe(false);
  });

  test('marking read records a timestamp, without mutating the input', () => {
    const before = createDefaultProgress();
    const after = setLessonRead(before, 'java-core-oop', true, now);

    expect(isLessonRead(after, 'java-core-oop')).toBe(true);
    expect(lessonReadAt(after, 'java-core-oop')).toBe(now.toISOString());
    expect(isLessonRead(before, 'java-core-oop')).toBe(false); // pure
  });

  test('unmarking drops the entry and is a no-op when already unread', () => {
    const read = setLessonRead(createDefaultProgress(), 'java-core-oop', true, now);
    const cleared = setLessonRead(read, 'java-core-oop', false, now);
    expect(isLessonRead(cleared, 'java-core-oop')).toBe(false);
    expect(cleared.lessonsRead).toEqual({});

    const fresh = createDefaultProgress();
    expect(setLessonRead(fresh, 'java-core-oop', false, now)).toBe(fresh); // same reference
  });

  test('countLessonsRead counts only ids that are read', () => {
    let p = createDefaultProgress();
    p = setLessonRead(p, 'a', true, now);
    p = setLessonRead(p, 'b', true, now);
    expect(countLessonsRead(p, ['a', 'b', 'c'])).toBe(2);
  });
});
