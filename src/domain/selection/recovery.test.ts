import { describe, expect, test } from 'bun:test';
import type { Domain } from '../models/common';
import type { AnswerRecord } from '../models/progress';
import { DESIRABLE_OFFSET } from './adaptiveSelector';
import { RECOVERY_WINDOW, recoveryOffset } from './recovery';

function rec(domain: Domain, score: number): AnswerRecord {
  return {
    questionId: 'q',
    domain,
    tags: [],
    score,
    verdict: score >= 0.7 ? 'correct' : score > 0 ? 'partial' : 'incorrect',
    evaluatedBy: 'local-choice',
    answeredAt: '2026-05-20T00:00:00.000Z',
  };
}

describe('recoveryOffset', () => {
  test('stays at the default with too few samples', () => {
    expect(recoveryOffset([], 'java-core')).toBe(DESIRABLE_OFFSET);
    expect(recoveryOffset([rec('java-core', 0)], 'java-core')).toBe(DESIRABLE_OFFSET);
  });

  test('drops a full level below desirable on a losing streak', () => {
    const history = [rec('java-core', 0), rec('java-core', 0), rec('java-core', 0)];
    expect(recoveryOffset(history, 'java-core')).toBe(-1);
  });

  test('aims at-level when answers are shaky (mixed)', () => {
    const history = [rec('java-core', 1), rec('java-core', 0), rec('java-core', 0.3)];
    expect(recoveryOffset(history, 'java-core')).toBe(0);
  });

  test('returns to the default once recent answers recover', () => {
    const history = [rec('java-core', 1), rec('java-core', 1), rec('java-core', 0.8)];
    expect(recoveryOffset(history, 'java-core')).toBe(DESIRABLE_OFFSET);
  });

  test('only the most recent in-domain answers count', () => {
    // Old failures fall outside the window once enough good answers follow.
    const old = Array.from({ length: 5 }, () => rec('java-core', 0));
    const fresh = Array.from({ length: RECOVERY_WINDOW }, () => rec('java-core', 1));
    expect(recoveryOffset([...old, ...fresh], 'java-core')).toBe(DESIRABLE_OFFSET);
  });

  test('is scoped per domain', () => {
    const history = [rec('databases', 0), rec('databases', 0), rec('databases', 0)];
    // The struggle is in databases; java-core has no signal → default.
    expect(recoveryOffset(history, 'java-core')).toBe(DESIRABLE_OFFSET);
    expect(recoveryOffset(history, 'databases')).toBe(-1);
  });
});
