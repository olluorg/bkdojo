import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { interviewReadiness, streakRisk, domainForecast } from './predictions';

const index = buildContentIndex(loadContent().questions);
const NOW = new Date('2026-05-10T12:00:00');

function answer(questionId: string, at: string, correct: boolean): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: correct ? 1 : 0,
    verdict: correct ? 'correct' : 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: at,
  };
}

describe('interviewReadiness', () => {
  test('fresh learner is not ready and has no pace-based ETA', () => {
    const r = interviewReadiness(createDefaultProgress(), index, NOW);
    expect(r.ready).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.etaDays).toBeUndefined(); // no answers → no pace
  });

  test('recent improving accuracy reads as an upward trend', () => {
    const history = [
      answer('a', '2026-05-08T08:00:00', false),
      answer('b', '2026-05-09T08:00:00', true),
      answer('c', '2026-05-10T08:00:00', true),
    ];
    const p: UserProgress = { ...createDefaultProgress(), history };
    expect(interviewReadiness(p, index, NOW).trend).toBe('up');
  });
});

describe('streakRisk', () => {
  test('active today → safe', () => {
    const p: UserProgress = {
      ...createDefaultProgress(),
      streakDays: 3,
      lastPracticeDate: '2026-05-10',
    };
    expect(streakRisk(p, NOW)).toMatchObject({ level: 'safe', days: 3, willBreak: false });
  });

  test('practiced yesterday → at risk of breaking today', () => {
    const p: UserProgress = {
      ...createDefaultProgress(),
      streakDays: 3,
      lastPracticeDate: '2026-05-09',
    };
    expect(streakRisk(p, NOW)).toMatchObject({ level: 'at-risk', willBreak: true });
  });

  test('lapsed → none', () => {
    const p: UserProgress = {
      ...createDefaultProgress(),
      streakDays: 3,
      lastPracticeDate: '2026-05-01',
    };
    expect(streakRisk(p, NOW).level).toBe('none');
  });
});

describe('domainForecast', () => {
  test('reports current mastery and a level for a domain', () => {
    const f = domainForecast(createDefaultProgress(), index, 'java-core', NOW);
    expect(f.domain).toBe('java-core');
    expect(f.mastery).toBeGreaterThanOrEqual(0);
    expect(f.mastery).toBeLessThanOrEqual(1);
    expect(['junior', 'middle', 'senior']).toContain(f.level);
  });
});
