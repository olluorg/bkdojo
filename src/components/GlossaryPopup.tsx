import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GlossaryTerm } from '../domain/models/glossary';

interface Props {
  term: GlossaryTerm;
  anchor: HTMLElement;
  onClose: () => void;
}

const WIDTH = 320;
const GAP = 8;

/**
 * Floating popover anchored to the clicked glossary term. Auto-flips below the
 * anchor when there isn't enough room above, clamps within the viewport, and
 * closes on outside click or Escape. Rendered absolutely in document flow so
 * page scroll doesn't desync it.
 */
export function GlossaryPopup({ term, anchor, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean }>({
    top: 0,
    left: 0,
    below: false,
  });

  // Measure anchor + own height to decide above/below and clamp horizontally.
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const own = ref.current?.getBoundingClientRect();
    const ownHeight = own?.height ?? 120;
    const fitsAbove = rect.top > ownHeight + GAP + 8;
    const below = !fitsAbove;
    const top = below
      ? window.scrollY + rect.bottom + GAP
      : window.scrollY + rect.top - GAP - ownHeight;
    const desiredLeft = window.scrollX + rect.left;
    const maxLeft = window.scrollX + window.innerWidth - WIDTH - 8;
    const left = Math.max(window.scrollX + 8, Math.min(desiredLeft, maxLeft));
    setPos({ top, left, below });
  }, [anchor, term]);

  // Close on outside click or Escape, but ignore clicks on the anchor itself
  // (the anchor's onClick re-opens us, which would feel buggy).
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      className="glossary-popup"
      role="dialog"
      aria-label={`Глоссарий: ${term.term}`}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: WIDTH }}
    >
      <button
        type="button"
        className="glossary-popup__close"
        onClick={onClose}
        aria-label="Закрыть"
      >
        ×
      </button>
      <div className="glossary-popup__title">{term.term}</div>
      <div className="glossary-popup__def">{term.definition}</div>
      {term.aliases && term.aliases.length > 0 && (
        <div className="glossary-popup__aliases">также: {term.aliases.join(', ')}</div>
      )}
    </div>
  );
}
