import { describe, expect, test } from 'bun:test';
import { resolveEvaluators } from './evaluatorResolver';

function ids(method: Parameters<typeof resolveEvaluators>[0]) {
  return resolveEvaluators(method).map((e) => e.id);
}

describe('resolveEvaluators', () => {
  test('manual → only manual', () => {
    expect(ids({ method: 'manual' })).toEqual(['manual']);
  });

  test('chrome → chrome then manual backstop', () => {
    expect(ids({ method: 'chrome' })).toEqual(['chrome-prompt', 'manual']);
  });

  test('server → server then manual backstop', () => {
    expect(ids({ method: 'server' })).toEqual(['server', 'manual']);
  });

  test('auto starts on-device (chrome) and always ends with manual', () => {
    const chain = ids({ method: 'auto' });
    expect(chain[0]).toBe('chrome-prompt');
    expect(chain[chain.length - 1]).toBe('manual');
    expect(chain).not.toContain('rule-based');
  });

  test('auto with rule-based enabled includes it, before the manual backstop', () => {
    const chain = ids({ method: 'auto', enableRuleBased: true });
    expect(chain[0]).toBe('chrome-prompt');
    expect(chain).toContain('rule-based');
    expect(chain[chain.length - 1]).toBe('manual');
    expect(chain.indexOf('rule-based')).toBeLessThan(chain.indexOf('manual'));
  });

  test('explicit evaluators override the method', () => {
    const custom = resolveEvaluators({ evaluators: [] });
    expect(custom).toEqual([]);
  });
});
