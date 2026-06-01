import { useCallback, useState } from 'react';
import { SessionRunner } from '../../components/SessionRunner';
import { getById, type ContentIndex } from '../../domain/content/contentIndex';
import { lessonCorrectiveNeeds } from '../../domain/lesson/lessonCorrective';
import { resolveCorrectiveItems } from '../../domain/lesson/resolveCorrective';
import type { AnswerOutcome } from '../../domain/models/answer';
import type { Lesson } from '../../domain/models/lesson';
import type { Question } from '../../domain/models/question';
import { correctlyAnsweredIds, lessonQuestionIds } from '../../domain/progress/lessonStatus';
import { buildSessionFromQuestions } from '../../domain/selection/topicSelector';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';

interface Props {
  index: ContentIndex;
  lesson: Lesson;
  onBack: () => void;
}

export function LessonPractice({ index, lesson, onBack }: Props) {
  const { progress } = useProgress();
  const { byDomain } = useLessons();
  const method = progress.settings?.evalMethod ?? 'auto';

  // Next lesson in the same section, if any — surfaced on the completion screen
  // so finishing a lesson's test leads straight into the next one.
  const siblings = byDomain.get(lesson.domain) ?? [];
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const nextLesson = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;
  const nextAction = nextLesson
    ? { label: 'Следующий урок →', path: `/lessons/${nextLesson.id}` }
    : undefined;

  // The lesson's "работа над ошибками" re-asks ONLY the learner's own missed
  // questions from THIS lesson (retry), never concept follow-ups from the wider
  // bank. That keeps it on-topic and lets clearing a miss flip the lesson to
  // "passed" (a follow-up is a different question and would never clear the
  // original).
  const buildCorrectiveRound = useCallback(
    (outcomes: AnswerOutcome[]) => {
      const lessonIds = new Set(lessonQuestionIds(index, lesson));
      return resolveCorrectiveItems(lessonCorrectiveNeeds(outcomes, lessonIds), {
        index,
        method,
        excludeIds: correctlyAnsweredIds(progress),
      });
    },
    [index, lesson, method, progress],
  );

  // Freeze the session (and whether it was emptied only because everything was
  // already answered correctly) at mount, so recording answers mid-session does
  // not reshuffle the remaining questions. The pool is the lesson's own
  // questions (explicit `questionIds`, or the tag fallback for un-migrated
  // domains) — never the whole topic area — so the test stays strictly on-topic.
  const [{ session, allCleared }] = useState(() => {
    const pool = lessonQuestionIds(index, lesson)
      .map((id) => getById(index, id))
      .filter((q): q is Question => q !== undefined);
    const built = buildSessionFromQuestions(pool, {
      size: 8,
      excludeIds: correctlyAnsweredIds(progress),
    });
    return { session: built, allCleared: pool.length > 0 && built.items.length === 0 };
  });

  const title = `Тест: ${lesson.title}`;

  const emptyMessage = allCleared
    ? 'Ты уже верно ответил на все вопросы этой темы 🎉 Вернись к уроку.'
    : 'По этой теме пока нет вопросов. Вернись к уроку.';

  return (
    <>
      <button className="link-back" onClick={onBack}>
        ← К уроку
      </button>
      <SessionRunner
        title={title}
        session={session}
        mode="daily"
        emptyMessage={emptyMessage}
        onRestart={onBack}
        restartLabel="Вернуться к уроку"
        buildCorrectiveRound={buildCorrectiveRound}
        nextAction={nextAction}
      />
    </>
  );
}
