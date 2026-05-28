import { describe, expect, test } from 'bun:test';
import { validateLessons } from './lessonValidation';

function validLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    domain: 'java-core',
    topic: 'oop',
    order: 1,
    title: 'Title',
    summary: 'Summary',
    sections: [{ heading: 'H', paragraphs: ['p1', 'p2'] }],
    ...overrides,
  };
}

describe('validateLessons', () => {
  test('accepts a valid lesson', () => {
    const { valid, issues } = validateLessons([validLesson()]);
    expect(valid).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  test('root must be an array', () => {
    const { issues } = validateLessons({});
    expect(issues[0]?.message).toContain('array');
  });

  test('rejects empty sections', () => {
    const { issues } = validateLessons([validLesson({ sections: [] })]);
    expect(issues.some((i) => i.message.includes('sections'))).toBe(true);
  });

  test('rejects a section without paragraphs', () => {
    const { issues } = validateLessons([validLesson({ sections: [{ heading: 'H', paragraphs: [] }] })]);
    expect(issues.some((i) => i.message.includes('paragraphs'))).toBe(true);
  });

  test('flags duplicate ids', () => {
    const { valid, issues } = validateLessons([validLesson(), validLesson()]);
    expect(valid).toHaveLength(1);
    expect(issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });

  test('enforces expectedDomain', () => {
    const { issues } = validateLessons([validLesson({ domain: 'databases' })], {
      expectedDomain: 'java-core',
    });
    expect(issues.some((i) => i.message.includes('does not match'))).toBe(true);
  });
});
