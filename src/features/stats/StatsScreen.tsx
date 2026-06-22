import { ProgressBar } from '../../components/ProgressBar';
import { WeakConceptsPanel } from '../../components/WeakConceptsPanel';
import { levelLabel, LEVEL_LABELS } from '../../domain/ability/level';
import { DOMAIN_LABELS, DOMAINS } from '../../domain/models/common';
import { domainLearningStatus, lessonLearningStatus } from '../../domain/progress/learningStatus';
import { domainMastery, overallRank, RANK_LABELS } from '../../domain/progress/mastery';
import { countMasteredTerms } from '../../domain/progress/termProgress';
import { useConceptLessons } from '../../hooks/useConceptLessons';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useStreak } from '../../hooks/useStreak';
import { useProgress } from '../../state/ProgressContext';
import { ProgressDynamics } from './ProgressDynamics';

export function StatsScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const { all: allLessons, byDomain: lessonsByDomain } = useLessons();
  const terms = useGlossary();
  const streak = useStreak();
  const conceptLessons = useConceptLessons();

  const rank = overallRank(progress, index);
  const termsMastered = countMasteredTerms(
    progress,
    terms.map((t) => t.id),
  );
  const allLessonStatuses = allLessons.map((lesson) => lessonLearningStatus(progress, index, lesson));
  const lessonsRead = allLessonStatuses.filter((s) => s.read === 'read').length;
  const testsPassed = allLessonStatuses.filter((s) => s.test.state === 'passed').length;

  return (
    <section>
      <h1 className="screen__title">Прогресс</h1>

      <div className="rank">
        <span className={`rank__badge rank__badge--${rank.rank}`}>{RANK_LABELS[rank.rank]}</span>
        <div className="rank__meta">
          Готовность к собеседованию · 🔥 серия {streak.days} дн.
          {streak.state === 'at-risk' && ' (позанимайся сегодня!)'}
        </div>
      </div>

      <div className="stat-block">
        <div className="stat-block__head">Общий прогресс</div>
        <ProgressBar value={rank.coverage} />
      </div>

      <ProgressDynamics progress={progress} index={index} />

      <div className="stat-block">
        <div className="stat-block__head">
          <span>Словарь терминов</span>
          <span className="ability-list__level">
            {termsMastered} / {terms.length}
          </span>
        </div>
        <ProgressBar value={terms.length === 0 ? 0 : termsMastered / terms.length} />
      </div>

      <div className="stat-block">
        <div className="stat-block__head">
          <span>Уроки и тесты</span>
          <span className="ability-list__level">
            {lessonsRead} прочитано · {testsPassed} тестов
          </span>
        </div>
        <ProgressBar value={allLessons.length === 0 ? 0 : testsPassed / allLessons.length} />
      </div>

      {DOMAINS.map((domain) => {
        const skill = progress.skills[domain];
        const lessons = lessonsByDomain.get(domain) ?? [];
        const status = domainLearningStatus(progress, index, domain, lessons);
        return (
          <div key={domain} className="stat-block">
            <div className="stat-block__head">
              <span>{DOMAIN_LABELS[domain]}</span>
              <span className="ability-list__level">
                {LEVEL_LABELS[levelLabel(skill.ability)]} · {skill.ability.toFixed(1)}
              </span>
            </div>
            <ProgressBar value={domainMastery(progress, index, domain)} />
            <p className="stat-block__note">{status.summary}</p>

            {lessons.length > 0 && (
              <ul className="topic-list">
                {lessons.map((lesson) => {
                  const lessonStatus = lessonLearningStatus(progress, index, lesson);
                  return (
                    <li key={lesson.id} className="topic-row">
                      <span className="topic-row__title">
                        {lesson.title}
                        <span className="topic-row__meta">{lessonStatus.test.label}</span>
                      </span>
                      <ProgressBar value={lessonStatus.test.progress} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      <WeakConceptsPanel
        progress={progress}
        conceptTitles={index.conceptTitles}
        conceptLessons={conceptLessons}
      />
    </section>
  );
}
