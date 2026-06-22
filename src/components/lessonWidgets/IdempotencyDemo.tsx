import { useEffect, useRef, useState } from 'react';
import {
  deliver,
  initialDedup,
  type DedupState,
  type DeliveryOutcome,
} from '../../domain/content/widgets/idempotency';

interface LogLine {
  id: number;
  key: string;
  outcome: DeliveryOutcome;
}

const OUTCOME_RU: Record<DeliveryOutcome, string> = {
  applied: 'новый ключ → списано',
  'duplicate-skipped': 'дубликат ключа → пропущено',
  'applied-no-key': 'без ключа → списано ПОВТОРНО',
};

const FLIGHT_MS = 750;
/** Each order costs this much; the wallet starts here. Money makes the bug tangible. */
const AMOUNT = 100;
const START_BALANCE = 1000;

/**
 * Animated idempotency demo. Send a payment, then redeliver the *same* request (an
 * at-least-once duplicate / client retry): a packet flies from client to server. With
 * the idempotency key the server recognises the seen key and skips the second charge;
 * without it the wallet is debited twice — shown as a dropping balance and an explicit
 * "двойное списание" overcharge. The dedup decision is the pure `deliver()`.
 */
export function IdempotencyDemo() {
  const [state, setState] = useState<DedupState>(initialDedup);
  const [useKey, setUseKey] = useState(true);
  const [log, setLog] = useState<LogLine[]>([]);
  const [orderNo, setOrderNo] = useState(1);
  const [orders, setOrders] = useState(0); // distinct orders actually placed
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [flight, setFlight] = useState<{ key: string; dup: boolean } | null>(null);
  const [bump, setBump] = useState(false); // pulse the balance when a charge lands
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), []);

  const charged = state.charges * AMOUNT; // money actually taken
  const expected = orders * AMOUNT; // money that SHOULD have been taken
  const overcharge = charged - expected; // > 0 means a duplicate slipped through
  const balance = START_BALANCE - charged;

  const send = (key: string, dup: boolean) => {
    if (flight) return; // one packet in flight at a time
    setFlight({ key, dup });
    timerRef.current = setTimeout(() => {
      const res = deliver(state, key, useKey);
      setState(res.state);
      setLog((l) => [...l.slice(-5), { id: idRef.current++, key, outcome: res.outcome }]);
      if (res.applied) {
        setBump(true);
        setTimeout(() => setBump(false), 450);
      }
      setFlight(null);
    }, FLIGHT_MS);
  };

  const sendNew = () => {
    const key = `order-${orderNo}`;
    setOrderNo((n) => n + 1);
    setOrders((o) => o + 1);
    setLastKey(key);
    send(key, false);
  };

  const redeliver = () => {
    if (lastKey) send(lastKey, true);
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(initialDedup());
    setLog([]);
    setOrderNo(1);
    setOrders(0);
    setLastKey(null);
    setFlight(null);
    setBump(false);
  };

  return (
    <div className="idm">
      <label className="idm__toggle">
        <input type="checkbox" checked={useKey} onChange={(e) => setUseKey(e.target.checked)} />
        <span>Idempotency-key {useKey ? 'включён' : 'выключен'}</span>
      </label>

      {/* Client → wire → server. A packet animates across the wire on each send. */}
      <div className="idm__lane">
        <div className="idm__node idm__node--client">клиент</div>
        <div className="idm__wire">
          {flight && (
            <span
              key={`${flight.key}-${idRef.current}`}
              className={`idm__packet${flight.dup ? ' idm__packet--dup' : ''}`}
              style={{ animationDuration: `${FLIGHT_MS}ms` }}
            >
              {flight.key}
              {flight.dup && <small> (retry)</small>}
            </span>
          )}
        </div>
        <div className="idm__node idm__node--server">сервер</div>
      </div>

      <div className="idm__controls">
        <button className="btn btn--sm" onClick={sendNew} disabled={!!flight}>
          + Новый платёж
        </button>
        <button className="btn btn--ghost btn--sm" onClick={redeliver} disabled={!!flight || !lastKey}>
          ↻ Повторная доставка
        </button>
        <button className="btn btn--ghost btn--sm idm__reset" onClick={reset}>
          ⟲ Сброс
        </button>
      </div>

      {/* Wallet: balance drops by AMOUNT per charge; a duplicate makes it drop twice. */}
      <div className={`idm__wallet${overcharge > 0 ? ' idm__wallet--bad' : ''}`}>
        <div className="idm__balance">
          <span className="idm__balance-label">Баланс клиента</span>
          <strong className={`idm__balance-val${bump ? ' idm__balance-val--bump' : ''}`}>
            {balance} ₽
          </strong>
        </div>
        <div className="idm__meta">
          <span>заказов: <strong>{orders}</strong> × {AMOUNT} ₽ = {expected} ₽</span>
          <span>фактически списано: <strong>{charged} ₽</strong></span>
        </div>
        {overcharge > 0 && (
          <div className="idm__overcharge">
            ⚠ Двойное списание: лишние <strong>{overcharge} ₽</strong> ({state.charges} списаний на{' '}
            {orders} заказ{orders === 1 ? '' : 'а'})
          </div>
        )}
      </div>

      {/* Server's processed-keys table (only meaningful with the key on). */}
      <div className="idm__keys">
        <span className="idm__keys-label">processed keys:</span>
        {state.processedKeys.length === 0 ? (
          <span className="idm__keys-empty">∅</span>
        ) : (
          state.processedKeys.map((k) => (
            <span key={k} className="idm__keytag">
              {k}
            </span>
          ))
        )}
      </div>

      <ul className="idm__log">
        {log.map((e) => (
          <li key={e.id} className={`idm__logline idm__logline--${e.outcome}`}>
            <code>{e.key}</code> — {OUTCOME_RU[e.outcome]}
          </li>
        ))}
      </ul>
    </div>
  );
}
