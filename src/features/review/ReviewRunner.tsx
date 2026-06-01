import { useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { buildWeakSpotSession } from '../../domain/selection/weakSpotSelector';
import { useProgress } from '../../state/ProgressContext';

export function ReviewRunner({ index, onRestart }: { index: ContentIndex; onRestart: () => void }) {
  const { progress, dispatch } = useProgress();
  const [session] = useState(() =>
    buildWeakSpotSession(index, progress, { now: new Date(), size: 10 }),
  );

  return (
    <SessionRunner
      title="Слабые места"
      session={session}
      mode="daily"
      emptyMessage="Отличная работа — явных слабых мест сейчас нет. Загляни в практику или зайди позже."
      onRestart={onRestart}
      restartLabel="Обновить"
      activityKind="review"
      onComplete={() => dispatch({ type: 'recordActivity', kind: 'review' })}
    />
  );
}
