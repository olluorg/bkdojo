import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { buildReviewSession } from './reviewSelector';

const index = buildContentIndex(loadContent().questions);

function record(questionId: string, nextReviewAt: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 0,
    verdict: 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-01T00:00:00.000Z',
    nextReviewAt,
  };
}

describe('buildReviewSession', () => {
  const now = new Date('2026-05-21T00:00:00.000Z');

  test('includes only due items, most overdue first', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('jc-002', '2026-05-10T00:00:00.000Z'), // due (older)
      record('jc-001', '2026-05-20T00:00:00.000Z'), // due (newer)
      record('jc-003', '2026-06-01T00:00:00.000Z'), // not due yet
    ];

    const session = buildReviewSession(index, progress, { now });
    const ids = session.items.map((i) => i.question.id);
    expect(ids).toEqual(['jc-002', 'jc-001']);
  });

  test('uses the latest record per question', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('jc-001', '2026-05-10T00:00:00.000Z'), // would be due
      record('jc-001', '2026-06-01T00:00:00.000Z'), // latest: not due
    ];
    expect(buildReviewSession(index, progress, { now }).items).toHaveLength(0);
  });
});
