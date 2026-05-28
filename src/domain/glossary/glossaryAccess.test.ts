import { describe, expect, test } from 'bun:test';
import { buildContentIndex, getByDomain } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { loadGlossary } from '../content/glossaryLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import { courseLevelFromMastery, courseLevelOf, maxUnlockedLevel } from '../course/courses';
import type { AnswerRecord } from '../models/progress';
import { isTermUnlocked } from './glossaryAccess';

const index = buildContentIndex(loadContent().questions);
const terms = loadGlossary().terms;

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

describe('course level', () => {
  test('grows with mastery and unlocks higher term levels', () => {
    expect(courseLevelFromMastery(0)).toBe('junior');
    expect(courseLevelFromMastery(0.25)).toBe('middle');
    expect(courseLevelFromMastery(0.5)).toBe('senior');
    expect(courseLevelFromMastery(0.75)).toBe('architect');

    expect(maxUnlockedLevel('junior')).toBe(2);
    expect(maxUnlockedLevel('architect')).toBe(5);
  });
});

describe('isTermUnlocked', () => {
  const gc = terms.find((t) => t.id === 'gc')!; // java-core, level 2
  const volatileTerm = terms.find((t) => t.id === 'volatile')!; // java-core, level 3

  test('junior course unlocks only level <= 2 terms', () => {
    const p = createDefaultProgress();
    expect(courseLevelOf(p, index, 'java-core')).toBe('junior');
    expect(isTermUnlocked(gc, p, index)).toBe(true);
    expect(isTermUnlocked(volatileTerm, p, index)).toBe(false);
  });

  test('mastering the course unlocks higher-level terms', () => {
    const p = createDefaultProgress();
    p.history = getByDomain(index, 'java-core').flatMap((q) => [correct(q.id), correct(q.id)]);
    expect(courseLevelOf(p, index, 'java-core')).toBe('architect');
    expect(isTermUnlocked(volatileTerm, p, index)).toBe(true);
  });
});
