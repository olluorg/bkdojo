import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import type { AnswerOutcome } from '../models/answer';
import type { Domain } from '../models/common';
import type { Verdict } from '../models/evaluation';
import type { Lesson } from '../models/lesson';
import type { Question } from '../models/question';
import { buildDefenseSession, isDefensePassed } from './defense';

function question(id: string, difficulty: 1 | 2 | 3 | 4 | 5, domain: Domain = 'java-core'): Question {
  return {
    id,
    domain,
    difficulty,
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

function lesson(questionIds: string[]): Lesson {
  return {
    id: 'l1',
    domain: 'java-core',
    topic: 't',
    title: 'Тема',
    summary: '',
    order: 1,
    sections: [],
    questionIds,
  };
}

function outcome(verdict: Verdict): AnswerOutcome {
  return {
    questionId: 'q',
    domain: 'java-core',
    difficulty: 3,
    tags: [],
    score: verdict === 'correct' ? 1 : 0.4,
    verdict,
    evaluatedBy: 'local-choice',
    answeredAt: '2026-01-01T00:00:00Z',
  };
}

describe('buildDefenseSession', () => {
  const index = buildContentIndex([question('q1', 4), question('q2', 1), question('q3', 3)]);

  test('takes every question of the lesson, ramped easy → hard', () => {
    const session = buildDefenseSession(index, lesson(['q1', 'q2', 'q3']));
    expect(session.items.map((i) => i.question.id)).toEqual(['q2', 'q3', 'q1']);
  });

  test('skips ids that are not in the bank', () => {
    const session = buildDefenseSession(index, lesson(['q1', 'ghost']));
    expect(session.items.map((i) => i.question.id)).toEqual(['q1']);
  });

  test('a lesson with no questions yields an empty session', () => {
    expect(buildDefenseSession(index, lesson([])).items).toEqual([]);
  });
});

describe('isDefensePassed', () => {
  test('passes only when every answer of the pass was correct', () => {
    expect(isDefensePassed([outcome('correct'), outcome('correct')])).toBe(true);
  });

  test('one partial answer fails the defense', () => {
    expect(isDefensePassed([outcome('correct'), outcome('partial')])).toBe(false);
  });

  test('one wrong answer fails the defense', () => {
    expect(isDefensePassed([outcome('correct'), outcome('incorrect')])).toBe(false);
  });

  test('an empty pass is not a pass', () => {
    expect(isDefensePassed([])).toBe(false);
  });
});
