import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { domainMastery, overallRank, questionMastery } from './mastery';

const index = buildContentIndex(loadContent().questions);

function correct(questionId: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-22T00:00:00.000Z',
  };
}

describe('questionMastery', () => {
  test('grows with consecutive correct answers and caps at 1', () => {
    const p = createDefaultProgress();
    expect(questionMastery(p, 'jc-001')).toBe(0);
    p.history = [correct('jc-001')];
    expect(questionMastery(p, 'jc-001')).toBe(0.5);
    p.history = [correct('jc-001'), correct('jc-001')];
    expect(questionMastery(p, 'jc-001')).toBe(1);
  });

  test('a wrong answer resets mastery', () => {
    const p = createDefaultProgress();
    p.history = [
      correct('jc-001'),
      correct('jc-001'),
      { ...correct('jc-001'), verdict: 'incorrect', score: 0 },
    ];
    expect(questionMastery(p, 'jc-001')).toBe(0);
  });
});

describe('domainMastery', () => {
  test('is 0 with no history and rises as questions are mastered', () => {
    const p = createDefaultProgress();
    expect(domainMastery(p, index, 'java-core')).toBe(0);
    p.history = [correct('jc-001'), correct('jc-001')];
    expect(domainMastery(p, index, 'java-core')).toBeGreaterThan(0);
  });
});

describe('overallRank', () => {
  test('a fresh learner is junior', () => {
    expect(overallRank(createDefaultProgress(), index).rank).toBe('junior');
  });

  test('high ability + full coverage reaches the top ranks', () => {
    const p = createDefaultProgress();
    for (const d of Object.keys(p.skills) as (keyof typeof p.skills)[]) {
      p.skills[d].ability = 5;
    }
    p.history = index.all.flatMap((q) => [
      { ...correct(q.id), domain: q.domain },
      { ...correct(q.id), domain: q.domain },
    ]);
    const result = overallRank(p, index);
    expect(result.coverage).toBe(1);
    expect(['architect', 'staff']).toContain(result.rank);
  });
});
