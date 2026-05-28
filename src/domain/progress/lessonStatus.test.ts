import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import type { Verdict } from '../models/evaluation';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord, UserProgress } from '../models/progress';
import type { ChoiceQuestion } from '../models/question';
import { createDefaultProgress } from '../../storage/progressStorage';
import { setLessonRead } from './lessonProgress';
import {
  correctlyAnsweredIds,
  lessonProgress,
  lessonQuestionIds,
  lessonStatus,
} from './lessonStatus';

function question(id: string, tags: string[]): ChoiceQuestion {
  return {
    id,
    domain: 'java-core',
    difficulty: 2,
    type: 'single',
    mode: 'definition',
    prompt: '?',
    tags,
    answerGuide: { short: '', normal: '', traps: [], followUps: [] },
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionIds: ['a'],
  };
}

const index = buildContentIndex([
  question('q1', ['oop']),
  question('q2', ['oop']),
  question('q3', ['streams']), // same domain, different topic — not in the pool
]);

const lesson: Lesson = {
  id: 'oop-lesson',
  domain: 'java-core',
  topic: 'oop',
  title: 'OOP',
  summary: 's',
  order: 1,
  sections: [],
  relatedTags: ['oop'],
};

function record(questionId: string, verdict: Verdict): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: ['oop'],
    score: verdict === 'correct' ? 1 : 0,
    verdict,
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-23T00:00:00.000Z',
  };
}

function withHistory(history: AnswerRecord[]): UserProgress {
  return { ...createDefaultProgress(), history };
}

describe('correctlyAnsweredIds', () => {
  test('collects only ids answered correctly at least once', () => {
    const ids = correctlyAnsweredIds(
      withHistory([record('q1', 'correct'), record('q2', 'partial'), record('q3', 'incorrect')]),
    );
    expect([...ids].sort()).toEqual(['q1']);
  });

  test('an id counts as correct if any record is correct', () => {
    const ids = correctlyAnsweredIds(
      withHistory([record('q1', 'incorrect'), record('q1', 'correct')]),
    );
    expect(ids.has('q1')).toBe(true);
  });
});

describe('lessonQuestionIds', () => {
  test('keeps only same-domain questions matching the lesson tags', () => {
    expect(lessonQuestionIds(index, lesson).sort()).toEqual(['q1', 'q2']);
  });

  test('a lesson without related tags has an empty pool', () => {
    expect(lessonQuestionIds(index, { ...lesson, relatedTags: [] })).toEqual([]);
  });
});

describe('lessonProgress', () => {
  test('is 0 for a fresh learner', () => {
    expect(lessonProgress(withHistory([]), index, lesson)).toBe(0);
  });

  test('reflects the fraction of lesson questions answered correctly once', () => {
    expect(lessonProgress(withHistory([record('q1', 'correct')]), index, lesson)).toBe(0.5);
  });

  test('reaches 1 after a single correct pass over all lesson questions', () => {
    const p = withHistory([record('q1', 'correct'), record('q2', 'correct')]);
    expect(lessonProgress(p, index, lesson)).toBe(1);
  });

  test('a lesson with no questions counts as complete', () => {
    expect(lessonProgress(withHistory([]), index, { ...lesson, relatedTags: [] })).toBe(1);
  });
});

describe('lessonStatus', () => {
  test('unread until the lesson is marked read', () => {
    expect(lessonStatus(withHistory([]), index, lesson)).toBe('unread');
  });

  test('read but not all correct → needs-work', () => {
    let p = setLessonRead(withHistory([record('q1', 'correct')]), lesson.id, true);
    expect(lessonStatus(p, index, lesson)).toBe('needs-work');

    p = setLessonRead(withHistory([record('q1', 'partial'), record('q2', 'partial')]), lesson.id, true);
    expect(lessonStatus(p, index, lesson)).toBe('needs-work');
  });

  test('read and every pool question correct → passed', () => {
    const p = setLessonRead(
      withHistory([record('q1', 'correct'), record('q2', 'correct')]),
      lesson.id,
      true,
    );
    expect(lessonStatus(p, index, lesson)).toBe('passed');
  });

  test('a read lesson with no questions is passed (nothing to fail)', () => {
    const p = setLessonRead(withHistory([]), lesson.id, true);
    expect(lessonStatus(p, index, { ...lesson, relatedTags: [] })).toBe('passed');
  });
});
