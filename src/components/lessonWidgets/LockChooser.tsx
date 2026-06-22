import { useMemo, useState } from 'react';
import {
  chooseLock,
  GROUP_TITLE,
  NEEDS,
  type LockChoice,
  type Need,
  type NeedDef,
} from '../../domain/content/widgets/lockChooser';

const GROUPS: NeedDef['group'][] = ['exclusive', 'read'];

/** One-line "что это" per lock, shown under the recommended name. */
const CHOICE_TAGLINE: Record<LockChoice, string> = {
  synchronized: 'встроенный монитор — выбор по умолчанию',
  ReentrantLock: 'явный Lock из java.util.concurrent.locks',
  ReentrantReadWriteLock: 'раздельные read/write замки',
  StampedLock: 'штампы + оптимистичное чтение',
};

/**
 * "Какой замок выбрать?": the learner ticks the capabilities they actually need
 * and the widget recommends the simplest lock that still covers them, climbing the
 * ladder synchronized → ReentrantLock → ReadWriteLock → StampedLock only as far as
 * the requirements force — and always spelling out the price (caveats). This makes
 * the otherwise easy-to-blur "what does each lock add, and when" stick.
 */
export function LockChooser() {
  const [on, setOn] = useState<Set<Need>>(new Set());

  const rec = useMemo(() => chooseLock(on), [on]);

  const toggle = (n: Need) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <div className="lkc">
      <div className="lkc__needs">
        {GROUPS.map((group) => (
          <fieldset key={group} className="lkc__group">
            <legend className="lkc__group-title">{GROUP_TITLE[group]}</legend>
            {NEEDS.filter((n) => n.group === group).map((n) => (
              <label key={n.id} className="lkc__need">
                <input type="checkbox" checked={on.has(n.id)} onChange={() => toggle(n.id)} />
                <span>{n.label}</span>
              </label>
            ))}
          </fieldset>
        ))}
        {on.size > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setOn(new Set())}>
            ⟲ Сброс
          </button>
        )}
      </div>

      <div className="lkc__result">
        <div className="lkc__pick">
          <span className="lkc__pick-label">Бери</span>
          <code className="lkc__pick-name">{rec.choice}</code>
        </div>
        <p className="lkc__tagline">{CHOICE_TAGLINE[rec.choice]}</p>
        <p className="lkc__reason">{rec.reason}</p>
        {rec.caveats.length > 0 && (
          <ul className="lkc__caveats">
            {rec.caveats.map((c, i) => (
              <li key={i} className="lkc__caveat">
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
