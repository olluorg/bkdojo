import { useState } from 'react';
import { navigate, segments, useHashPath } from '../../app/router';
import { ProgressBar } from '../../components/ProgressBar';
import { DOMAIN_LABELS, DOMAINS, type Domain } from '../../domain/models/common';
import { domainMastery } from '../../domain/progress/mastery';
import { buildDailyMission } from '../../domain/today/dailyMission';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { MockInterviewRunner } from './MockInterviewRunner';

export function InterviewScreen() {
  const index = useContentIndex();
  const { progress } = useProgress();
  const { all: lessons } = useLessons();
  const terms = useGlossary();
  const path = useHashPath();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [runKey, setRunKey] = useState(0);
  const routeMode = segments(path)[1];
  const mission = routeMode === 'today'
    ? buildDailyMission({ progress, index, lessons, terms })
    : undefined;
  const activeDomain = mission?.focusDomain ?? domain;

  if (activeDomain) {
    return (
      <MockInterviewRunner
        key={`${runKey}:${routeMode ?? 'free'}:${activeDomain}`}
        index={index}
        domain={activeDomain}
        title={
          mission
            ? `Мини-интервью: ${DOMAIN_LABELS[activeDomain]}`
            : `Мок-интервью: ${DOMAIN_LABELS[activeDomain]}`
        }
        onExit={() => {
          setDomain(null);
          if (mission) navigate('/interview');
        }}
        onRestart={() => setRunKey((k) => k + 1)}
      />
    );
  }

  return (
    <section>
      <h1 className="screen__title">Мок-интервью</h1>
      <p className="screen__note">
        Несколько вопросов разного типа по теме — без подсказок. Разбор и оценка уровня в конце.
      </p>

      <div className="course-list">
        {DOMAINS.map((d) => (
          <button
            key={d}
            className="course-card"
            onClick={() => {
              setRunKey((k) => k + 1);
              setDomain(d);
            }}
          >
            <div className="course-card__head">
              <span className="course-card__title">{DOMAIN_LABELS[d]}</span>
              <span className="course-card__count">освоено</span>
            </div>
            <ProgressBar value={domainMastery(progress, index, d)} />
          </button>
        ))}
      </div>
    </section>
  );
}
