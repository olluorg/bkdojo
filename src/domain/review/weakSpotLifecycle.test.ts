import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { ConceptCoverage } from '../models/evaluation';
import type { AnswerRecord } from '../models/progress';
import { rankWeakConceptStatuses, weakSpotState } from './weakSpotLifecycle';

const now = new Date('2026-05-22T12:00:00.000Z');

function record(coverage: ConceptCoverage, answeredAt: string): AnswerRecord {
  return {
    questionId: `q-${coverage}-${answeredAt}`,
    domain: 'java-core',
    tags: [],
    score: coverage === 'covered' ? 1 : coverage === 'partial' ? 0.5 : 0,
    verdict: coverage === 'covered' ? 'correct' : coverage === 'partial' ? 'partial' : 'incorrect',
    conceptCoverage: [{ conceptId: 'concept-a', coverage }],
    evaluatedBy: 'manual',
    answeredAt,
  };
}

describe('weakSpotState', () => {
  test('missing latest stays active', () => {
    const progress = createDefaultProgress();
    progress.history = [record('missing', '2026-05-20T00:00:00.000Z')];
    expect(weakSpotState(progress, 'concept-a', now)).toBe('active');
  });

  test('any concept attempt today is marked practiced-today unless resolved', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('missing', '2026-05-20T00:00:00.000Z'),
      record('partial', '2026-05-22T08:00:00.000Z'),
    ];
    expect(weakSpotState(progress, 'concept-a', now)).toBe('practiced-today');
  });

  test('covered or partial latest from a previous day goes to cooldown', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('missing', '2026-05-18T00:00:00.000Z'),
      record('partial', '2026-05-21T00:00:00.000Z'),
    ];
    expect(weakSpotState(progress, 'concept-a', now)).toBe('cooldown');
  });

  test('two trailing covered answers resolve the weak spot', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('missing', '2026-05-18T00:00:00.000Z'),
      record('covered', '2026-05-21T00:00:00.000Z'),
      record('covered', '2026-05-22T08:00:00.000Z'),
    ];
    expect(weakSpotState(progress, 'concept-a', now)).toBe('resolved');
  });
});

describe('rankWeakConceptStatuses', () => {
  test('adds learner-facing lifecycle labels and hides resolved by default', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record('missing', '2026-05-18T00:00:00.000Z'),
      record('covered', '2026-05-21T00:00:00.000Z'),
      record('covered', '2026-05-22T08:00:00.000Z'),
    ];

    expect(rankWeakConceptStatuses(progress, { now })).toHaveLength(0);
    const [status] = rankWeakConceptStatuses(progress, { now, includeResolved: true });
    expect(status?.state).toBe('resolved');
    expect(status?.label).toBe('Закрывается');
  });
});
