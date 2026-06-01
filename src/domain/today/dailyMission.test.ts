import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { loadAllLessons } from '../content/lessonLoader';
import { loadAllTerms } from '../content/glossaryLoader';
import { isOpenQuestion } from '../models/question';
import type { AnswerRecord } from '../models/progress';
import { recordActivity } from '../progress/activity';
import { setLessonRead } from '../progress/lessonProgress';
import { buildDailyMission } from './dailyMission';

const index = buildContentIndex(loadContent().questions);
const lessons = loadAllLessons();
const terms = loadAllTerms();
const now = new Date('2026-05-22T12:00:00.000Z');

function build(progress = createDefaultProgress()) {
  return buildDailyMission({ progress, index, lessons, terms, now });
}

describe('buildDailyMission', () => {
  test('before placement returns an onboarding mission pointing at diagnostics', () => {
    const mission = build();
    expect(mission.reason.kind).toBe('fresh-start');
    expect(mission.primaryPath).toBe('/level');
    expect(mission.steps[0]?.path).toBe('/level');
    expect(mission.reason.lines.length).toBeGreaterThan(0);
  });

  test('always exposes goal, readiness, a reason and a five-step plan', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    const mission = build(progress);

    expect(mission.goalLabel).toContain('Middle');
    expect(mission.readiness.overall).toBeGreaterThan(0);
    expect(mission.readiness.overall).toBeLessThanOrEqual(1);
    expect(mission.reason.lines.length).toBeGreaterThan(0);
    expect(mission.steps).toHaveLength(5);
    expect(mission.steps.map((s) => s.kind)).toEqual([
      'lesson',
      'practice',
      'review',
      'terms',
      'interview',
    ]);
  });

  test('picks the weakest domain (biggest gap) when there are no concept weak spots', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    progress.skills['message-brokers'].ability = 1.2; // clearly the lowest
    const mission = build(progress);

    expect(mission.focusDomain).toBe('message-brokers');
    expect(mission.reason.kind).toBe('gap');
  });

  test('prioritises a repeatedly-missed concept over the gap, with a weak-spot reason', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    progress.skills['message-brokers'].ability = 1.2; // would win on gap alone

    // Find an open question whose concept maps to a non-message-brokers lesson.
    const open = index.all.find(
      (q) => isOpenQuestion(q) && q.domain !== 'message-brokers' && q.rubric.length > 0,
    );
    if (!open || !isOpenQuestion(open)) throw new Error('fixture: no open question found');
    const conceptId = open.rubric[0]!.id;

    const missRecord: AnswerRecord = {
      questionId: open.id,
      domain: open.domain,
      tags: open.tags,
      score: 0,
      verdict: 'incorrect',
      conceptCoverage: [{ conceptId, coverage: 'missing' }],
      evaluatedBy: 'manual',
      answeredAt: '2026-05-20T00:00:00.000Z',
    };
    progress.history = [missRecord, { ...missRecord }];

    const mission = build(progress);
    expect(mission.reason.kind).toBe('weak-spot');
    expect(mission.focusDomain).toBe(open.domain);
    expect(mission.capability?.label).toBeTruthy();
  });

  test('the lesson step is marked done once the focus lesson is read', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;

    const before = build(progress);
    const lessonStep = before.steps.find((s) => s.kind === 'lesson');
    expect(lessonStep?.done).toBe(false);
    expect(before.focusLesson).toBeDefined();

    const read = setLessonRead(progress, before.focusLesson!.id, true, now);
    const after = build(read);
    expect(after.steps.find((s) => s.kind === 'lesson')?.done).toBe(true);
  });

  test('the primary CTA advances to the first step not yet done today', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;

    // Fresh day: the first undone step is the lesson, so the CTA opens it.
    const before = build(progress);
    const firstStep = before.steps.find((s) => !s.done);
    expect(firstStep).toBeDefined();
    expect(before.primaryPath).toBe(firstStep!.path);
    expect(before.primaryLabel).toBe(firstStep!.title);

    // After reading the focus lesson, the lesson step is done — the CTA should
    // move on to practice instead of re-opening the same lesson.
    const read = setLessonRead(progress, before.focusLesson!.id, true, now);
    const after = build(read);
    expect(after.steps.find((s) => s.kind === 'lesson')?.done).toBe(true);
    expect(after.primaryPath).toBe('/practice');
    expect(after.primaryPath).not.toBe(`/lessons/${after.focusLesson?.id}`);
  });

  test('practice / review / interview steps tick off from today\'s activity', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;

    const before = build(progress);
    const doneKinds = (m: ReturnType<typeof build>) =>
      m.steps.filter((s) => s.done).map((s) => s.kind);
    expect(doneKinds(before)).not.toContain('review');
    expect(doneKinds(before)).not.toContain('interview');

    let p = recordActivity(progress, 'practice', now);
    p = recordActivity(p, 'review', now);
    p = recordActivity(p, 'interview', now);
    const after = build(p);
    expect(after.steps.find((s) => s.kind === 'practice')?.done).toBe(true);
    expect(after.steps.find((s) => s.kind === 'review')?.done).toBe(true);
    expect(after.steps.find((s) => s.kind === 'interview')?.done).toBe(true);
  });

  test('any lesson read today counts the lesson step done, even if the focus moved', () => {
    const progress = createDefaultProgress();
    progress.placementDone = true;
    // Read some unrelated lesson today (not necessarily the current focus lesson).
    const read = setLessonRead(progress, 'some-other-lesson-id', true, now);
    const mission = build(read);
    expect(mission.steps.find((s) => s.kind === 'lesson')?.done).toBe(true);
  });
});
