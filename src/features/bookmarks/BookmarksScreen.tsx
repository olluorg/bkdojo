import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { SessionRunner } from '../../components/SessionRunner';
import { getById } from '../../domain/content/contentIndex';
import { DOMAIN_LABELS } from '../../domain/models/common';
import type { Lesson } from '../../domain/models/lesson';
import type { Question } from '../../domain/models/question';
import type { Session } from '../../domain/models/session';
import { bookmarkedLessonIds } from '../../domain/progress/lessonBookmarks';
import { bookmarkedQuestionIds } from '../../domain/progress/questionBookmarks';
import { hrefFor, navigate, segments, useHashPath } from '../../app/router';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';

export function BookmarksScreen() {
  const { byId } = useLessons();
  const index = useContentIndex();
  const { progress, dispatch } = useProgress();

  const practicing = segments(useHashPath())[1] === 'practice';

  const lessons = bookmarkedLessonIds(progress)
    .map((id) => byId.get(id))
    .filter((l): l is Lesson => l !== undefined);

  const questions = bookmarkedQuestionIds(progress)
    .map((id) => getById(index, id))
    .filter((q): q is Question => q !== undefined);

  if (practicing) {
    return <BookmarksPractice questions={questions} />;
  }

  if (lessons.length === 0 && questions.length === 0) {
    return (
      <section>
        <h1 className="screen__title">Закладки</h1>
        <EmptyState
          icon="🔖"
          title="Пока нет закладок"
          description="Отмечай уроки и вопросы звёздочкой, чтобы вернуться к ним и уделить больше внимания."
          actionLabel="К урокам"
          actionHref="/courses"
        />
      </section>
    );
  }

  return (
    <section>
      <h1 className="screen__title">Закладки</h1>
      <p className="screen__note">
        Сохранённые уроки и вопросы — то, к чему ты хочешь вернуться и разобрать получше.
      </p>

      {lessons.length > 0 && (
        <div className="lesson-group">
          <h2 className="lesson-group__h">★ Уроки</h2>
          <ul className="lesson-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <a className="lesson-item" href={hrefFor(`/lessons/${lesson.id}`)}>
                  <span className="lesson-item__title">
                    <span className="lesson-item__bookmark" aria-hidden>
                      ★
                    </span>
                    {lesson.title}
                  </span>
                  <span className="lesson-item__summary">{lesson.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="lesson-group">
          <div className="bookmarks__section-head">
            <h2 className="lesson-group__h">★ Вопросы</h2>
            <button className="btn btn--sm" onClick={() => navigate('/bookmarks/practice')}>
              Повторить ({questions.length})
            </button>
          </div>
          <ul className="bookmark-q-list">
            {questions.map((q) => (
              <li key={q.id} className="bookmark-q">
                <div className="bookmark-q__main">
                  <span className="bookmark-q__domain">{DOMAIN_LABELS[q.domain]}</span>
                  <span className="bookmark-q__prompt">{q.prompt}</span>
                </div>
                <button
                  className="bookmark-toggle bookmark-toggle--on bookmark-q__remove"
                  onClick={() =>
                    dispatch({ type: 'setQuestionBookmark', questionId: q.id, bookmarked: false })
                  }
                  title="Убрать из закладок"
                  aria-label="Убрать из закладок"
                >
                  ★
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** A practice run over exactly the bookmarked questions (easiest-first). */
function BookmarksPractice({ questions }: { questions: Question[] }) {
  const [session] = useState<Session>(() => ({
    kind: 'daily',
    items: [...questions]
      .sort((a, b) => a.difficulty - b.difficulty)
      .map((question) => ({ question, reason: 'daily' as const })),
  }));

  return (
    <>
      <button className="link-back" onClick={() => navigate('/bookmarks')}>
        ← К закладкам
      </button>
      <SessionRunner
        title="Повторение закладок"
        session={session}
        mode="daily"
        emptyMessage="В закладках пока нет вопросов."
        onRestart={() => navigate('/bookmarks')}
        restartLabel="К закладкам"
      />
    </>
  );
}
