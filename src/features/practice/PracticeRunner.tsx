import { useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import type { ContentIndex } from '../../domain/content/contentIndex';
import type { Domain } from '../../domain/models/common';
import { DOMAIN_LABELS } from '../../domain/models/common';
import type { Lesson } from '../../domain/models/lesson';
import { correctiveNeeds } from '../../domain/lesson/correctiveRound';
import { resolveCorrectiveItems } from '../../domain/lesson/resolveCorrective';
import { correctlyAnsweredIds } from '../../domain/progress/lessonStatus';
import { buildDailyPlan, buildFocusedDailyPlan } from '../../domain/selection/dailyPlan';
import { useProgress } from '../../state/ProgressContext';

interface PracticeFocus {
  domain: Domain;
  lesson?: Lesson;
}

export function PracticeRunner({
  index,
  onRestart,
  focus,
}: {
  index: ContentIndex;
  onRestart: () => void;
  focus?: PracticeFocus;
}) {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';
  const [session] = useState(() =>
    focus
      ? buildFocusedDailyPlan(index, progress, {
          size: 8,
          domain: focus.domain,
          lesson: focus.lesson,
        })
      : buildDailyPlan(index, progress, { size: 8 }),
  );

  const title = focus
    ? `Практика: ${focus.lesson?.title ?? DOMAIN_LABELS[focus.domain]}`
    : 'Daily practice';

  return (
    <SessionRunner
      title={title}
      session={session}
      mode="daily"
      emptyMessage={
        focus
          ? 'По фокусу дня сейчас нет новых вопросов. Загляни в «Слабые места» или продолжи свободную практику.'
          : 'Новые вопросы закончились. Загляни в «Слабые места» или начни заново позже.'
      }
      onRestart={onRestart}
      restartLabel="Новая сессия"
      activityKind="practice"
      buildCorrectiveRound={(outcomes) =>
        resolveCorrectiveItems(correctiveNeeds(outcomes), {
          index,
          method,
          excludeIds: correctlyAnsweredIds(progress),
        })
      }
      onComplete={() => dispatch({ type: 'recordActivity', kind: 'practice' })}
    />
  );
}
