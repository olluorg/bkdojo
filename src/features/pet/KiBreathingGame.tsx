import { useEffect, useRef, useState } from 'react';
import { PetAvatar } from '../../components/PetAvatar';
import type { PetStage } from '../../domain/models/pet';
import { breathAt, inSync } from '../../domain/pet/kiBreathing';

interface Props {
  stage: PetStage;
  onDone: (sync: number) => void;
  onCancel: () => void;
}

const MIN_SIZE = 120;
const MAX_SIZE = 260;

export function KiBreathingGame({ stage, onDone, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [holding, setHolding] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sync, setSync] = useState(0);

  const elapsedRef = useRef(0);
  const holdingRef = useRef(false);
  const syncRef = useRef(0);
  const totalRef = useRef(0);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (lastRef.current === null) lastRef.current = t;
      const dt = Math.min(t - lastRef.current, 100); // clamp background jumps
      lastRef.current = t;
      elapsedRef.current += dt;

      const frame = breathAt(elapsedRef.current);
      if (frame.phase === 'done') {
        setSync(totalRef.current > 0 ? syncRef.current / totalRef.current : 0);
        setFinished(true);
        return;
      }
      totalRef.current += dt;
      if (inSync(frame.phase, holdingRef.current)) syncRef.current += dt;
      setElapsed(elapsedRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function hold(value: boolean) {
    setHolding(value);
    holdingRef.current = value;
  }

  if (finished) {
    return (
      <section>
        <h1 className="screen__title">Ки восстановлена</h1>
        <p className="screen__note">Синхронизация дыхания: {Math.round(sync * 100)}%</p>
        <button className="btn" onClick={() => onDone(sync)}>
          Готово
        </button>
      </section>
    );
  }

  const frame = breathAt(elapsed);
  const size = MIN_SIZE + frame.scale * (MAX_SIZE - MIN_SIZE);
  const matched = inSync(frame.phase, holding);

  return (
    <section>
      <button className="link-back" onClick={onCancel}>
        ← Выйти
      </button>
      <h1 className="screen__title">Дыхание ки</h1>
      <p className="screen__note">Удерживай на вдохе, отпусти на выдохе. Дыши вместе с питомцем.</p>

      <div
        className="ki-stage"
        onPointerDown={() => hold(true)}
        onPointerUp={() => hold(false)}
        onPointerLeave={() => hold(false)}
        onPointerCancel={() => hold(false)}
      >
        <div
          className={matched ? 'ki-ring ki-ring--sync' : 'ki-ring'}
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          <PetAvatar stage={stage} mood={matched ? 'happy' : 'content'} size={96} />
        </div>
      </div>

      <p className="ki-phase">{frame.phase === 'inhale' ? 'Вдох…' : 'Выдох…'}</p>
      <p className="screen__note">Цикл {frame.cycle + 1} из 4</p>
    </section>
  );
}
