import { useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import type { ContentIndex } from '../../domain/content/contentIndex';
import type { Domain } from '../../domain/models/common';
import { DOMAIN_LABELS } from '../../domain/models/common';
import { correctiveNeeds } from '../../domain/lesson/correctiveRound';
import { resolveCorrectiveItems } from '../../domain/lesson/resolveCorrective';
import { correctlyAnsweredIds } from '../../domain/progress/lessonStatus';
import { buildFocusedWeakSpotSession, buildWeakSpotSession } from '../../domain/selection/weakSpotSelector';
import { useProgress } from '../../state/ProgressContext';

export function ReviewRunner({
  index,
  onRestart,
  focusDomain,
}: {
  index: ContentIndex;
  onRestart: () => void;
  focusDomain?: Domain;
}) {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';
  const [session] = useState(() =>
    focusDomain
      ? buildFocusedWeakSpotSession(index, progress, { now: new Date(), size: 10, domain: focusDomain })
      : buildWeakSpotSession(index, progress, { now: new Date(), size: 10 }),
  );

  return (
    <SessionRunner
      title={focusDomain ? `Слабые места: ${DOMAIN_LABELS[focusDomain]}` : 'Слабые места'}
      session={session}
      mode="daily"
      emptyMessage="Отличная работа — явных слабых мест сейчас нет. Загляни в практику или зайди позже."
      onRestart={onRestart}
      restartLabel="Обновить"
      activityKind="review"
      buildCorrectiveRound={(outcomes) =>
        resolveCorrectiveItems(correctiveNeeds(outcomes), {
          index,
          method,
          excludeIds: correctlyAnsweredIds(progress),
        })
      }
      onComplete={() => dispatch({ type: 'recordActivity', kind: 'review' })}
    />
  );
}
