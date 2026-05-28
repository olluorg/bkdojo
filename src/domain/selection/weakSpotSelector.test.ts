import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { isOpenQuestion, type OpenQuestion } from '../models/question';
import type { AnswerRecord } from '../models/progress';
import { buildWeakSpotSession } from './weakSpotSelector';

const index = buildContentIndex(loadContent().questions);
const now = new Date('2026-05-22T00:00:00.000Z');
const rng = () => 0;

const firstOpen = index.all.find((q): q is OpenQuestion => isOpenQuestion(q) && q.rubric.length > 0);
if (!firstOpen) throw new Error('fixture: expected at least one open question with a rubric');

describe('buildWeakSpotSession', () => {
  test('is trainable even when nothing is due (fills from weakest domains)', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    const session = buildWeakSpotSession(index, progress, { now, size: 6, rng });

    expect(session.items.length).toBe(6);
    expect(new Set(session.items.map((i) => i.question.id)).size).toBe(session.items.length);
  });

  test('targets questions covering the concepts the user keeps missing', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    const conceptId = firstOpen.rubric[0]!.id;

    const miss: AnswerRecord = {
      questionId: firstOpen.id,
      domain: firstOpen.domain,
      tags: firstOpen.tags,
      score: 0,
      verdict: 'incorrect',
      conceptCoverage: [{ conceptId, coverage: 'missing' }],
      evaluatedBy: 'manual',
      answeredAt: '2026-05-20T00:00:00.000Z',
      // no nextReviewAt → not "due", so the weak-concept layer must carry it
    };
    progress.history = [miss];

    const session = buildWeakSpotSession(index, progress, { now, size: 10, rng });
    const coversWeakConcept = session.items.some(
      (i) => isOpenQuestion(i.question) && i.question.rubric.some((c) => c.id === conceptId),
    );
    expect(coversWeakConcept).toBe(true);
  });

  test('puts due reviews first', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    const due = index.all[0]!;
    progress.history = [
      {
        questionId: due.id,
        domain: due.domain,
        tags: [],
        score: 0,
        verdict: 'incorrect',
        evaluatedBy: 'local-choice',
        answeredAt: '2026-05-10T00:00:00.000Z',
        nextReviewAt: '2026-05-15T00:00:00.000Z', // due before `now`
      },
    ];

    const session = buildWeakSpotSession(index, progress, { now, size: 6, rng });
    expect(session.items[0]?.question.id).toBe(due.id);
  });
});
