import { useState } from 'react';
import { DEFAULT_CAPACITY, simulateGrowth } from '../../domain/content/widgets/arrayListGrowth';

const PRESETS = [10, 100, 10_000, 1_000_000];

/**
 * Sandbox for amortised O(1): choose how many elements get added and watch how
 * rarely the backing array actually grows. The point the numbers make is that the
 * copy work per add stays under a small constant however far the slider goes —
 * and drops to zero once the capacity is given up front.
 */
export function ArrayListGrowthDemo() {
  const [adds, setAdds] = useState(100);
  const [presized, setPresized] = useState(false);

  const result = simulateGrowth(adds, presized ? adds : 0);
  const shown = result.events.slice(0, 12);
  const hidden = result.events.length - shown.length;

  return (
    <div className="alg">
      <div className="alg__inputs">
        <label className="alg__field">
          <span>Добавлено элементов</span>
          <input
            type="number"
            min={0}
            value={adds}
            onChange={(e) => setAdds(Math.max(0, Math.min(10_000_000, Number(e.target.value) || 0)))}
            className="alg__num"
          />
        </label>
        <div className="alg__presets">
          {PRESETS.map((n) => (
            <button
              key={n}
              className={`alg__preset${adds === n ? ' alg__preset--on' : ''}`}
              onClick={() => setAdds(n)}
            >
              {n.toLocaleString('ru-RU')}
            </button>
          ))}
        </div>
      </div>

      <label className="alg__toggle">
        <input type="checkbox" checked={presized} onChange={(e) => setPresized(e.target.checked)} />
        <span>
          задать ёмкость заранее: <code>new ArrayList&lt;&gt;({adds.toLocaleString('ru-RU')})</code>
        </span>
      </label>

      <div className="alg__stats">
        <div className="alg__stat">
          <b>{result.events.length}</b>
          <small>расширений</small>
        </div>
        <div className="alg__stat">
          <b>{result.totalCopied.toLocaleString('ru-RU')}</b>
          <small>копирований всего</small>
        </div>
        <div className="alg__stat alg__stat--key">
          <b>{result.copiesPerAdd.toFixed(2)}</b>
          <small>копирований на один add</small>
        </div>
        <div className="alg__stat">
          <b>{result.finalCapacity.toLocaleString('ru-RU')}</b>
          <small>итоговая ёмкость</small>
        </div>
      </div>

      {result.events.length > 0 ? (
        <>
          <div className="alg__seq">
            {shown.map((e) => (
              <span key={e.atSize} className="alg__cap" title={`скопировано ${e.copied}`}>
                {e.to.toLocaleString('ru-RU')}
              </span>
            ))}
            {hidden > 0 && <span className="alg__more">…ещё {hidden}</span>}
          </div>
          <p className="alg__why">
            Ёмкость растёт в полтора раза: {DEFAULT_CAPACITY} → 15 → 22 → 33 … Поэтому на{' '}
            {adds.toLocaleString('ru-RU')} добавлений приходится всего {result.events.length}{' '}
            перекопирований, и в среднем на один add — {result.copiesPerAdd.toFixed(2)} копирования.
            Это и есть амортизированная O(1): отдельная вставка бывает дорогой, но их доля падает с
            ростом массива. Незанятых ячеек сейчас {result.slack.toLocaleString('ru-RU')}.
          </p>
        </>
      ) : (
        <p className="alg__why">
          Массив выделен сразу нужного размера в конструкторе — ни одного расширения и ни одного
          копирования. Если размер известен заранее, это бесплатная оптимизация.
        </p>
      )}
    </div>
  );
}
