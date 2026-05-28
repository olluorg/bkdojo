import { useState } from 'react';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useProgress } from '../../state/ProgressContext';
import { PracticeRunner } from './PracticeRunner';

export function PracticeScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const [sessionKey, setSessionKey] = useState(0);

  if (!progress.placementDone) {
    return (
      <section>
        <h1 className="screen__title">Daily practice</h1>
        <p className="screen__note">
          Сначала пройди определение уровня во вкладке «Уровень» — так сложность подберётся под тебя.
        </p>
      </section>
    );
  }

  return (
    <PracticeRunner
      key={sessionKey}
      index={index}
      onRestart={() => setSessionKey((k) => k + 1)}
    />
  );
}
