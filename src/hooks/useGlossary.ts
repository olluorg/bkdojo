import { useMemo } from 'react';
import { loadAllTerms } from '../domain/content/glossaryLoader';
import type { GlossaryTerm } from '../domain/models/glossary';

/** Loads the glossary once per app session. */
export function useGlossary(): GlossaryTerm[] {
  return useMemo(() => loadAllTerms(), []);
}
