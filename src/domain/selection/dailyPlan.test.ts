import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { buildDailyPlan } from './dailyPlan';

const index = buildContentIndex(loadContent().questions);
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
});
