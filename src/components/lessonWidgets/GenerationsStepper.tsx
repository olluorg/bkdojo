import { useMemo, useState } from 'react';
import {
  EDEN_CAPACITY,
  simulateGenerations,
  SURVIVOR_CAPACITY,
  TENURING_THRESHOLD,
  type GcAction,
  type HeapObject,
} from '../../domain/content/widgets/gcGenerationsSim';

const ACTION_LABEL: Record<GcAction, string> = {
  init: 'старт',
  alloc: 'аллокация',
  minor: 'minor GC',
};

/** One heap region: a fixed grid of slots so filling and emptying stay visible. */
function Region({
  title,
  hint,
  objects,
  slots,
  promoted,
}: {
  title: string;
  hint: string;
  objects: HeapObject[];
  /** Fixed number of cells; the old generation grows instead and passes undefined. */
  slots?: number;
  promoted: Set<string>;
}) {
  const empty = slots ? Math.max(0, slots - objects.length) : 0;
  return (
    <div className="gcs__region">
      <div className="gcs__region-head">
        <span className="gcs__region-title">{title}</span>
        <span className="gcs__region-hint">{hint}</span>
      </div>
      <div className="gcs__slots">
        {objects.map((o) => (
          <span
            key={o.id}
            className={`gcs__obj${promoted.has(o.id) ? ' gcs__obj--moved' : ''}`}
            title={`возраст ${o.age}`}
          >
            {o.id}
            <small>{o.age}</small>
          </span>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <span key={`empty-${i}`} className="gcs__slot" />
        ))}
        {slots === undefined && objects.length === 0 && <span className="gcs__empty">пусто</span>}
      </div>
    </div>
  );
}

/**
 * Steps through the young generation: Eden fills up, a minor GC copies only the
 * survivors into the survivor space and frees Eden wholesale, ages tick up, and
 * objects leave for the old generation either by reaching the tenuring threshold
 * or because the survivor space overflowed. The view is a pure function of the step.
 */
export function GenerationsStepper() {
  const steps = useMemo(() => simulateGenerations(), []);
  const [i, setI] = useState(0);
  const step = steps[i]!; // i is clamped to [0, steps.length)
  const promoted = new Set(step.promoted);

  const allocated = steps
    .slice(0, i + 1)
    .reduce((n, s) => (s.action === 'alloc' ? n + s.eden.length : n), 0);
  const collected = steps.slice(0, i + 1).reduce((n, s) => n + s.collected, 0);
  const deadPct = allocated === 0 ? 0 : Math.round((collected / allocated) * 100);

  return (
    <div className="gcs">
      <div className="gcs__controls">
        <button className="btn btn--ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
          ← Назад
        </button>
        <span className="gcs__progress">
          шаг {i + 1}/{steps.length}
          <span className={`gcs__action gcs__action--${step.action}`}>{ACTION_LABEL[step.action]}</span>
        </span>
        <button
          className="btn btn--ghost"
          onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
          disabled={i === steps.length - 1}
        >
          Дальше →
        </button>
        <button className="btn btn--ghost gcs__reset" onClick={() => setI(0)} disabled={i === 0}>
          ⟲ Сброс
        </button>
      </div>

      {step.premature && (
        <div className="gcs__warn">
          ⚠ Survivor переполнен — часть выживших уехала в old досрочно (преждевременное продвижение)
        </div>
      )}

      <div className="gcs__young">
        <Region
          title="Eden"
          hint={`${step.eden.length}/${EDEN_CAPACITY}`}
          objects={step.eden}
          slots={EDEN_CAPACITY}
          promoted={promoted}
        />
        <Region
          title={`Survivor ${step.survivorLabel}`}
          hint={`${step.survivor.length}/${SURVIVOR_CAPACITY} · продвижение с возраста ${TENURING_THRESHOLD}`}
          objects={step.survivor}
          slots={SURVIVOR_CAPACITY}
          promoted={promoted}
        />
      </div>

      <Region
        title="Old generation"
        hint={step.old.length > 0 ? `${step.old.length} объектов` : 'сюда попадают долгожители'}
        objects={step.old}
        promoted={promoted}
      />

      <div className="gcs__meta">
        выделено <strong>{allocated}</strong> · собрано <strong>{collected}</strong> ·{' '}
        <strong>{deadPct}%</strong> объектов умерли молодыми
      </div>

      <p className="gcs__note">{step.note}</p>
    </div>
  );
}
