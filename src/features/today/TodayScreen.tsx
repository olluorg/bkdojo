import { useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { DOMAIN_LABELS, DOMAINS } from '../../domain/models/common';
import { buildDailyMission } from '../../domain/today/dailyMission';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor } from '../../app/router';

export function TodayScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const { all: lessons } = useLessons();
  const terms = useGlossary();

  const mission = useMemo(
    () => buildDailyMission({ progress, index, lessons, terms }),
    [progress, index, lessons, terms],
  );

  const overallPct = Math.round(mission.readiness.overall * 100);
  const [gainLo, gainHi] = mission.expectedReadinessGain;

  // The five existing sections, reached as secondary actions from the mission.
  const lessonPath = mission.focusLesson
    ? `/lessons/${mission.focusLesson.id}`
    : `/courses/${mission.focusDomain}`;
  const secondaryActions = [
    { label: 'Открыть урок', path: lessonPath },
    { label: 'Перейти к практике', path: '/practice' },
    { label: 'Повторить слабые места', path: '/review' },
    { label: 'Открыть словарь', path: '/glossary' },
    { label: 'Пройти mock interview', path: '/interview' },
  ];

  return (
    <section className="today">
      <h1 className="screen__title">Сегодня</h1>
      <p className="screen__note">Один фокус на сегодня — и понятно, зачем он.</p>

      <div className="today__goal">
        <span className="today__goal-tag">Цель</span>
        <strong>{mission.goalLabel}</strong>
      </div>

      <div className="stat-block">
        <div className="stat-block__head">
          <span>Готовность к интервью</span>
          <span className="ability-list__level">{overallPct}%</span>
        </div>
        <ProgressBar value={mission.readiness.overall} />
      </div>

      <ul className="today__readiness">
        {DOMAINS.map((domain) => (
          <li key={domain} className="today__readiness-row">
            <span className="today__readiness-name">{DOMAIN_LABELS[domain]}</span>
            <ProgressBar value={mission.readiness.byDomain[domain]} />
          </li>
        ))}
      </ul>

      <div className="today__focus">
        <span className="today__focus-tag">Фокус дня</span>
        <h2 className="today__focus-title">{mission.focusTitle}</h2>

        <div className="today__why">
          <span className="today__why-head">Почему это</span>
          <ul className="today__why-list">
            {mission.reason.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <a className="btn today__cta" href={hrefFor(mission.primaryPath)}>
          Начать тренировку
        </a>
      </div>

      <div className="today__plan">
        <h3 className="today__section-head">План на сегодня</h3>
        <ol className="today__steps">
          {mission.steps.map((step, i) => (
            <li key={`${step.kind}-${i}`} className={step.done ? 'today__step today__step--done' : 'today__step'}>
              <a className="today__step-link" href={hrefFor(step.path)}>
                <span className="today__step-num">{step.done ? '✓' : i + 1}</span>
                <span className="today__step-body">
                  <span className="today__step-title">{step.title}</span>
                  <span className="today__step-detail">{step.detail}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div className="today__effect">
        <h3 className="today__section-head">Ожидаемый эффект</h3>
        <p className="today__effect-gain">
          {DOMAIN_LABELS[mission.focusDomain]} readiness +{gainLo}–{gainHi}%
        </p>
        {mission.capability && (
          <p className="today__effect-cap">
            <span className="today__cap-state">
              {mission.capability.from} → {mission.capability.to}
            </span>
            <span className="today__cap-label">«{mission.capability.label}»</span>
          </p>
        )}
      </div>

      <div className="today__actions">
        {secondaryActions.map((action) => (
          <a key={action.label} className="btn btn--ghost today__action" href={hrefFor(action.path)}>
            {action.label}
          </a>
        ))}
      </div>
    </section>
  );
}
