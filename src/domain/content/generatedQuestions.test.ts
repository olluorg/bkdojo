import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { openQ } from '../lesson/questionFixtures';
import {
  GENERATED_SOURCE,
  loadGeneratedQuestions,
  saveGeneratedQuestion,
} from './generatedQuestions';

const KEY = 'bkdojo.generatedQuestions';

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    _map: map,
  };
}

let storage: ReturnType<typeof fakeLocalStorage>;
const original = globalThis.localStorage;

beforeEach(() => {
  storage = fakeLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
});

function generated(id: string) {
  const q = openQ(id);
  return { ...q, meta: { verified: false, source: GENERATED_SOURCE } };
}

describe('generatedQuestions store', () => {
  test('round-trips a saved question', () => {
    saveGeneratedQuestion(generated('gen-1'));
    expect(loadGeneratedQuestions().map((q) => q.id)).toEqual(['gen-1']);
  });

  test('de-duplicates by id', () => {
    saveGeneratedQuestion(generated('gen-1'));
    saveGeneratedQuestion(generated('gen-1'));
    saveGeneratedQuestion(generated('gen-2'));
    expect(loadGeneratedQuestions().map((q) => q.id)).toEqual(['gen-1', 'gen-2']);
  });

  test('drops a corrupt cache entry instead of throwing', () => {
    storage._map.set(KEY, '{ not json');
    expect(loadGeneratedQuestions()).toEqual([]);
  });

  test('drops entries that no longer validate', () => {
    storage._map.set(KEY, JSON.stringify([{ id: 'broken' }]));
    expect(loadGeneratedQuestions()).toEqual([]);
  });

  test('returns nothing when no cache is present', () => {
    expect(loadGeneratedQuestions()).toEqual([]);
  });
});
