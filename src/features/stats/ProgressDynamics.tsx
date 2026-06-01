import { useMemo } from 'react';
import { Bars, Sparkline } from '../../components/Sparkline';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { DOMAIN_LABELS } from '../../domain/models/common';
import type { UserProgress } from '../../domain/models/progress';
import { activityByDay, dailyAccuracy } from '../../domain/progress/analytics';
import {
  allDomainForecasts,
  interviewReadiness,
  streakRisk,
  type Trend,
} from '../../domain/progress/predictions';
import { hrefFor } from '../../app/router';

const TREND_LABEL: Record<Trend, string> = { up: '↗ растёт', flat: '→ ровно', down: '↘ падает' };

function etaText(days: number | undefined): string {
  if (days === undefined) return 'нужно больше практики для прогноза';
  if (days === 0) return 'цель достигнута';
  if (days <= 1) return '≈ 1 день при текущем темпе';
  return `≈ ${days} дн. при текущем темпе`;
}

export function ProgressDynamics({
  progress,
  index,
}: {
  progress: UserProgress;
  index: ContentIndex;
}) {
  const now = useMemo(() => new Date(), []);
  const accuracy = useMemo(() => dailyAccuracy(progress.history ?? [], 14, now), [progress, now]);
  const activity = useMemo(() => activityByDay(progress, 14, now), [progress, now]);
  const readiness = useMemo(() => interviewReadiness(progress, index, now), [progress, index, now]);
  const risk = useMemo(() => streakRisk(progress, now), [progress, now]);
  const forecasts = useMemo(() => allDomainForecasts(progress, index, now), [progress, index, now]);

  const hasAnswers = (progress.history ?? []).length > 0;
  const totalActivity = activity.reduce(
    (s, d) => s + d.answers + d.sessions + d.lessons + d.terms,
    0,
  );

  return (
    <>
      <div className="stat-block">
        <div className="stat-block__head">
          <span>Динамика за 14 дней</span>
          <a className="stat-block__link" href={hrefFor('/history')}>
            Вся история →
          </a>
        </div>

        {hasAnswers ? (
          <>
            <div className="dynamics__chart">
              <span className="dynamics__caption">Точность ответов по дням</span>
              <Sparkline values={accuracy.map((d) => d.accuracy)} />
            </div>
            <div className="dynamics__chart">
              <span className="dynamics__caption">
                Активность по дням {totalActivity > 0 && `· ${totalActivity} действий`}
              </span>
              <Bars values={activity.map((d) => d.answers + d.sessions + d.lessons + d.terms)} />
            </div>
          </>
        ) : (
          <p className="screen__note">Ответь на несколько вопросов — и здесь появится график динамики.</p>
        )}
      </div>

      <div className="stat-block">
        <div className="stat-block__head">Прогноз</div>

        <div className="forecast">
          <div className="forecast__row">
            <span className="forecast__label">Готовность к собеседованию</span>
            <span className="forecast__value">
              {Math.round(readiness.score * 100)}% · {TREND_LABEL[readiness.trend]}
            </span>
          </div>
          <div className="forecast__hint">
            {readiness.ready ? 'Ты в хорошей форме!' : etaText(readiness.etaDays)}
          </div>

          <div className="forecast__row">
            <span className="forecast__label">Серия 🔥</span>
            <span className="forecast__value">
              {risk.level === 'safe'
                ? `${risk.days} дн. — в безопасности`
                : risk.level === 'at-risk'
                  ? `${risk.days} дн. — под угрозой`
                  : 'серия прервана'}
            </span>
          </div>
          {risk.willBreak && (
            <div className="forecast__hint">Позанимайся сегодня, чтобы не потерять серию.</div>
          )}
        </div>

        <ul className="forecast__domains">
          {forecasts.map((f) => (
            <li key={f.domain} className="forecast__domain">
              <span className="forecast__domain-name">{DOMAIN_LABELS[f.domain]}</span>
              <span className="forecast__domain-eta">
                {f.mastery >= 0.8 ? 'освоено' : etaText(f.etaDays)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
