import { describe, expect, test } from 'bun:test';
import type { Domain } from '../models/common';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { myAnswers, myAnswersByDomain } from './myAnswers';

function record(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    questionId: 'q1',
    domain: 'java-core',
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'chrome-prompt',
    answer: 'мой ответ',
    answeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function progressWith(history: AnswerRecord[]): UserProgress {
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
  };
}

describe('myAnswers', () => {
  test('keeps only answers that would actually pass', () => {
    const progress = progressWith([
      record({ questionId: 'ok', verdict: 'correct' }),
      record({ questionId: 'partial', verdict: 'partial' }),
      record({ questionId: 'wrong', verdict: 'incorrect' }),
    ]);
    expect(myAnswers(progress).map((a) => a.questionId)).toEqual(['ok']);
  });

  test('ignores skipped questions and empty text', () => {
    const progress = progressWith([
      record({ questionId: 'skipped', evaluatedBy: 'skipped' }),
      record({ questionId: 'blank', answer: '   ' }),
      record({ questionId: 'missing', answer: undefined }),
    ]);
    expect(myAnswers(progress)).toEqual([]);
  });

  test('keeps the highest-scoring telling of a question', () => {
    const progress = progressWith([
      record({ score: 1, answer: 'лучший', answeredAt: '2026-01-01T00:00:00Z' }),
      record({ score: 0.8, answer: 'слабее', answeredAt: '2026-02-01T00:00:00Z' }),
    ]);
    const answers = myAnswers(progress);
    expect(answers).toHaveLength(1);
    expect(answers[0]?.text).toBe('лучший');
  });

  test('prefers the more recent telling on an equal score', () => {
    const progress = progressWith([
      record({ score: 1, answer: 'первый', answeredAt: '2026-01-01T00:00:00Z' }),
      record({ score: 1, answer: 'свежее', answeredAt: '2026-02-01T00:00:00Z' }),
    ]);
    expect(myAnswers(progress)[0]?.text).toBe('свежее');
  });

  test('trims the stored text', () => {
    const progress = progressWith([record({ answer: '  с пробелами  ' })]);
    expect(myAnswers(progress)[0]?.text).toBe('с пробелами');
  });

  test('returns newest first across questions', () => {
    const progress = progressWith([
      record({ questionId: 'old', answeredAt: '2026-01-01T00:00:00Z' }),
      record({ questionId: 'new', answeredAt: '2026-03-01T00:00:00Z' }),
      record({ questionId: 'mid', answeredAt: '2026-02-01T00:00:00Z' }),
    ]);
    expect(myAnswers(progress).map((a) => a.questionId)).toEqual(['new', 'mid', 'old']);
  });
});

describe('myAnswersByDomain', () => {
  test('groups answers by their domain', () => {
    const progress = progressWith([
      record({ questionId: 'j1', domain: 'java-core' }),
      record({ questionId: 's1', domain: 'spring-boot' }),
      record({ questionId: 'j2', domain: 'java-core' }),
    ]);
    const grouped = myAnswersByDomain(progress);
    expect(grouped.get('java-core')).toHaveLength(2);
    expect(grouped.get('spring-boot')).toHaveLength(1);
    expect(grouped.get('databases')).toBeUndefined();
  });
});
