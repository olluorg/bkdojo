import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { WeakConceptsPanel } from '../../components/WeakConceptsPanel';
import { segments, useHashPath } from '../../app/router';
import { buildDailyMission } from '../../domain/today/dailyMission';
import { useConceptLessons } from '../../hooks/useConceptLessons';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { ReviewRunner } from './ReviewRunner';

export function ReviewScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const conceptLessons = useConceptLessons();
  const { all: lessons } = useLessons();
  const terms = useGlossary();
  const path = useHashPath();
  const [sessionKey, setSessionKey] = useState(0);

  if (!progress.placementDone) {
    return (
      <section>
        <h1 className="screen__title">Слабые места</h1>
        <EmptyState
          icon="🎯"
          title="Здесь появятся темы на повторение"
          description="Сначала пройди определение уровня и немного попрактикуйся — система найдёт, что стоит закрепить, и вернёт это сюда."
          actionLabel="Пройти диагностику"
          actionHref="/level"
        />
      </section>
    );
  }

  const mode = segments(path)[1];
  const mission = mode === 'today'
    ? buildDailyMission({ progress, index, lessons, terms })
    : undefined;
  const runnerKey = `${sessionKey}:${mode ?? 'free'}:${mission?.focusDomain ?? 'all'}`;

  return (
    <>
      <WeakConceptsPanel
        progress={progress}
        conceptTitles={index.conceptTitles}
        conceptLessons={conceptLessons}
      />
      <ReviewRunner
        key={runnerKey}
        index={index}
        focusDomain={mission?.focusDomain}
        onRestart={() => setSessionKey((k) => k + 1)}
      />
    </>
  );
}
