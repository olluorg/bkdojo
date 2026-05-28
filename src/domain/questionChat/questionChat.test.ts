import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ChoiceQuestion, OpenQuestion } from '../models/question';
import { buildQuestionChatSystem, outcomeAnswerText } from './questionChat';

const open: OpenQuestion = {
  id: 'o1',
  domain: 'java-core',
  difficulty: 3,
  type: 'open',
  mode: 'definition',
  prompt: 'Объясни volatile',
  tags: ['concurrency'],
  answerGuide: {
    short: 'видимость',
    normal: 'volatile гарантирует видимость записей между потоками',
    traps: ['Путают с атомарностью'],
    followUps: [],
  },
  rubric: [
    { id: 'c1', title: 'Видимость', description: 'd', required: true, weight: 1 },
    { id: 'c2', title: 'Happens-before', description: 'd', required: true, weight: 1 },
  ],
};

const choice: ChoiceQuestion = {
  id: 'c1',
  domain: 'java-core',
  difficulty: 2,
  type: 'single',
  mode: 'definition',
  prompt: 'Выбери верное',
  tags: ['concurrency'],
  answerGuide: { short: '', normal: '', traps: [], followUps: [] },
  options: [
    { id: 'a', text: 'Верный вариант' },
    { id: 'b', text: 'Неверный вариант' },
  ],
  correctOptionIds: ['a'],
};

function outcome(overrides: Partial<AnswerOutcome>): AnswerOutcome {
  return {
    questionId: 'o1',
    domain: 'java-core',
    difficulty: 3,
    tags: ['concurrency'],
    score: 0,
    verdict: 'incorrect',
    evaluatedBy: 'chrome-prompt',
    answeredAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('outcomeAnswerText', () => {
  test('open answer returns the stored text', () => {
    expect(outcomeAnswerText(open, outcome({ answer: 'мой ответ' }))).toBe('мой ответ');
  });

  test('open answer without stored text is flagged', () => {
    expect(outcomeAnswerText(open, outcome({ answer: undefined }))).toContain('не сохранён');
  });

  test('skipped answer is flagged as skipped', () => {
    expect(outcomeAnswerText(open, outcome({ evaluatedBy: 'skipped' }))).toContain('пропущено');
  });

  test('choice answer resolves option ids to texts', () => {
    expect(
      outcomeAnswerText(choice, outcome({ questionId: 'c1', selectedOptionIds: ['b'] })),
    ).toBe('Неверный вариант');
  });

  test('choice answer with no selection is flagged', () => {
    expect(outcomeAnswerText(choice, outcome({ questionId: 'c1', selectedOptionIds: [] }))).toContain(
      'не выбрано',
    );
  });
});

describe('buildQuestionChatSystem', () => {
  test('grounds the chat in the question, reference, rubric, traps, and answer', () => {
    const sys = buildQuestionChatSystem(open, 'volatile делает поле атомарным', 'incorrect');
    expect(sys).toContain('наставник');
    expect(sys).toContain('Объясни volatile');
    expect(sys).toContain('volatile гарантирует видимость');
    expect(sys).toContain('Happens-before');
    expect(sys).toContain('Путают с атомарностью');
    expect(sys).toContain('не зачёт');
    expect(sys).toContain('volatile делает поле атомарным');
  });

  test('choice reference lists the correct options', () => {
    const sys = buildQuestionChatSystem(choice, 'Неверный вариант', 'incorrect');
    expect(sys).toContain('Верный вариант');
  });
});
