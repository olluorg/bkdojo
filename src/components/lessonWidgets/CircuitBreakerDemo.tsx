import { useEffect, useRef, useState } from 'react';
import {
  allowsRequest,
  DEFAULT_BREAKER_CONFIG as CFG,
  initialBreaker,
  recordResult,
  recordTick,
  type BreakerState,
  type BreakerStatus,
} from '../../domain/content/widgets/circuitBreaker';

type ReqKind = 'ok' | 'fail' | 'rejected' | 'dropped';
interface LogEntry {
  id: number;
  kind: ReqKind;
}
interface InFlight {
  id: number;
  doneAt: number;
  ok: boolean;
}

const STATES: BreakerStatus[] = ['CLOSED', 'OPEN', 'HALF_OPEN'];
const STATE_RU: Record<BreakerStatus, string> = {
  CLOSED: 'CLOSED · пропускает',
  OPEN: 'OPEN · отклоняет',
  HALF_OPEN: 'HALF-OPEN · пробует',
};
const TICK_MS = 900;
const POOL = 6; // worker threads available to the caller
const HEALTHY_MS = 700; // a healthy call returns fast (frees its thread next tick)
const DOWN_MS = 3200; // a call to a dead dependency hangs until timeout, holding a thread

/**
 * Animated circuit breaker with an on/off switch. Each tick a request arrives and, if
 * let through, occupies a worker thread until it completes — fast on success, but
 * hanging until timeout when the dependency is down. WITH the breaker, enough failures
 * trip it to OPEN and further requests are rejected instantly, so threads stay free and
 * the service survives. WITHOUT it, every call to the dead dependency hangs, the thread
 * pool fills up, new requests are dropped — the classic cascade. Toggle it to feel the
 * difference. Breaker transitions are the pure machine from `circuitBreaker.ts`.
 */
export function CircuitBreakerDemo() {
  const [breaker, setBreaker] = useState<BreakerState>(initialBreaker);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [healthy, setHealthy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(true);
  const [busy, setBusy] = useState(0);
  const [rate, setRate] = useState(2); // requests generated per tick

  // Refs so the interval callback always reads fresh values without re-subscribing.
  const breakerRef = useRef(breaker);
  const healthyRef = useRef(healthy);
  const enabledRef = useRef(enabled);
  const rateRef = useRef(rate);
  const inflightRef = useRef<InFlight[]>([]);
  const nowRef = useRef(0);
  const idRef = useRef(0);
  breakerRef.current = breaker;
  healthyRef.current = healthy;
  enabledRef.current = enabled;
  rateRef.current = rate;

  const tick = () => {
    const now = (nowRef.current += TICK_MS);
    let b = breakerRef.current;
    const newLogs: LogEntry[] = [];

    // 1. Complete any in-flight calls whose time is up; feed the result to the breaker.
    const remaining: InFlight[] = [];
    for (const it of inflightRef.current) {
      if (it.doneAt <= now) {
        if (enabledRef.current) b = recordResult(b, it.ok, now, CFG);
        newLogs.push({ id: idRef.current++, kind: it.ok ? 'ok' : 'fail' });
      } else {
        remaining.push(it);
      }
    }
    inflightRef.current = remaining;

    // 2. Time-driven OPEN → HALF_OPEN (only matters while the breaker is on).
    if (enabledRef.current) b = recordTick(b, now, CFG);

    // 3. New requests arrive (the rate controls how many per tick — higher rates can
    //    out-pace the pool while calls hang on a dead dependency).
    for (let r = 0; r < rateRef.current; r++) {
      if (enabledRef.current && !allowsRequest(b)) {
        newLogs.push({ id: idRef.current++, kind: 'rejected' }); // short-circuited: no thread used
      } else if (inflightRef.current.length >= POOL) {
        newLogs.push({ id: idRef.current++, kind: 'dropped' }); // pool exhausted: overload
      } else {
        const ok = healthyRef.current;
        inflightRef.current.push({
          id: idRef.current++,
          doneAt: now + (ok ? HEALTHY_MS : DOWN_MS),
          ok,
        });
      }
    }

    breakerRef.current = b;
    setBreaker(b);
    setBusy(inflightRef.current.length);
    if (newLogs.length) setLog((l) => [...l, ...newLogs].slice(-18));
  };

  useEffect(() => {
    if (!running) return;
    const h = setInterval(tick, TICK_MS);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggleBreaker = () => {
    const init = initialBreaker();
    breakerRef.current = init;
    setBreaker(init);
    setEnabled((v) => !v);
  };

  const reset = () => {
    const init = initialBreaker();
    breakerRef.current = init;
    inflightRef.current = [];
    nowRef.current = 0;
    setBreaker(init);
    setBusy(0);
    setLog([]);
  };

  const poolFull = busy >= POOL;
  const counter = !enabled
    ? 'предохранитель выключен — все запросы идут напрямую к зависимости'
    : breaker.status === 'CLOSED'
      ? `сбоев подряд: ${breaker.failures}/${CFG.failureThreshold}`
      : breaker.status === 'HALF_OPEN'
        ? `успешных проб: ${breaker.trialSuccesses}/${CFG.halfOpenTrials}`
        : 'мгновенно отклоняет, бережёт потоки';

  return (
    <div className="cb">
      <div className="cb__controls">
        <button
          className={`btn btn--ghost btn--sm cb__dep cb__dep--${healthy ? 'up' : 'down'}`}
          onClick={() => setHealthy((v) => !v)}
        >
          {healthy ? '🟢 Зависимость жива' : '🔴 Зависимость упала'}
        </button>
        <button
          className={`btn btn--ghost btn--sm cb__sw cb__sw--${enabled ? 'on' : 'off'}`}
          onClick={toggleBreaker}
        >
          {enabled ? '🛡 Предохранитель: ВКЛ' : '⚠ Предохранитель: ВЫКЛ'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setRunning((v) => !v)}>
          {running ? '⏸ Пауза' : '▶ Старт'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={tick} disabled={running}>
          Шаг
        </button>
        <button className="btn btn--ghost btn--sm cb__reset" onClick={reset}>
          ⟲ Сброс
        </button>
      </div>

      <label className="cb__rate">
        <span>
          частота запросов: <strong>{rate}</strong> зап./тик
        </span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </label>

      {/* State machine (when on): active node highlighted, OPEN drains a cooldown bar. */}
      {enabled ? (
        <div className="cb__states">
          {STATES.map((st, i) => (
            <div key={st} className="cb__state-wrap">
              <div
                className={`cb__state cb__state--${st.toLowerCase()}${
                  breaker.status === st ? ' cb__state--active' : ''
                }`}
              >
                {STATE_RU[st]}
                {st === 'OPEN' && breaker.status === 'OPEN' && breaker.openedAt != null && (
                  <span
                    key={breaker.openedAt}
                    className="cb__cooldown"
                    style={{ animationDuration: `${CFG.cooldownMs}ms` }}
                  />
                )}
              </div>
              {i < STATES.length - 1 && <span className="cb__sep">→</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="cb__off">предохранитель отключён — защиты от каскада нет</div>
      )}
      <p className="cb__counter">{counter}</p>

      {/* Worker pool: fills up while calls hang on a dead dependency. */}
      <div className="cb__pool" aria-label="пул потоков">
        {Array.from({ length: POOL }).map((_, i) => (
          <span
            key={i}
            className={`cb__slot${i < busy ? ' cb__slot--busy' : ''}${
              poolFull ? ' cb__slot--full' : ''
            }`}
          />
        ))}
      </div>
      <p className={`cb__pool-label${poolFull ? ' cb__pool-label--full' : ''}`}>
        потоки заняты: {busy}/{POOL}
        {poolFull && ' — пул исчерпан, запросы отклоняются (каскад)'}
      </p>

      {/* Live request stream: newest chip slides in on the right. */}
      <div className="cb__stream" aria-label="поток запросов">
        {log.map((e) => (
          <span key={e.id} className={`cb__req cb__req--${e.kind}`}>
            {e.kind === 'ok' ? '✓' : e.kind === 'fail' ? '✕' : e.kind === 'rejected' ? '⊘' : '✕'}
          </span>
        ))}
      </div>
      <div className="cb__legend">
        <span><span className="cb__dot cb__dot--ok" /> успех</span>
        <span><span className="cb__dot cb__dot--fail" /> сбой (висит до таймаута)</span>
        <span><span className="cb__dot cb__dot--rejected" /> отклонён мгновенно</span>
        <span><span className="cb__dot cb__dot--dropped" /> нет потоков</span>
      </div>
    </div>
  );
}
