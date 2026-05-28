import { describe, expect, test } from 'bun:test';
import { validateGlossary } from './glossaryValidation';

function validTerm(overrides: Record<string, unknown> = {}) {
  return { id: 't1', term: 'ACID', definition: 'def', domain: 'databases', level: 2, ...overrides };
}

describe('validateGlossary', () => {
  test('accepts a valid term', () => {
    const { valid, issues } = validateGlossary([validTerm()]);
    expect(valid).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  test('root must be an array', () => {
    expect(validateGlossary({}).issues[0]?.message).toContain('array');
  });

  test('rejects a term without definition', () => {
    const { issues } = validateGlossary([validTerm({ definition: '' })]);
    expect(issues.some((i) => i.message.includes('definition'))).toBe(true);
  });

  test('rejects an invalid course or level', () => {
    expect(validateGlossary([validTerm({ domain: 'nope' })]).issues.some((i) => i.message.includes('domain'))).toBe(true);
    expect(validateGlossary([validTerm({ level: 9 })]).issues.some((i) => i.message.includes('level'))).toBe(true);
  });

  test('flags duplicate ids', () => {
    const { valid, issues } = validateGlossary([validTerm(), validTerm()]);
    expect(valid).toHaveLength(1);
    expect(issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });
});
