import type { ComponentType } from 'react';
import type { LessonInteractive } from '../../domain/models/lesson';
import { IntegerCacheDemo } from './IntegerCacheDemo';
import { HashMapStepper } from './HashMapStepper';
import { ImmutableBuilder } from './ImmutableBuilder';
import { LockChooser } from './LockChooser';
import { CircuitBreakerDemo } from './CircuitBreakerDemo';
import { IdempotencyDemo } from './IdempotencyDemo';

/**
 * Registry mapping a lesson's `interactive.id` to its renderer. Lesson JSON only
 * stores `{ kind, id }`; the actual widget (and its pure compute logic) lives here,
 * so content stays declarative while each demo can be as rich as it needs to be.
 */
const REGISTRY: Record<string, ComponentType> = {
  'integer-cache': IntegerCacheDemo,
  'hashmap-put': HashMapStepper,
  'immutable-builder': ImmutableBuilder,
  'lock-chooser': LockChooser,
  'circuit-breaker': CircuitBreakerDemo,
  'idempotency-dedup': IdempotencyDemo,
};

/**
 * Renders the interactive widget referenced by a section. An unknown id degrades
 * gracefully: nothing in production, a console warning in dev (mirrors how
 * `LessonFigure` silently skips a missing asset).
 */
export function LessonInteractiveBlock({ spec }: { spec: LessonInteractive }) {
  const Widget = REGISTRY[spec.id];
  if (!Widget) {
    if (import.meta.env?.DEV) console.warn(`[lessons] unknown interactive widget "${spec.id}"`);
    return null;
  }
  return (
    <div className="lesson-widget">
      {spec.title && <h4 className="lesson-widget__title">{spec.title}</h4>}
      <Widget />
      {spec.caption && <p className="lesson-widget__caption">{spec.caption}</p>}
    </div>
  );
}
