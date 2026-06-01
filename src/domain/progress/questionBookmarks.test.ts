import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import {
  bookmarkedQuestionIds,
  isQuestionBookmarked,
  setQuestionBookmark,
} from './questionBookmarks';

const now = new Date('2026-05-22T12:00:00.000Z');

describe('questionBookmarks', () => {
  test('a question starts un-bookmarked', () => {
    expect(isQuestionBookmarked(createDefaultProgress(), 'q1')).toBe(false);
  });

  test('bookmarking records the question, without mutating the input', () => {
    const before = createDefaultProgress();
    const after = setQuestionBookmark(before, 'q1', true, now);

    expect(isQuestionBookmarked(after, 'q1')).toBe(true);
    expect(isQuestionBookmarked(before, 'q1')).toBe(false); // pure
  });

  test('removing a bookmark drops the entry and is a no-op when absent', () => {
    const marked = setQuestionBookmark(createDefaultProgress(), 'q1', true, now);
    const cleared = setQuestionBookmark(marked, 'q1', false, now);
    expect(isQuestionBookmarked(cleared, 'q1')).toBe(false);
    expect(cleared.questionBookmarks).toEqual({});

    const fresh = createDefaultProgress();
    expect(setQuestionBookmark(fresh, 'q1', false, now)).toBe(fresh); // same reference
  });

  test('bookmarkedQuestionIds lists most recently bookmarked first', () => {
    let p = createDefaultProgress();
    p = setQuestionBookmark(p, 'a', true, new Date('2026-05-20T10:00:00.000Z'));
    p = setQuestionBookmark(p, 'b', true, new Date('2026-05-22T10:00:00.000Z'));
    p = setQuestionBookmark(p, 'c', true, new Date('2026-05-21T10:00:00.000Z'));
    expect(bookmarkedQuestionIds(p)).toEqual(['b', 'c', 'a']);
  });
});
