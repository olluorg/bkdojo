import { useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import {
  buildCourses,
  courseLevelOf,
  COURSE_LEVEL_LABELS,
  isStepDone,
  nextStep,
} from '../../domain/course/courses';
import { domainLearningStatus, lessonLearningStatus } from '../../domain/progress/learningStatus';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor, navigate, segments, useHashPath } from '../../app/router';

export function CoursesScreen() {
  const { all } = useLessons();
  const index = useContentIndex();
  const { progress } = useProgress();
  const courses = useMemo(() => buildCourses(all), [all]);

  const domain = segments(useHashPath())[1];
  const course = domain ? courses.find((c) => c.domain === domain) : undefined;

  // --- Course path (one course) ---
  if (course) {
    const upcoming = nextStep(progress, index, course);
    const currentIndex = course.steps.findIndex((s) => !isStepDone(progress, index, s.lesson));
    const courseStatus = domainLearningStatus(
      progress,
      index,
      course.domain,
      course.steps.map((s) => s.lesson),
    );

    return (
      <section>
        <button className="link-back" onClick={() => navigate('/courses')}>
          ← Все курсы
        </button>
        <h1 className="screen__title">{course.title}</h1>
        <div className="rank">
          <span className={`rank__badge rank__badge--${courseLevelOf(progress, index, course.domain)}`}>
            {COURSE_LEVEL_LABELS[courseLevelOf(progress, index, course.domain)]}
          </span>
          <div className="rank__meta">{courseStatus.summary}</div>
        </div>
        <ProgressBar value={courseStatus.completion} />

        {upcoming && (
          <button className="btn" onClick={() => navigate(`/lessons/${upcoming.id}`)}>
            Продолжить
          </button>
        )}

        <ol className="path">
          {course.steps.map((step, i) => {
            const status = lessonLearningStatus(progress, index, step.lesson);
            const done = status.test.state === 'passed';
            const read = status.read === 'read';
            // Mastered (done) is the strong state; "read" is a lighter marker that
            // still lifts the step out of the dimmed "upcoming" look.
            const state = done
              ? 'done'
              : i === currentIndex
                ? 'current'
                : read
                  ? 'read'
                  : 'upcoming';
            return (
              <li key={step.lesson.id} className={`path-step path-step--${state}`}>
                <a className="path-step__link" href={hrefFor(`/lessons/${step.lesson.id}`)}>
                  <span className="path-step__index">{done || read ? '✓' : i + 1}</span>
                  <span className="path-step__body">
                    <span className="path-step__title">
                      {step.lesson.title}
                    </span>
                    <span className="path-step__meta">
                      {status.labels.join(' · ')}
                    </span>
                    <ProgressBar value={status.test.progress} />
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  // --- Course list ---
  return (
    <section>
      <h1 className="screen__title">Курсы</h1>
      <p className="screen__note">Иди по порядку — от основ к сложному, не распыляясь.</p>

      <div className="course-list">
        {courses.map((c) => (
          (() => {
            const status = domainLearningStatus(
              progress,
              index,
              c.domain,
              c.steps.map((s) => s.lesson),
            );
            return (
              <a key={c.domain} className="course-card" href={hrefFor(`/courses/${c.domain}`)}>
                <div className="course-card__head">
                  <span className="course-card__title">{c.title}</span>
                  <span className="course-card__count">
                    {COURSE_LEVEL_LABELS[courseLevelOf(progress, index, c.domain)]}
                  </span>
                </div>
                <span className="course-card__summary">{status.summary}</span>
                <ProgressBar value={status.completion} />
              </a>
            );
          })()
        ))}
      </div>
    </section>
  );
}
