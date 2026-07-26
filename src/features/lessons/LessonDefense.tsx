import { useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { buildDefenseSession, isDefensePassed } from '../../domain/lesson/defense';
import type { AnswerOutcome } from '../../domain/models/answer';
import type { Lesson } from '../../domain/models/lesson';
import { useProgress } from '../../state/ProgressContext';

interface Props {
  index: ContentIndex;
  lesson: Lesson;
  onBack: () => void;
}

/**
 * A topic defense: the lesson's questions in one pass, under interview
 * conditions. Passing marks the topic closed; failing costs nothing but the
 * attempt — you can come back and try again.
 */
export function LessonDefense({ index, lesson, onBack }: Props) {
  const { dispatch } = useProgress();

  // Frozen at mount so recording answers mid-pass never reshuffles what is left.
  const [session] = useState(() => buildDefenseSession(index, lesson));

  function handleComplete(outcomes: AnswerOutcome[]) {
    if (isDefensePassed(outcomes)) {
      dispatch({ type: 'markLessonDefended', lessonId: lesson.id });
    }
  }

  return (
    <>
      <button className="link-back" onClick={onBack}>
        ← К уроку
      </button>

      <div className="banner banner--info">
        Защита темы: один заход, без подсказок и без «я не знаю». Чтобы закрыть тему, нужно ответить
        верно на всё. Не получится — можно вернуться и попробовать снова.
      </div>

      <SessionRunner
        title={`Защита: ${lesson.title}`}
        session={session}
        mode="daily"
        strict
        emptyMessage="По этой теме пока нет вопросов — защищать нечего."
        onRestart={onBack}
        restartLabel="Вернуться к уроку"
        onComplete={handleComplete}
      />
    </>
  );
}
