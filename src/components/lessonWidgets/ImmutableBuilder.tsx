import { useMemo, useState } from 'react';
import {
  evalImmutability,
  GUARDS,
  LOCK_HINT,
  LOCK_TITLE,
  type Guard,
  type Lock,
} from '../../domain/content/widgets/immutabilityRecipe';

const LOCK_ORDER: Lock[] = ['assign', 'access', 'reference'];

/** One generated source line, flagged when the current toggles make it leaky. */
interface CodeLine {
  text: string;
  risk?: boolean;
}

/** Renders the `Period` class as it currently stands for the chosen recipe steps. */
function buildCode(on: Set<Guard>): CodeLine[] {
  const has = (g: Guard) => on.has(g);
  const lines: CodeLine[] = [
    { text: `${has('finalClass') ? 'final ' : ''}class Period {`, risk: !has('finalClass') },
    {
      text: `    ${has('privateFields') ? 'private ' : ''}${has('finalFields') ? 'final ' : ''}List<Event> events;`,
      risk: !has('privateFields') || !has('finalFields'),
    },
    { text: '' },
    { text: '    Period(List<Event> events) {' },
    {
      text: has('copyIn')
        ? '        this.events = new ArrayList<>(events);'
        : '        this.events = events; // ← чужая ссылка',
      risk: !has('copyIn'),
    },
    { text: '    }' },
    { text: '' },
    { text: '    List<Event> events() {' },
    {
      text: has('copyOut')
        ? '        return Collections.unmodifiableList(events);'
        : '        return events; // ← живая ссылка',
      risk: !has('copyOut'),
    },
    { text: '    }' },
  ];
  if (!has('noSetters')) {
    lines.push(
      { text: '' },
      { text: '    void setEvents(List<Event> es) { this.events = es; } // ← мутатор', risk: true },
    );
  }
  lines.push({ text: '}' });
  return lines;
}

/**
 * "Собери immutable-класс": the learner checks off the recipe steps grouped into
 * three locks, watches the generated `Period` class change, and sees every attack
 * that is still open close one by one until the verdict flips to «неизменяемый».
 * Forgetting a step (especially a defensive copy) makes its concrete attack appear,
 * which is exactly the recipe point the lesson wants to make stick.
 */
export function ImmutableBuilder() {
  const [on, setOn] = useState<Set<Guard>>(new Set());

  const verdict = useMemo(() => evalImmutability(on), [on]);
  const code = useMemo(() => buildCode(on), [on]);

  const toggle = (g: Guard) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const allOn = on.size === GUARDS.length;

  return (
    <div className="imb">
      <div className="imb__cols">
        {/* Recipe checklist, grouped by the three locks. */}
        <div className="imb__recipe">
          {LOCK_ORDER.map((lock) => (
            <fieldset key={lock} className="imb__lock">
              <legend className="imb__lock-title">{LOCK_TITLE[lock]}</legend>
              <p className="imb__lock-hint">{LOCK_HINT[lock]}</p>
              {GUARDS.filter((g) => g.lock === lock).map((g) => (
                <label key={g.id} className="imb__step">
                  <input type="checkbox" checked={on.has(g.id)} onChange={() => toggle(g.id)} />
                  <span>{g.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="imb__actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setOn(new Set(GUARDS.map((g) => g.id)))}
              disabled={allOn}
            >
              ✓ Применить весь рецепт
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setOn(new Set())}
              disabled={on.size === 0}
            >
              ⟲ Сброс
            </button>
          </div>
        </div>

        {/* Live source of the class under construction. */}
        <pre className="imb__code">
          {code.map((line, i) => (
            <span key={i} className={line.risk ? 'imb__line imb__line--risk' : 'imb__line'}>
              {line.text || ' '}
              {'\n'}
            </span>
          ))}
        </pre>
      </div>

      {/* Verdict + every attack still open. */}
      {verdict.immutable ? (
        <div className="imb__verdict imb__verdict--ok">
          🔒 Неизменяемый. Все три замка закрыты — менять состояние снаружи нечем.
        </div>
      ) : (
        <div className="imb__verdict imb__verdict--bad">
          ⚠ Не неизменяемый: открыто дыр — {verdict.holes.length}. Состояние можно изменить после
          создания.
        </div>
      )}

      {verdict.holes.length > 0 && (
        <ul className="imb__holes">
          {verdict.holes.map((h) => (
            <li key={h.guard} className="imb__hole">
              <code className="imb__attack">{h.attack}</code>
              <span className="imb__leak">{h.leak}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
