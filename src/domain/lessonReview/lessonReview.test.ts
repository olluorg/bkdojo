import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import type { Verdict } from '../models/evaluation';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord, UserProgress } from '../models/progress';
import type { ChoiceQuestion, OpenQuestion } from '../models/question';
import { createDefaultProgress } from '../../storage/progressStorage';
import { lessonAnswersFingerprint, summarizeLessonAnswers } from './lessonReview';

const open: OpenQuestion = {
  id: 'o1',
  domain: 'java-core',
  difficulty: 3,
  type: 'open',
  mode: 'definition',
  prompt: 'Объясни инкапсуляцию',
  tags: ['oop'],
  answerGuide: { short: 'кратко', normal: 'эталонный ответ', traps: [], followUps: [] },
  rubric: [
    { id: 'c1', title: 'Сокрытие', description: 'd', required: true, weight: 1 },
    { id: 'c2', title: 'Инварианты', description: 'd', required: true, weight: 1 },
  ],
};

const choice: ChoiceQuestion = {
  id: 'c1',
  domain: 'java-core',
  difficulty: 2,
  type: 'single',
  mode: 'definition',
  prompt: 'Выбери верное',
  tags: ['oop'],
  answerGuide: { short: '', normal: '', traps: [], followUps: [] },
  options: [
    { id: 'a', text: 'Правильный' },
    { id: 'b', text: 'Неправильный' },
  ],
  correctOptionIds: ['a'],
};

// An off-topic question (different tag) — must not affect this lesson's fingerprint.
const offTopic: ChoiceQuestion = {
  ...choice,
  id: 'x1',
  tags: ['streams'],
  prompt: 'Не по теме',
};

const index = buildContentIndex([open, choice, offTopic]);

const lesson: Lesson = {
  id: 'oop',
  domain: 'java-core',
  topic: 'oop',
  title: 'ООП',
  summary: 'Основы',
  order: 1,
  sections: [],
  relatedTags: ['oop'],
};

function record(overrides: Partial<AnswerRecord> & { questionId: string; verdict: Verdict }): AnswerRecord {
  return {
    domain: 'java-core',
    tags: ['oop'],
    score: overrides.verdict === 'correct' ? 1 : 0,
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  };
}

function withHistory(history: AnswerRecord[]): UserProgress {
  return { ...createDefaultProgress(), history };
}

describe('summarizeLessonAnswers', () => {
  test('no answers → nothing to review', () => {
    const summary = summarizeLessonAnswers(withHistory([]), index, lesson);
    expect(summary.answeredCount).toBe(0);
    expect(summary.mistakeItems).toHaveLength(0);
  });

  test('correct answers count but are not mistakes', () => {
    const summary = summarizeLessonAnswers(
      withHistory([record({ questionId: 'o1', verdict: 'correct' })]),
      index,
      lesson,
    );
    expect(summary.answeredCount).toBe(1);
    expect(summary.mistakeItems).toHaveLength(0);
  });

  test('open mistake carries the stored answer, reference, and missed concepts', () => {
    const summary = summarizeLessonAnswers(
      withHistory([
        record({
          questionId: 'o1',
          verdict: 'partial',
          answer: 'мой ответ',
          conceptCoverage: [
            { conceptId: 'c1', coverage: 'covered' },
            { conceptId: 'c2', coverage: 'missing' },
          ],
        }),
      ]),
      index,
      lesson,
    );
    expect(summary.mistakeItems).toHaveLength(1);
    const m = summary.mistakeItems[0]!;
    expect(m.userAnswer).toBe('мой ответ');
    expect(m.reference).toBe('эталонный ответ');
    expect(m.missedConcepts).toEqual(['Инварианты']);
  });

  test('choice mistake resolves option ids to their texts', () => {
    const summary = summarizeLessonAnswers(
      withHistory([record({ questionId: 'c1', verdict: 'incorrect', selectedOptionIds: ['b'] })]),
      index,
      lesson,
    );
    expect(summary.mistakeItems[0]!.userAnswer).toBe('Неправильный');
    expect(summary.mistakeItems[0]!.reference).toBe('Правильный');
  });

  test('uses the most recent answer per question', () => {
    const summary = summarizeLessonAnswers(
      withHistory([
        record({ questionId: 'o1', verdict: 'incorrect', answer: 'старый' }),
        record({ questionId: 'o1', verdict: 'correct', answer: 'новый' }),
      ]),
      index,
      lesson,
    );
    expect(summary.answeredCount).toBe(1);
    expect(summary.mistakeItems).toHaveLength(0); // latest is correct
  });

  test('a skipped answer is shown as skipped', () => {
    const summary = summarizeLessonAnswers(
      withHistory([record({ questionId: 'o1', verdict: 'incorrect', evaluatedBy: 'skipped' })]),
      index,
      lesson,
    );
    expect(summary.mistakeItems[0]!.userAnswer).toContain('пропущено');
  });
});

describe('lessonAnswersFingerprint', () => {
  test('is stable for the same answers', () => {
    const a = withHistory([record({ questionId: 'o1', verdict: 'partial', answer: 'x' })]);
    const b = withHistory([record({ questionId: 'o1', verdict: 'partial', answer: 'x' })]);
    expect(lessonAnswersFingerprint(a, index, lesson)).toBe(lessonAnswersFingerprint(b, index, lesson));
  });

  test('changes when a verdict changes', () => {
    const before = withHistory([record({ questionId: 'o1', verdict: 'incorrect', answer: 'x' })]);
    const after = withHistory([record({ questionId: 'o1', verdict: 'correct', answer: 'x' })]);
    expect(lessonAnswersFingerprint(before, index, lesson)).not.toBe(
      lessonAnswersFingerprint(after, index, lesson),
    );
  });

  test('changes when a wrong answer is reworded', () => {
    const before = withHistory([record({ questionId: 'o1', verdict: 'partial', answer: 'старый' })]);
    const after = withHistory([record({ questionId: 'o1', verdict: 'partial', answer: 'новый' })]);
    expect(lessonAnswersFingerprint(before, index, lesson)).not.toBe(
      lessonAnswersFingerprint(after, index, lesson),
    );
  });

  test('ignores rewording of a correct answer (mistake breakdown is unchanged)', () => {
    const before = withHistory([record({ questionId: 'o1', verdict: 'correct', answer: 'a' })]);
    const after = withHistory([record({ questionId: 'o1', verdict: 'correct', answer: 'b' })]);
    expect(lessonAnswersFingerprint(before, index, lesson)).toBe(
      lessonAnswersFingerprint(after, index, lesson),
    );
  });

  test('ignores answers to questions outside the lesson', () => {
    const base = withHistory([record({ questionId: 'o1', verdict: 'partial', answer: 'x' })]);
    const withOffTopic = withHistory([
      record({ questionId: 'o1', verdict: 'partial', answer: 'x' }),
      record({ questionId: 'x1', verdict: 'incorrect', selectedOptionIds: ['b'] }),
    ]);
    expect(lessonAnswersFingerprint(base, index, lesson)).toBe(
      lessonAnswersFingerprint(withOffTopic, index, lesson),
    );
  });
});
