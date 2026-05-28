import { describe, expect, test } from 'bun:test';
import { validateQuestions } from './questionValidation';

const guide = {
  short: 'short',
  normal: 'normal',
  traps: ['t'],
  followUps: ['f'],
};

function validOpen(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-open',
    domain: 'java-core',
    difficulty: 2,
    type: 'open',
    mode: 'definition',
    prompt: 'prompt?',
    tags: ['x'],
    rubric: [
      { id: 'c1', title: 'C1', description: 'd', required: true, weight: 1 },
    ],
    answerGuide: guide,
    ...overrides,
  };
}

function validSingle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-single',
    domain: 'java-core',
    difficulty: 2,
    type: 'single',
    mode: 'definition',
    prompt: 'prompt?',
    tags: ['x'],
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionIds: ['a'],
    answerGuide: guide,
    ...overrides,
  };
}

describe('validateQuestions', () => {
  test('accepts valid open and choice questions', () => {
    const { valid, issues } = validateQuestions([validOpen(), validSingle()]);
    expect(valid).toHaveLength(2);
    expect(issues).toHaveLength(0);
  });

  test('root must be an array', () => {
    const { valid, issues } = validateQuestions({ not: 'array' });
    expect(valid).toHaveLength(0);
    expect(issues[0]?.message).toContain('array');
  });

  test('rejects invalid difficulty', () => {
    const { valid, issues } = validateQuestions([validOpen({ difficulty: 9 })]);
    expect(valid).toHaveLength(0);
    expect(issues.some((i) => i.message.includes('difficulty'))).toBe(true);
  });

  test('rejects single-choice with more than one correct option', () => {
    const { issues } = validateQuestions([validSingle({ correctOptionIds: ['a', 'b'] })]);
    expect(issues.some((i) => i.message.includes('exactly one'))).toBe(true);
  });

  test('rejects correctOptionIds referencing missing options', () => {
    const { issues } = validateQuestions([validSingle({ correctOptionIds: ['zzz'] })]);
    expect(issues.some((i) => i.message.includes('existing options'))).toBe(true);
  });

  test('rejects open question without rubric', () => {
    const { issues } = validateQuestions([validOpen({ rubric: [] })]);
    expect(issues.some((i) => i.message.includes('rubric'))).toBe(true);
  });

  test('flags duplicate ids', () => {
    const { valid, issues } = validateQuestions([validOpen(), validOpen()]);
    expect(valid).toHaveLength(1);
    expect(issues.some((i) => i.message.includes('duplicate question id'))).toBe(true);
  });

  test('accepts a live-coding open question (language + starterCode)', () => {
    const { valid, issues } = validateQuestions([
      validOpen({ id: 'q-code', mode: 'live_coding', language: 'java', starterCode: 'class X {}' }),
    ]);
    expect(valid).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  test('rejects an empty language on an open question', () => {
    const { issues } = validateQuestions([validOpen({ language: '' })]);
    expect(issues.some((i) => i.message.includes('language'))).toBe(true);
  });

  test('enforces expectedDomain', () => {
    const { issues } = validateQuestions([validOpen({ domain: 'databases' })], {
      expectedDomain: 'java-core',
    });
    expect(issues.some((i) => i.message.includes('does not match'))).toBe(true);
  });
});
