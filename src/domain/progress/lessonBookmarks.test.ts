import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import {
  bookmarkedLessonIds,
  isLessonBookmarked,
  setLessonBookmark,
} from './lessonBookmarks';

const now = new Date('2026-05-22T12:00:00.000Z');

describe('lessonBookmarks', () => {
  test('a lesson starts un-bookmarked', () => {
    expect(isLessonBookmarked(createDefaultProgress(), 'java-core-oop')).toBe(false);
  });

  test('bookmarking records the lesson, without mutating the input', () => {
    const before = createDefaultProgress();
    const after = setLessonBookmark(before, 'java-core-oop', true, now);

    expect(isLessonBookmarked(after, 'java-core-oop')).toBe(true);
    expect(isLessonBookmarked(before, 'java-core-oop')).toBe(false); // pure
  });

  test('removing a bookmark drops the entry and is a no-op when absent', () => {
    const marked = setLessonBookmark(createDefaultProgress(), 'java-core-oop', true, now);
    const cleared = setLessonBookmark(marked, 'java-core-oop', false, now);
    expect(isLessonBookmarked(cleared, 'java-core-oop')).toBe(false);
    expect(cleared.lessonBookmarks).toEqual({});

    const fresh = createDefaultProgress();
    expect(setLessonBookmark(fresh, 'java-core-oop', false, now)).toBe(fresh); // same reference
  });

  test('bookmarkedLessonIds lists most recently bookmarked first', () => {
    let p = createDefaultProgress();
    p = setLessonBookmark(p, 'a', true, new Date('2026-05-20T10:00:00.000Z'));
    p = setLessonBookmark(p, 'b', true, new Date('2026-05-22T10:00:00.000Z'));
    p = setLessonBookmark(p, 'c', true, new Date('2026-05-21T10:00:00.000Z'));
    expect(bookmarkedLessonIds(p)).toEqual(['b', 'c', 'a']);
  });
});
