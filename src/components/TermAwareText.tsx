import { type ReactNode, useMemo } from 'react';
import type { GlossaryTerm } from '../domain/models/glossary';
import { findTermMatches, type TermMatch } from '../domain/glossary/termHighlight';

interface Props {
  text: string;
  /** Pre-built candidate list (memoized in parent) — see buildCandidates. */
  candidates: Parameters<typeof findTermMatches>[1];
  onTermClick: (term: GlossaryTerm, anchor: HTMLElement) => void;
}

/**
 * Renders plain text, replacing glossary-known terms with clickable buttons
 * that open a definition popup. First match per term per paragraph keeps it
 * unobtrusive; everything else is rendered as ordinary text nodes.
 */
export function TermAwareText({ text, candidates, onTermClick }: Props) {
  const matches: TermMatch[] = useMemo(
    () => findTermMatches(text, candidates),
    [text, candidates],
  );
  if (matches.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (cursor < m.start) parts.push(text.slice(cursor, m.start));
    parts.push(
      <button
        key={`t-${i}`}
        type="button"
        className="glossary-term"
        onClick={(e) => onTermClick(m.term, e.currentTarget)}
        aria-label={`Определение: ${m.term.term}`}
        title={`Глоссарий: ${m.term.term}`}
      >
        {text.slice(m.start, m.end)}
      </button>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
