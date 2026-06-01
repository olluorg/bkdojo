import { useMemo, useState } from 'react';
import {
  DEFAULT_HASHMAP_KEYS,
  simulateHashMap,
  type StepAction,
} from '../../domain/content/widgets/hashMapSim';

const ACTION_LABEL: Record<StepAction, string> = {
  init: 'старт',
  place: 'вставка',
  collision: 'коллизия',
  resize: 'resize',
  treeify: 'treeify',
};

/**
 * Steps through inserting keys into a HashMap: index computation pipeline, the
 * load-factor gauge, chaining on collision, and the doubling resize. The view is a
 * pure function of the current step.
 */
export function HashMapStepper() {
  const steps = useMemo(() => simulateHashMap(DEFAULT_HASHMAP_KEYS, { initialCapacity: 4 }), []);
  const [i, setI] = useState(0);
  const step = steps[i]!; // i is clamped to [0, steps.length)

  const present = new Set(step.table.flat().map((e) => e.key));
  const threshold = step.capacity * 0.75;
  const fillPct = Math.min(100, (step.size / step.capacity) * 100);
  const thresholdPct = (threshold / step.capacity) * 100;

  return (
    <div className="hms">
      {/* Keys to insert: done ✓ / current ● / pending */}
      <div className="hms__keys">
        {DEFAULT_HASHMAP_KEYS.map((key) => {
          const state =
            key === step.newKey ? 'cur' : present.has(key) ? 'done' : 'todo';
          return (
            <span key={key} className={`hms__key hms__key--${state}`}>
              {state === 'done' ? '✓ ' : state === 'cur' ? '● ' : ''}
              {key}
            </span>
          );
        })}
      </div>

      <div className="hms__controls">
        <button className="btn btn--ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
          ← Назад
        </button>
        <span className="hms__progress">
          шаг {i + 1}/{steps.length}
          <span className={`hms__action hms__action--${step.action}`}>{ACTION_LABEL[step.action]}</span>
        </span>
        <button
          className="btn btn--ghost"
          onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
          disabled={i === steps.length - 1}
        >
          Дальше →
        </button>
        <button className="btn btn--ghost hms__reset" onClick={() => setI(0)} disabled={i === 0}>
          ⟲ Сброс
        </button>
      </div>

      {/* Index derivation pipeline for the current put. */}
      {step.compute && (
        <div className="hms__pipe">
          <span className="hms__pipe-cell">
            "{step.compute.key}"<small>hashCode</small>
            <b>{step.compute.hashCode}</b>
          </span>
          <span className="hms__pipe-op">^ (h&gt;&gt;&gt;16)</span>
          <span className="hms__pipe-cell">
            spread<b>{step.compute.spread}</b>
          </span>
          <span className="hms__pipe-op">&amp; {step.capacity - 1}</span>
          <span className="hms__pipe-cell hms__pipe-cell--idx">
            индекс<b>{step.compute.index}</b>
          </span>
        </div>
      )}

      {/* Resize transition badge. */}
      {step.action === 'resize' && step.resizeFrom != null && (
        <div className="hms__resize">
          ⤢ Таблица выросла: {step.resizeFrom} → <strong>{step.capacity}</strong> бакетов, всё перехешировано
        </div>
      )}

      {/* Load-factor gauge: fill = size/capacity, marker at the 0.75 threshold. */}
      <div className="hms__gauge" title={`size ${step.size} / порог ${threshold}`}>
        <div
          className={`hms__gauge-fill${step.size > threshold ? ' hms__gauge-fill--over' : ''}`}
          style={{ width: `${fillPct}%` }}
        />
        <span className="hms__gauge-mark" style={{ left: `${thresholdPct}%` }} />
      </div>
      <div className="hms__meta">
        capacity = <strong>{step.capacity}</strong> · size = <strong>{step.size}</strong> · порог resize ={' '}
        <strong>{threshold}</strong>
      </div>

      <div className="hms__table">
        {step.table.map((bucket, idx) => (
          <div
            key={idx}
            className={`hms__bucket${idx === step.highlightBucket ? ' hms__bucket--hot' : ''}`}
          >
            <span className="hms__idx">{idx}</span>
            <div className="hms__chain">
              {bucket.length === 0 ? (
                <span className="hms__empty">∅</span>
              ) : (
                bucket.map((entry, k) => (
                  <span
                    key={entry.key}
                    className={`hms__entry${
                      idx === step.highlightBucket && entry.key === step.newKey ? ' hms__entry--new' : ''
                    }`}
                  >
                    {k > 0 && <span className="hms__arrow">→</span>}
                    {entry.key}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="hms__note">{step.note}</p>
    </div>
  );
}
