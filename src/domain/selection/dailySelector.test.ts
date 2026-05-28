import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import type { AnswerRecord } from '../models/progress';
import { createDefaultProgress } from '../../storage/progressStorage';
import { buildDailySession, domainsByWeakness } from './dailySelector';

const index = buildContentIndex(loadContent().questions);
const rng = () => 0; // deterministic tie-breaking

function record(questionId: string): AnswerRecord {
  return {
    questionId,
    domain: 'java-core',
    tags: [],
    score: 1,
    verdict: 'correct',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-20T00:00:00.000Z',
  };
}

describe('buildDailySession', () => {
  test('returns the requested number of unique questions', () => {
    const session = buildDailySession(index, createDefaultProgress(), { size: 6, rng });
    expect(session.items).toHaveLength(6);
    const ids = new Set(session.items.map((i) => i.question.id));
    expect(ids.size).toBe(6);
    expect(session.items.every((i) => i.reason === 'daily')).toBe(true);
  });

  test('skips recently answered questions', () => {
    const progress = createDefaultProgress();
    progress.history = [record('jc-003')];
    const session = buildDailySession(index, progress, { size: 6, rng, recentWindow: 30 });
    expect(session.items.some((i) => i.question.id === 'jc-003')).toBe(false);
  });

  test('weakest domain is served first', () => {
    const progress = createDefaultProgress();
    progress.skills['message-brokers'].ability = 1; // make it the weakest
    const order = domainsByWeakness(progress);
    expect(order[0]).toBe('message-brokers');

    const session = buildDailySession(index, progress, { size: 1, rng });
    expect(session.items[0]?.question.domain).toBe('message-brokers');
  });
});
