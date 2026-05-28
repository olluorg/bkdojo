import { useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { buildDailyPlan } from '../../domain/selection/dailyPlan';
import { useProgress } from '../../state/ProgressContext';

export function PracticeRunner({ index, onRestart }: { index: ContentIndex; onRestart: () => void }) {
  const { progress, dispatch } = useProgress();
  // Mixes due reviews + fresh adaptive questions into one daily feed.
  const [session] = useState(() => buildDailyPlan(index, progress, { size: 8 }));

  return (
    <SessionRunner
      title="Daily practice"
      session={session}
      mode="daily"
      emptyMessage="Новые вопросы закончились. Загляни в «Слабые места» или начни заново позже."
      onRestart={onRestart}
      restartLabel="Новая сессия"
      onComplete={() => dispatch({ type: 'recordActivity', kind: 'practice' })}
    />
  );
}
