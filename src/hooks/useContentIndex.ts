import { useMemo } from 'react';
import { addToIndex, buildContentIndex, type ContentIndex } from '../domain/content/contentIndex';
import { loadAllQuestions } from '../domain/content/contentLoader';
import { loadGeneratedQuestions } from '../domain/content/generatedQuestions';

/**
 * Builds the content index once per app session: the bundled question bank plus
 * any AI-generated follow-up questions persisted from earlier sessions
 * (directive 2 — generated questions live in the bank).
 */
export function useContentIndex(): ContentIndex {
  return useMemo(() => {
    const index = buildContentIndex(loadAllQuestions());
    for (const q of loadGeneratedQuestions()) addToIndex(index, q);
    return index;
  }, []);
}
