import { useState } from 'react';
import { segments, useHashPath } from '../../app/router';
import { buildDailyMission } from '../../domain/today/dailyMission';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { PracticeRunner } from './PracticeRunner';

export function PracticeScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const { all: lessons, byId } = useLessons();
  const terms = useGlossary();
  const path = useHashPath();
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

  const mode = segments(path)[1];
  const mission = mode === 'today'
    ? buildDailyMission({ progress, index, lessons, terms })
    : undefined;
  const focusLesson = mission?.focusLesson ? byId.get(mission.focusLesson.id) : undefined;
  const focus = mission
    ? { domain: mission.focusDomain, lesson: focusLesson }
    : undefined;
  const runnerKey = `${sessionKey}:${mode ?? 'free'}:${focusLesson?.id ?? focus?.domain ?? 'all'}`;

  return (
    <PracticeRunner
      key={runnerKey}
      index={index}
      focus={focus}
      onRestart={() => setSessionKey((k) => k + 1)}
    />
  );
}
