import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { loadAllLessons } from '../content/lessonLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { lessonQuestionIds } from '../progress/lessonStatus';
import { buildDailyPlan, buildFocusedDailyPlan } from './dailyPlan';

const index = buildContentIndex(loadContent().questions);
const lessons = loadAllLessons();
const now = new Date('2026-05-22T00:00:00.000Z');
const rng = () => 0;

function dueRecord(questionId: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 0,
    verdict: 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-10T00:00:00.000Z',
    nextReviewAt: '2026-05-15T00:00:00.000Z', // due before `now`
  };
}

describe('buildDailyPlan', () => {
  test('fills with fresh questions when nothing is due', () => {
    const session = buildDailyPlan(index, createDefaultProgress(), { size: 6, now, rng });
    expect(session.items).toHaveLength(6);
    expect(session.items.every((i) => i.reason === 'daily')).toBe(true);
    expect(new Set(session.items.map((i) => i.question.id)).size).toBe(6);
  });

  test('puts due reviews first, then fresh, without duplicates', () => {
    const progress = createDefaultProgress();
    progress.history = [dueRecord('jc-001')];

    const session = buildDailyPlan(index, progress, { size: 6, now, rng });
    expect(session.items[0]?.question.id).toBe('jc-001');
    expect(session.items[0]?.reason).toBe('review');
    expect(new Set(session.items.map((i) => i.question.id)).size).toBe(session.items.length);
  });

  test('mixes in a weak question that is not yet due', () => {
    const progress = createDefaultProgress();
    // Wrong earlier, but next review is far in the future — so it is weak but not
    // due, and only the weak mix can surface it.
    progress.history = [
      {
        questionId: 'jc-002',
        domain: 'java-core',
        tags: [],
        score: 0,
        verdict: 'incorrect',
        evaluatedBy: 'local-choice',
        answeredAt: '2026-05-20T00:00:00.000Z',
        nextReviewAt: '2026-09-01T00:00:00.000Z', // not due before `now`
      },
    ];

    const session = buildDailyPlan(index, progress, { size: 8, now, rng });
    const mixed = session.items.find((i) => i.question.id === 'jc-002');
    expect(mixed).toBeDefined();
    expect(mixed!.reasonText).toContain('слабое место');
  });

  test('focused plan stays inside the requested domain', () => {
    const session = buildFocusedDailyPlan(index, createDefaultProgress(), {
      domain: 'databases',
      size: 6,
      now,
      rng,
    });

    expect(session.items).toHaveLength(6);
    expect(session.items.every((i) => i.question.domain === 'databases')).toBe(true);
  });

  test('focused plan prefers the mission lesson questions before domain fill', () => {
    const lesson = lessons.find((l) => lessonQuestionIds(index, l).length >= 2);
    if (!lesson) throw new Error('fixture: no lesson with questions found');
    const lessonIds = new Set(lessonQuestionIds(index, lesson));

    const session = buildFocusedDailyPlan(index, createDefaultProgress(), {
      domain: lesson.domain,
      lesson,
      size: 4,
      now,
      rng,
    });

    expect(session.items.length).toBeGreaterThan(0);
    expect(session.items[0]).toBeDefined();
    expect(lessonIds.has(session.items[0]!.question.id)).toBe(true);
    expect(session.items.every((i) => i.question.domain === lesson.domain)).toBe(true);
  });
});
