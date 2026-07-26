import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import type { Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord, UserProgress } from '../models/progress';
import type { Question } from '../models/question';
import { markLessonDefended } from '../progress/lessonDefense';
import { goalGaps, pluralTopics } from './gaps';

function question(id: string, domain: Domain): Question {
  return {
    id,
    domain,
    difficulty: 3,
    type: 'single',
    mode: 'definition',
    prompt: `Вопрос ${id}`,
    tags: [],
    answerGuide: { short: '', normal: '', traps: [], followUps: [] },
    options: [
      { id: 'a', text: 'a' },
      { id: 'b', text: 'b' },
    ],
    correctOptionIds: ['a'],
  };
}

function lesson(id: string, domain: Domain, questionIds: string[]): Lesson {
  return {
    id,
    domain,
    topic: id,
    title: `Урок ${id}`,
    summary: '',
    order: 1,
    sections: [],
    questionIds,
  };
}

function progressWith(history: AnswerRecord[], lessonsRead: string[]): UserProgress {
  const skill = (domain: Domain) => ({ domain, ability: 3, answered: 0, correct: 0 });
  return {
    version: 1,
    skills: {
      'java-core': skill('java-core'),
      'spring-boot': skill('spring-boot'),
      databases: skill('databases'),
      'message-brokers': skill('message-brokers'),
      'system-design': skill('system-design'),
    },
    history,
    placementDone: true,
    streakDays: 0,
    lessonsRead: Object.fromEntries(lessonsRead.map((id) => [id, '2026-01-01T00:00:00Z'])),
  };
}

function correct(questionId: string, domain: Domain): AnswerRecord {
  return {
    questionId,
    domain,
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-01-01T00:00:00Z',
  };
}

const ZERO_READINESS: Record<Domain, number> = {
  'java-core': 0,
  'spring-boot': 0,
  databases: 0,
  'message-brokers': 0,
  'system-design': 0,
};

describe('goalGaps', () => {
  const index = buildContentIndex([question('q1', 'java-core'), question('q2', 'spring-boot')]);
  const lessons = [lesson('l1', 'java-core', ['q1']), lesson('l2', 'spring-boot', ['q2'])];

  test('counts lessons that are not yet passed', () => {
    const gaps = goalGaps({
      progress: progressWith([], []),
      index,
      lessons,
      readinessByDomain: { ...ZERO_READINESS, 'java-core': 0.2, 'spring-boot': 0.5 },
    });
    expect(gaps.map((g) => [g.domain, g.remainingLessons])).toEqual([
      ['java-core', 1],
      ['spring-boot', 1],
    ]);
  });

  test('orders the weakest domain first', () => {
    const gaps = goalGaps({
      progress: progressWith([], []),
      index,
      lessons,
      readinessByDomain: { ...ZERO_READINESS, 'java-core': 0.7, 'spring-boot': 0.1 },
    });
    expect(gaps.map((g) => g.domain)).toEqual(['spring-boot', 'java-core']);
  });

  test('drops a domain once its readiness is closed', () => {
    const gaps = goalGaps({
      progress: progressWith([], []),
      index,
      lessons,
      readinessByDomain: { ...ZERO_READINESS, 'java-core': 0.95, 'spring-boot': 0.3 },
    });
    expect(gaps.map((g) => g.domain)).toEqual(['spring-boot']);
  });

  test('drops a domain with nothing concrete left to do', () => {
    // l1 is read, its only question is correct, and the topic is defended → passed.
    const progress = markLessonDefended(
      progressWith([correct('q1', 'java-core')], ['l1']),
      'l1',
    );
    const gaps = goalGaps({
      progress,
      index,
      lessons,
      readinessByDomain: { ...ZERO_READINESS, 'java-core': 0.2, 'spring-boot': 0.2 },
    });
    expect(gaps.map((g) => g.domain)).toEqual(['spring-boot']);
  });
});

describe('pluralTopics', () => {
  test('follows Russian plural rules', () => {
    expect(pluralTopics(1)).toBe('тема');
    expect(pluralTopics(3)).toBe('темы');
    expect(pluralTopics(5)).toBe('тем');
    expect(pluralTopics(11)).toBe('тем');
    expect(pluralTopics(21)).toBe('тема');
  });
});
