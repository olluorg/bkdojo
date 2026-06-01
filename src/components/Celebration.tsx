import { useMemo } from 'react';

const COLORS = ['#2b6ef2', '#1faa59', '#ff7a2e', '#e5484d', '#c98a12', '#8b5cf6'];

/**
 * A lightweight, dependency-free confetti burst played once on mount — used to
 * celebrate finishing a session. Purely decorative (aria-hidden) and disabled
 * under prefers-reduced-motion via CSS.
 */
export function Celebration({ pieces = 28 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 0.9 + Math.random() * 0.9,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [pieces],
  );

  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti__bit"
          style={{
            left: `${b.left}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            background: b.color,
            width: `${b.size}px`,
            height: `${b.size * 0.6}px`,
          }}
        />
      ))}
    </div>
  );
}
