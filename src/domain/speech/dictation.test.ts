import { describe, expect, test } from 'bun:test';
import {
  TARGET_MAX_SECONDS,
  TARGET_MIN_SECONDS,
  appendChunk,
  classifyError,
  formatDuration,
  pacingFor,
} from './dictation';

describe('pacingFor', () => {
  test('bands a spoken answer around the interview target length', () => {
    expect(pacingFor(0)).toBe('warmup');
    expect(pacingFor(TARGET_MIN_SECONDS - 1)).toBe('warmup');
    expect(pacingFor(TARGET_MIN_SECONDS)).toBe('good');
    expect(pacingFor(TARGET_MAX_SECONDS)).toBe('good');
    expect(pacingFor(TARGET_MAX_SECONDS + 1)).toBe('over');
  });
});

describe('formatDuration', () => {
  test('renders m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_400)).toBe('0:09');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  test('clamps negatives instead of rendering garbage', () => {
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('appendChunk', () => {
  test('joins phrases with a single space', () => {
    expect(appendChunk('', 'HashMap это')).toBe('HashMap это');
    expect(appendChunk('HashMap это', 'хеш-таблица')).toBe('HashMap это хеш-таблица');
  });

  test('collapses whitespace and ignores empty chunks', () => {
    expect(appendChunk('a', '  b   c ')).toBe('a b c');
    expect(appendChunk('a', '   ')).toBe('a');
    expect(appendChunk('a ', '')).toBe('a ');
  });
});

describe('classifyError', () => {
  test('surfaces actionable failures', () => {
    expect(classifyError('not-allowed')).toBe('denied');
    expect(classifyError('service-not-allowed')).toBe('denied');
    expect(classifyError('audio-capture')).toBe('no-device');
    expect(classifyError('network')).toBe('failed');
  });

  test('treats silence and our own stop as transient', () => {
    expect(classifyError('no-speech')).toBeUndefined();
    expect(classifyError('aborted')).toBeUndefined();
  });
});
