import { describe, expect, test } from 'bun:test';
import { createDefaultProgress } from '../../storage/progressStorage';
import type { AnswerRecord } from '../models/progress';
import { rankWeakConcepts, rankWeakDomains } from './weakSpotDetection';

describe('rankWeakDomains', () => {
  test('orders domains weakest (lowest ability) first', () => {
    const progress = createDefaultProgress();
    progress.skills['databases'].ability = 1.2;
    progress.skills['java-core'].ability = 4.5;

    const ranked = rankWeakDomains(progress);
    expect(ranked[0]?.domain).toBe('databases');
    expect(ranked[ranked.length - 1]?.domain).toBe('java-core');
  });
});

describe('rankWeakConcepts', () => {
  function record(coverage: AnswerRecord['conceptCoverage']): AnswerRecord {
    return {
      questionId: 'q',
      domain: 'java-core',
      tags: [],
      score: 0.5,
      verdict: 'partial',
      evaluatedBy: 'chrome-prompt',
      answeredAt: '2026-05-20T00:00:00.000Z',
      conceptCoverage: coverage,
    };
  }

  test('ranks concepts by miss rate, ignoring covered ones', () => {
    const progress = createDefaultProgress();
    progress.history = [
      record([
        { conceptId: 'weak', coverage: 'missing' },
        { conceptId: 'ok', coverage: 'covered' },
      ]),
      record([
        { conceptId: 'weak', coverage: 'missing' },
        { conceptId: 'ok', coverage: 'covered' },
      ]),
    ];

    const ranked = rankWeakConcepts(progress);
    expect(ranked[0]?.conceptId).toBe('weak');
    expect(ranked[0]?.missRate).toBe(1);
    expect(ranked.find((c) => c.conceptId === 'ok')?.missRate).toBe(0);
  });
});
