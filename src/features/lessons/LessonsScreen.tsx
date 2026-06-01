import { LessonCommentPanel } from '../../components/LessonCommentPanel';
import { LessonReader } from '../../components/LessonReader';
import { DOMAIN_LABELS } from '../../domain/models/common';
import type { Lesson } from '../../domain/models/lesson';
import { lessonStatus, type LessonStatus } from '../../domain/progress/lessonStatus';
import { isLessonBookmarked } from '../../domain/progress/lessonBookmarks';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor, navigate, segments, useHashPath } from '../../app/router';
import { LessonPractice } from './LessonPractice';

const LIST_BADGE: Partial<Record<LessonStatus, { label: string; className: string }>> = {
  passed: { label: '✓ Пройдено', className: 'lesson-item__badge lesson-item__badge--passed' },
  'needs-work': {
    label: 'Нужно доработать',
    className: 'lesson-item__badge lesson-item__badge--todo',
  },
};

export function LessonsScreen() {
  const { byDomain, byId } = useLessons();
  const index = useContentIndex();
  const { progress, dispatch } = useProgress();

  // Route shape: /lessons | /lessons/:id | /lessons/:id/practice[/q<n>]
  const parts = segments(useHashPath());
  const lessonId = parts[1];
  const practicing = parts[2] === 'practice';
  const selected = lessonId ? byId.get(lessonId) ?? null : null;

  if (selected && practicing) {
    return (
      <LessonPractice
        index={index}
        lesson={selected}
        onBack={() => navigate(`/lessons/${selected.id}`)}
      />
    );
  }

  if (selected) {
    const related = (selected.related ?? [])
      .map((id) => byId.get(id))
      .filter((l): l is Lesson => l !== undefined)
      .map((l) => ({ id: l.id, title: l.title }));

    // Neighbours within the same section (domain). `null` at the edges → back to the list.
    const siblings = byDomain.get(selected.domain) ?? [];
    const idx = siblings.findIndex((l) => l.id === selected.id);
    const prevLesson = idx > 0 ? siblings[idx - 1] : null;
    const nextLesson = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    const status = lessonStatus(progress, index, selected);

    return (
      <LessonReader
        lesson={selected}
        related={related}
        prev={prevLesson ? { title: prevLesson.title } : null}
        next={nextLesson ? { title: nextLesson.title } : null}
        read={status !== 'unread'}
        bookmarked={isLessonBookmarked(progress, selected.id)}
        status={status}
        extra={<LessonCommentPanel lesson={selected} index={index} />}
        onSetRead={(read) => dispatch({ type: 'setLessonRead', lessonId: selected.id, read })}
        onToggleBookmark={() =>
          dispatch({
            type: 'setLessonBookmark',
            lessonId: selected.id,
            bookmarked: !isLessonBookmarked(progress, selected.id),
          })
        }
        onBack={() => navigate(`/courses/${selected.domain}`)}
        onPrev={() =>
          navigate(prevLesson ? `/lessons/${prevLesson.id}` : `/courses/${selected.domain}`)
        }
        onNext={() =>
          navigate(nextLesson ? `/lessons/${nextLesson.id}` : `/courses/${selected.domain}`)
        }
        onPractice={() => navigate(`/lessons/${selected.id}/practice`)}
        onOpenRelated={(id) => navigate(`/lessons/${id}`)}
      />
    );
  }

  const renderItem = (lesson: Lesson) => {
    const badge = LIST_BADGE[lessonStatus(progress, index, lesson)];
    return (
      <li key={lesson.id}>
        <a className="lesson-item" href={hrefFor(`/lessons/${lesson.id}`)}>
          <span className="lesson-item__title">
            {isLessonBookmarked(progress, lesson.id) && (
              <span className="lesson-item__bookmark" aria-label="В закладках">
                ★
              </span>
            )}
            {lesson.title}
            {badge && <span className={badge.className}>{badge.label}</span>}
          </span>
          <span className="lesson-item__summary">{lesson.summary}</span>
        </a>
      </li>
    );
  };

  return (
    <section>
      <h1 className="screen__title">Уроки</h1>
      <p className="screen__note">Короткая теория по темам. Прочитай — и сразу проверь себя.</p>

      {[...byDomain.entries()].map(([domain, lessons]) => (
        <div key={domain} className="lesson-group">
          <h2 className="lesson-group__h">{DOMAIN_LABELS[domain]}</h2>
          <ul className="lesson-list">{lessons.map(renderItem)}</ul>
        </div>
      ))}
    </section>
  );
}
