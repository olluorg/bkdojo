import { describe, expect, test } from 'bun:test';
import { levelLabel } from './level';

describe('levelLabel', () => {
  test('maps ability ranges to levels', () => {
    expect(levelLabel(1)).toBe('junior');
    expect(levelLabel(2.4)).toBe('junior');
    expect(levelLabel(3)).toBe('middle');
    expect(levelLabel(3.9)).toBe('middle');
    expect(levelLabel(4)).toBe('senior');
    expect(levelLabel(5)).toBe('senior');
  });
});
