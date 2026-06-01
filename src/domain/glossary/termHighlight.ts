import type { GlossaryTerm } from '../models/glossary';

/**
 * One non-overlapping highlight in a paragraph: positions in the original text
 * and the glossary term the match resolves to. The UI uses these to wrap the
 * matched substring in a clickable button that opens the definition popup.
 */
export interface TermMatch {
  start: number;
  end: number;
  term: GlossaryTerm;
}

interface Candidate {
  text: string;
  lower: string;
  term: GlossaryTerm;
}

/**
 * Builds the lookup list of strings to search for — each term's display name
 * plus any aliases — back-linked to its term. Sorted longest-first so a longer
 * match wins over a shorter overlapping one (e.g. "LRU-кэш" beats "LRU").
 * Built once per glossary load and reused across paragraphs.
 */
export function buildCandidates(terms: readonly GlossaryTerm[]): Candidate[] {
  const list: Candidate[] = [];
  for (const term of terms) {
    list.push({ text: term.term, lower: term.term.toLowerCase(), term });
    for (const alias of term.aliases ?? []) {
      list.push({ text: alias, lower: alias.toLowerCase(), term });
    }
  }
  list.sort((a, b) => b.lower.length - a.lower.length);
  return list;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

/**
 * Whole-word, case-insensitive scan of `text` for glossary candidates. Boundary
 * check is Unicode-aware (works for Cyrillic), match positions never overlap,
 * and each term highlights at most ONCE per paragraph to avoid visual noise.
 * Longer candidates are tried first, so they win over shorter substrings.
 */
export function findTermMatches(text: string, candidates: readonly Candidate[]): TermMatch[] {
  if (text.length === 0 || candidates.length === 0) return [];
  const lower = text.toLowerCase();
  const occupied = new Uint8Array(text.length);
  const seen = new Set<string>();
  const matches: TermMatch[] = [];

  for (const c of candidates) {
    if (seen.has(c.term.id)) continue;
    let from = 0;
    while (from <= text.length - c.lower.length) {
      const i = lower.indexOf(c.lower, from);
      if (i < 0) break;
      const end = i + c.lower.length;
      const before = i > 0 ? text[i - 1] : undefined;
      const after = end < text.length ? text[end] : undefined;
      if (isWordChar(before) || isWordChar(after)) {
        from = i + 1;
        continue;
      }
      let overlap = false;
      for (let k = i; k < end; k++) {
        if (occupied[k]) {
          overlap = true;
          break;
        }
      }
      if (overlap) {
        from = i + 1;
        continue;
      }
      matches.push({ start: i, end, term: c.term });
      seen.add(c.term.id);
      for (let k = i; k < end; k++) occupied[k] = 1;
      break;
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}
