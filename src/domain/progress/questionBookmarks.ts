import type { UserProgress } from '../models/progress';

/**
 * Question bookmarks — individual questions the learner has saved to revisit
 * and drill again later (e.g. a tricky one they want to nail before an
 * interview). Independent of answer history: a learner can bookmark a question
 * they've already answered correctly. We store the timestamp so the list can be
 * ordered most-recent-first. All folds are pure (no mutation).
 */

export function isQuestionBookmarked(progress: UserProgress, questionId: string): boolean {
  return Boolean(progress.questionBookmarks?.[questionId]);
}

/** Bookmarked question ids, most recently bookmarked first. */
export function bookmarkedQuestionIds(progress: UserProgress): string[] {
  const marks = progress.questionBookmarks ?? {};
  return Object.keys(marks).sort((a, b) => (marks[b] ?? '').localeCompare(marks[a] ?? ''));
}

/** Bookmarks a question (records `now`) or removes the bookmark (drops the entry to stay tidy). */
export function setQuestionBookmark(
  progress: UserProgress,
  questionId: string,
  bookmarked: boolean,
  now: Date = new Date(),
): UserProgress {
  const current = progress.questionBookmarks ?? {};
  if (bookmarked) {
    return { ...progress, questionBookmarks: { ...current, [questionId]: now.toISOString() } };
  }
  if (!(questionId in current)) return progress;
  const next = { ...current };
  delete next[questionId];
  return { ...progress, questionBookmarks: next };
}
