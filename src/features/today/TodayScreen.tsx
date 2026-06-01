import { useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { DOMAIN_LABELS, DOMAINS } from '../../domain/models/common';
import { buildDailyMission } from '../../domain/today/dailyMission';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useStreak } from '../../hooks/useStreak';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor } from '../../app/router';

export function TodayScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const { all: lessons } = useLessons();
  const terms = useGlossary();
  const streak = useStreak();

  const mission = useMemo(
    () => buildDailyMission({ progress, index, lessons, terms }),
    [progress, index, lessons, terms],
  );

  const overallPct = Math.round(mission.readiness.overall * 100);
  const [gainLo, gainHi] = mission.expectedReadinessGain;

  // Brand-new user (no placement yet): show a welcoming intro instead of the
  // discouraging all-zero analytics.
  const isFresh = mission.reason.kind === 'fresh-start';

  // Daily goal: how much of today's plan is already ticked off — the motivating
  // "почти у цели" counter, shown inline in the plan heading.
  const doneSteps = mission.steps.filter((s) => s.done).length;
  const totalSteps = mission.steps.length;
  const allDone = totalSteps > 0 && doneSteps === totalSteps;

  if (isFresh) {
    return (
      <section className="today">
        <div className="today__welcome">
          <span className="today__welcome-mark" aria-hidden>
            🥋
          </span>
          <h1 className="screen__title">Добро пожаловать в bkdojo</h1>
          <p className="today__welcome-lead">
            Ежедневный тренажёр для подготовки к backend-собеседованиям. Цель — {mission.goalLabel}.
          </p>
          <ul className="today__welcome-points">
            <li>Короткая диагностика подберёт сложность под тебя — без AI, за 5 минут.</li>
            <li>Каждый день — один понятный фокус и план, а не бесконечная лента.</li>
            <li>Открытые ответы оценивает AI, как на реальном интервью.</li>
          </ul>
          <a className="btn today__cta" href={hrefFor(mission.primaryPath)}>
            Пройти диагностику
          </a>
        </div>

        <div className="today__plan">
          <h3 className="today__section-head">С чего начать</h3>
          <ol className="today__steps">
            {mission.steps.map((step, i) => (
              <li key={`${step.kind}-${i}`} className="today__step">
                <a className="today__step-link" href={hrefFor(step.path)}>
                  <span className="today__step-num">{i + 1}</span>
                  <span className="today__step-body">
                    <span className="today__step-title">{step.title}</span>
                    <span className="today__step-detail">{step.detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="today">
      <h1 className="screen__title">Сегодня</h1>
      <p className="screen__note">Цель — {mission.goalLabel}. Один фокус на сегодня.</p>

      {streak.state === 'at-risk' && (
        <div className="today__nudge">
          <span aria-hidden>🔥</span> Серия {streak.days} дн. под угрозой — заверши сегодня хотя бы
          один шаг, чтобы её сохранить.
        </div>
      )}

      {/* The hero: the one focus + its CTA. Everything else is secondary. */}
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
          {mission.primaryLabel}
        </a>
      </div>

      {/* The actionable checklist with an inline daily-goal counter. The five
          steps already cover every section, so there's no separate quick-links
          row — it would just duplicate these. */}
      <div className="today__plan">
        <div className="today__plan-head">
          <h3 className="today__section-head">План на сегодня</h3>
          <span className={allDone ? 'today__plan-count today__plan-count--done' : 'today__plan-count'}>
            {allDone ? '🎯 готово' : `${doneSteps}/${totalSteps}`}
          </span>
        </div>
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

      <details className="today__details">
        <summary className="today__details-summary">Готовность к интервью · {overallPct}%</summary>

        <ul className="today__readiness">
          {DOMAINS.map((domain) => (
            <li key={domain} className="today__readiness-row">
              <span className="today__readiness-name">{DOMAIN_LABELS[domain]}</span>
              <ProgressBar value={mission.readiness.byDomain[domain]} />
            </li>
          ))}
        </ul>

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
      </details>
    </section>
  );
}
