import glossary from '../../data/glossary.json';
import type { GlossaryTerm } from '../models/glossary';
import { validateGlossary, type GlossaryIssue } from './glossaryValidation';

export interface LoadedGlossary {
  terms: GlossaryTerm[];
  issues: GlossaryIssue[];
}

export function loadGlossary(): LoadedGlossary {
  const { valid, issues } = validateGlossary(glossary);
  return { terms: valid, issues };
}

export function loadAllTerms(): GlossaryTerm[] {
  const { terms, issues } = loadGlossary();
  if (issues.length > 0 && import.meta.env?.DEV) {
    console.warn(`[glossary] ${issues.length} invalid term(s) dropped`, issues);
  }
  return terms;
}
