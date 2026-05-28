import { describe, expect, test } from 'bun:test';
import { buildLessonReviewPrompt, type LessonReviewItem } from './lessonReviewPrompt';

function item(overrides: Partial<LessonReviewItem> = {}): LessonReviewItem {
  return {
    prompt: 'Что такое инкапсуляция?',
    type: 'open',
    userAnswer: 'Это когда поля приватные',
    reference: 'Сокрытие внутреннего состояния за публичным контрактом',
    verdict: 'partial',
    missedConcepts: ['Инварианты'],
    ...overrides,
  };
}

describe('buildLessonReviewPrompt', () => {
  test('includes the lesson topic, question, answer, and reference', () => {
    const { system, user } = buildLessonReviewPrompt({
      lessonTitle: 'ООП',
      lessonSummary: 'Основы',
      items: [item()],
    });
    expect(system).toContain('наставник');
    expect(user).toContain('ООП');
    expect(user).toContain('Что такое инкапсуляция?');
    expect(user).toContain('Это когда поля приватные');
    expect(user).toContain('Сокрытие внутреннего состояния');
    expect(user).toContain('Инварианты');
  });

  test('caps the number of reviewed questions', () => {
    const items = Array.from({ length: 12 }, (_, i) => item({ prompt: `Вопрос №${i}` }));
    const { user } = buildLessonReviewPrompt({ lessonTitle: 't', lessonSummary: 's', items });
    expect(user).toContain('Вопрос №5');
    expect(user).not.toContain('Вопрос №6');
  });

  test('truncates very long answers to keep the prompt small', () => {
    const { user } = buildLessonReviewPrompt({
      lessonTitle: 't',
      lessonSummary: 's',
      items: [item({ userAnswer: 'x'.repeat(2000) })],
    });
    expect(user).toContain('…');
    expect(user.length).toBeLessThan(2000);
  });
});
