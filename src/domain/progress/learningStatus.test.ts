import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord } from '../models/progress';
import { createDefaultProgress } from '../../storage/progressStorage';
import { setLessonRead } from './lessonProgress';
import { lessonQuestionIds } from './lessonStatus';
import { domainLearningStatus, lessonLearningStatus } from './learningStatus';

const index = buildContentIndex(loadContent().questions);
const now = new Date('2026-05-22T00:00:00.000Z');

function lessonFixture(): Lesson {
  return {
    id: 'lesson-status-fixture',
    domain: 'java-core',
    topic: 'status',
    title: 'Status fixture',
    summary: 'Fixture',
    order: 1,
    sections: [{ heading: 'A', paragraphs: ['B'] }],
    questionIds: ['jc-001', 'jc-002'],
  };
}

function record(questionId: string, verdict: AnswerRecord['verdict'], nextReviewAt?: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: verdict === 'correct' ? 1 : 0,
    verdict,
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-20T00:00:00.000Z',
    nextReviewAt,
  };
}

describe('lessonLearningStatus', () => {
  test('fresh lesson separates read, test and retention states', () => {
    const status = lessonLearningStatus(createDefaultProgress(), index, lessonFixture(), now);
    expect(status.read).toBe('unread');
    expect(status.test.state).toBe('not-started');
    expect(status.test.label).toBe('Тест 0/2');
    expect(status.retention.state).toBe('not-ready');
  });

  test('partial answers show test progress but not retention readiness', () => {
    const progress = createDefaultProgress();
    progress.history = [record('jc-001', 'correct')];
    const status = lessonLearningStatus(progress, index, lessonFixture(), now);
    expect(status.test.state).toBe('in-progress');
    expect(status.test.correct).toBe(1);
    expect(status.test.total).toBe(2);
    expect(status.retention.state).toBe('not-ready');
  });

  test('passed lesson with due reviews asks for retention work', () => {
    let progress = createDefaultProgress();
    progress = setLessonRead(progress, 'lesson-status-fixture', true, now);
    progress.history = [
      record('jc-001', 'correct', '2026-05-21T00:00:00.000Z'),
      record('jc-002', 'correct', '2026-05-30T00:00:00.000Z'),
    ];

    const status = lessonLearningStatus(progress, index, lessonFixture(), now);
    expect(status.read).toBe('read');
    expect(status.test.state).toBe('passed');
    expect(status.retention.state).toBe('due');
    expect(status.retention.due).toBe(1);
  });
});

describe('domainLearningStatus', () => {
  test('summarizes lessons, tests and due reviews for a domain', () => {
    const lesson = lessonFixture();
    const progress = createDefaultProgress();
    progress.history = [record('jc-001', 'correct', '2026-05-21T00:00:00.000Z')];

    const status = domainLearningStatus(progress, index, 'java-core', [lesson], now);
    expect(status.lessonsTotal).toBe(1);
    expect(status.testsPassed).toBe(0);
    expect(status.retentionDue).toBe(0);
    expect(status.summary).toContain('0/1 прочитано');
  });

  test('counts a passed lesson with due questions as one lesson to review', () => {
    const lesson = lessonFixture();
    const progress = createDefaultProgress();
    progress.history = [
      record('jc-001', 'correct', '2026-05-21T00:00:00.000Z'),
      record('jc-002', 'correct', '2026-05-21T00:00:00.000Z'),
    ];

    const status = domainLearningStatus(progress, index, 'java-core', [lesson], now);
    expect(status.testsPassed).toBe(1);
    expect(status.retentionDue).toBe(1);
    expect(status.summary).toContain('повторить 1');
  });

  test('fixture question ids resolve to real questions', () => {
    expect(lessonQuestionIds(index, lessonFixture())).toHaveLength(2);
  });
});
