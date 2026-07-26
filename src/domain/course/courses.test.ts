import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { loadLessons } from '../content/lessonLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { markLessonDefended } from '../progress/lessonDefense';
import { setLessonRead } from '../progress/lessonProgress';
import { lessonQuestionIds } from '../progress/lessonStatus';
import { buildCourses, courseProgress, nextStep, stepProgress } from './courses';

const index = buildContentIndex(loadContent().questions);
const courses = buildCourses(loadLessons().lessons);

function correct(questionId: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-22T00:00:00.000Z',
  };
}

describe('buildCourses', () => {
  test('creates a course per domain in DOMAINS order, steps ordered by lesson order', () => {
    expect(courses.length).toBeGreaterThanOrEqual(2);
    expect(courses[0]?.domain).toBe('java-core');
    const jc = courses.find((c) => c.domain === 'java-core')!;
    const orders = jc.steps.map((s) => s.lesson.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe('course progress', () => {
  const jc = courses.find((c) => c.domain === 'java-core')!;

  test('is 0 and points at the first step for a fresh learner', () => {
    const p = createDefaultProgress();
    expect(courseProgress(p, index, jc)).toBe(0);
    expect(nextStep(p, index, jc)?.id).toBe(jc.steps[0]!.lesson.id);
  });

  test('answering every lesson question fills the bar but does not complete the step', () => {
    const first = jc.steps[0]!.lesson;
    const ids = lessonQuestionIds(index, first);
    expect(ids.length).toBeGreaterThan(0);

    const p = createDefaultProgress();
    p.history = ids.map((id) => correct(id));

    // The bar tracks questions cleared…
    expect(stepProgress(p, index, first)).toBe(1);
    expect(courseProgress(p, index, jc)).toBeGreaterThan(0);
    // …but closing the step now needs the topic defended, so the course still
    // points at this lesson.
    expect(nextStep(p, index, jc)?.id).toBe(first.id);
  });

  test('defending the topic completes the step and advances the course', () => {
    const first = jc.steps[0]!.lesson;
    const ids = lessonQuestionIds(index, first);

    let p = createDefaultProgress();
    p.history = ids.map((id) => correct(id));
    p = setLessonRead(p, first.id, true);
    p = markLessonDefended(p, first.id);

    expect(nextStep(p, index, jc)?.id).not.toBe(first.id);
  });

  test('partial completion is reflected proportionally', () => {
    const first = jc.steps[0]!.lesson;
    const ids = lessonQuestionIds(index, first);
    const p = createDefaultProgress();
    p.history = [correct(ids[0]!)]; // one of several
    const value = stepProgress(p, index, first);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});
