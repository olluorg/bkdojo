import type { Question } from '../models/question';
import { validateQuestions } from './questionValidation';

/**
 * Client-side persistence of AI-generated follow-up questions (directive 2:
 * "search the bank; if nothing fits, generate a question and put it in the
 * bank"). With no backend, the "bank" is the runtime content index plus this
 * localStorage cache, which is merged back in at load. Entries are validated on
 * read, so a corrupt or schema-drifted cache degrades to "no extras", never a
 * crash.
 */

const STORAGE_KEY = 'bkdojo.generatedQuestions';

/** Marks a question as machine-authored so the UI / future review can tell. */
export const GENERATED_SOURCE = 'ai-generated';

export function isGeneratedQuestion(q: Question): boolean {
  return q.meta?.source === GENERATED_SOURCE;
}

function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // privacy mode / storage disabled
  }
}

/** All cached generated questions, dropping any that no longer validate. */
export function loadGeneratedQuestions(): Question[] {
  const s = store();
  if (!s) return [];
  const raw = s.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateQuestions(parsed).valid;
  } catch {
    return []; // corrupt entry — ignore
  }
}

/** Appends one generated question, de-duplicating by id. Non-fatal on failure. */
export function saveGeneratedQuestion(q: Question): void {
  const s = store();
  if (!s) return;
  const existing = loadGeneratedQuestions();
  if (existing.some((e) => e.id === q.id)) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify([...existing, q]));
  } catch {
    // quota / serialization failure — non-fatal
  }
}
