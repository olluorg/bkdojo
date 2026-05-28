import { useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import {
  buildCourses,
  courseLevelOf,
  courseProgress,
  COURSE_LEVEL_LABELS,
  isStepDone,
  nextStep,
  stepProgress,
} from '../../domain/course/courses';
import { isLessonRead } from '../../domain/progress/lessonProgress';
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
          <div className="rank__meta">Твой уровень в этом курсе</div>
        </div>
        <ProgressBar value={courseProgress(progress, index, course)} />

        {upcoming && (
          <button className="btn" onClick={() => navigate(`/lessons/${upcoming.id}`)}>
            Продолжить
          </button>
        )}

        <ol className="path">
          {course.steps.map((step, i) => {
            const done = isStepDone(progress, index, step.lesson);
            const read = isLessonRead(progress, step.lesson.id);
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
                      {read && !done && <span className="path-step__read">прочитано</span>}
                    </span>
                    <ProgressBar value={stepProgress(progress, index, step.lesson)} />
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
          <a key={c.domain} className="course-card" href={hrefFor(`/courses/${c.domain}`)}>
            <div className="course-card__head">
              <span className="course-card__title">{c.title}</span>
              <span className="course-card__count">
                {COURSE_LEVEL_LABELS[courseLevelOf(progress, index, c.domain)]} · {c.steps.length}{' '}
                уроков
              </span>
            </div>
            <ProgressBar value={courseProgress(progress, index, c)} />
          </a>
        ))}
      </div>
    </section>
  );
}
