import { useState } from 'react';
import { evalIntegerEquality, INTEGER_CACHE_LOW } from '../../domain/content/widgets/integerCache';

/**
 * Sandbox for the Integer cache trap: type two values and watch `==` vs `equals`
 * flip as they cross the cache boundary, and as the AutoBoxCacheMax slider moves.
 * The heap diagram makes the core idea visible — `==` is reference identity, so it
 * is true only when both variables point at the *same* object (a shared cache entry).
 */
export function IntegerCacheDemo() {
  const [a, setA] = useState(100);
  const [b, setB] = useState(100);
  const [cacheMax, setCacheMax] = useState(127);

  const { aCached, bCached, refEqual, valueEqual } = evalIntegerEquality(a, b, cacheMax);

  // Scale the number line to fit both values and the whole cache window.
  const lo = Math.min(INTEGER_CACHE_LOW, a, b);
  const hi = Math.max(cacheMax, a, b);
  const span = hi - lo || 1;
  const pct = (x: number) => ((x - lo) / span) * 100;

  return (
    <div className="ic">
      <div className="ic__inputs">
        <label className="ic__field">
          <span>Integer a =</span>
          <input
            type="number"
            value={a}
            onChange={(e) => setA(Number(e.target.value) || 0)}
            className="ic__num"
          />
        </label>
        <label className="ic__field">
          <span>Integer b =</span>
          <input
            type="number"
            value={b}
            onChange={(e) => setB(Number(e.target.value) || 0)}
            className="ic__num"
          />
        </label>
      </div>

      <label className="ic__slider">
        <span>
          AutoBoxCacheMax = <strong>{cacheMax}</strong>
        </span>
        <input
          type="range"
          min={127}
          max={1000}
          step={1}
          value={cacheMax}
          onChange={(e) => setCacheMax(Number(e.target.value))}
        />
      </label>

      {/* Heap diagram: which object(s) the two variables reference. */}
      <HeapDiagram a={a} b={b} aCached={aCached} bCached={bCached} refEqual={refEqual} />

      <div className="ic__line" aria-hidden>
        <div
          className="ic__cache"
          style={{ left: `${pct(INTEGER_CACHE_LOW)}%`, width: `${pct(cacheMax) - pct(INTEGER_CACHE_LOW)}%` }}
        />
        <span className="ic__marker ic__marker--a" style={{ left: `${pct(a)}%` }} data-label={`a=${a}`} />
        <span className="ic__marker ic__marker--b" style={{ left: `${pct(b)}%` }} data-label={`b=${b}`} />
      </div>
      <p className="ic__legend">
        Заштрихованная зона — кэш [{INTEGER_CACHE_LOW}, {cacheMax}]. a {aCached ? 'в кэше' : 'вне кэша'}, b{' '}
        {bCached ? 'в кэше' : 'вне кэша'}.
      </p>

      <pre className="ic__out">
        <span className={refEqual ? 'ic__ok' : 'ic__bad'}>
          a == b{'      '}→ {String(refEqual)}
        </span>
        {'\n'}
        <span className="ic__ok">a.equals(b) → {String(valueEqual)}</span>
      </pre>
      <p className="ic__why">
        {refEqual
          ? 'Оба значения равны и попадают в кэш → одна и та же ссылка, поэтому == тоже true.'
          : valueEqual
            ? 'Значения равны, но хотя бы одно вне кэша → разные объекты: == сравнивает ссылки и даёт false. Правильно сравнивать через equals.'
            : 'Значения разные → и ссылки, и equals дают false.'}
      </p>
    </div>
  );
}

interface DiagramProps {
  a: number;
  b: number;
  aCached: boolean;
  bCached: boolean;
  refEqual: boolean;
}

/** SVG showing the stack variables a/b and the heap object(s) they point to. */
function HeapDiagram({ a, b, aCached, bCached, refEqual }: DiagramProps) {
  const tag = (cached: boolean) => (cached ? 'из кэша' : 'new Integer');
  return (
    <svg className="ic__heap" viewBox="0 0 340 150" role="img" aria-label="Диаграмма ссылок a и b на объекты Integer">
      <defs>
        <marker id="ic-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
        </marker>
      </defs>

      <text className="ic__heap-cap" x="60" y="12">
        стек
      </text>
      <text className="ic__heap-cap" x="274" y="12">
        куча
      </text>

      {/* Stack variables */}
      <g className="ic__var ic__var--a">
        <rect x="8" y="20" width="104" height="42" rx="8" />
        <text x="60" y="46">Integer a = {a}</text>
      </g>
      <g className="ic__var ic__var--b">
        <rect x="8" y="88" width="104" height="42" rx="8" />
        <text x="60" y="114">Integer b = {b}</text>
      </g>

      {refEqual ? (
        <>
          {/* One shared object */}
          <g className="ic__obj ic__obj--shared">
            <rect x="216" y="54" width="116" height="42" rx="8" />
            <text className="ic__obj-val" x="274" y="74">
              {a}
            </text>
            <text className="ic__obj-tag" x="274" y="89">
              из кэша · 1 объект
            </text>
          </g>
          <path className="ic__ref ic__ref--a" d="M112,41 C170,41 170,75 214,75" markerEnd="url(#ic-arrow)" />
          <path className="ic__ref ic__ref--b" d="M112,109 C170,109 170,75 214,75" markerEnd="url(#ic-arrow)" />
        </>
      ) : (
        <>
          {/* Two distinct objects */}
          <g className="ic__obj">
            <rect x="216" y="20" width="116" height="42" rx="8" />
            <text className="ic__obj-val" x="274" y="40">
              {a}
            </text>
            <text className="ic__obj-tag" x="274" y="55">
              {tag(aCached)}
            </text>
          </g>
          <g className="ic__obj">
            <rect x="216" y="88" width="116" height="42" rx="8" />
            <text className="ic__obj-val" x="274" y="108">
              {b}
            </text>
            <text className="ic__obj-tag" x="274" y="123">
              {tag(bCached)}
            </text>
          </g>
          <path className="ic__ref ic__ref--a" d="M112,41 L214,41" markerEnd="url(#ic-arrow)" />
          <path className="ic__ref ic__ref--b" d="M112,109 L214,109" markerEnd="url(#ic-arrow)" />
        </>
      )}
    </svg>
  );
}
