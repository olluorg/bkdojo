import { useState } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { DOMAIN_LABELS, DOMAINS, type Domain } from '../../domain/models/common';
import { domainMastery } from '../../domain/progress/mastery';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useProgress } from '../../state/ProgressContext';
import { MockInterviewRunner } from './MockInterviewRunner';

export function InterviewScreen() {
  const index = useContentIndex();
  const { progress } = useProgress();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [runKey, setRunKey] = useState(0);

  if (domain) {
    return (
      <MockInterviewRunner
        key={runKey}
        index={index}
        domain={domain}
        title={`Мок-интервью: ${DOMAIN_LABELS[domain]}`}
        onExit={() => setDomain(null)}
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
