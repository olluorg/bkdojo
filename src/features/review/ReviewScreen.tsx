import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { WeakConceptsPanel } from '../../components/WeakConceptsPanel';
import { useConceptLessons } from '../../hooks/useConceptLessons';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useProgress } from '../../state/ProgressContext';
import { ReviewRunner } from './ReviewRunner';

export function ReviewScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const conceptLessons = useConceptLessons();
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

  return (
    <>
      <WeakConceptsPanel
        progress={progress}
        conceptTitles={index.conceptTitles}
        conceptLessons={conceptLessons}
      />
      <ReviewRunner key={sessionKey} index={index} onRestart={() => setSessionKey((k) => k + 1)} />
    </>
  );
}
