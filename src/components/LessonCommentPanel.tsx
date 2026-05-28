import { useMemo, useState } from 'react';
import type { ContentIndex } from '../domain/content/contentIndex';
import { FreeformUnavailableError } from '../domain/evaluation/freeformAi';
import {
  generateLessonComment,
  lessonAnswersFingerprint,
  summarizeLessonAnswers,
  type LessonCommentSource,
} from '../domain/lessonReview/lessonReview';
import type { Lesson } from '../domain/models/lesson';
import { useProgress } from '../state/ProgressContext';

interface Props {
  lesson: Lesson;
  index: ContentIndex;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'comment'; text: string; source: LessonCommentSource; cached: boolean }
  | { kind: 'no-answers' }
  | { kind: 'all-correct' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

const SOURCE_LABELS: Record<LessonCommentSource, string> = {
  'chrome-prompt': 'разбор подготовлен AI на устройстве',
  server: 'разбор подготовлен облачным AI',
};

export function LessonCommentPanel({ lesson, index }: Props) {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';

  // Fingerprint of the current answers; while it matches the cached comment's
  // fingerprint we reuse the saved comment instead of calling the LLM again.
  const fingerprint = useMemo(
    () => lessonAnswersFingerprint(progress, index, lesson),
    [progress, index, lesson],
  );
  const cached = progress.lessonComments?.[lesson.id];
  const cacheValid = cached?.fingerprint === fingerprint;

  // Show the saved comment immediately on open (no request) when it's still current.
  const [state, setState] = useState<State>(() =>
    cached && cacheValid
      ? { kind: 'comment', text: cached.text, source: cached.source, cached: true }
      : { kind: 'idle' },
  );

  async function handleClick() {
    const { answeredCount, mistakeItems } = summarizeLessonAnswers(progress, index, lesson);
    if (answeredCount === 0) {
      setState({ kind: 'no-answers' });
      return;
    }
    if (mistakeItems.length === 0) {
      setState({ kind: 'all-correct' });
      return;
    }
    // Answers unchanged since the last comment → reuse it, spend no request.
    if (cached && cacheValid) {
      setState({ kind: 'comment', text: cached.text, source: cached.source, cached: true });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const result = await generateLessonComment(lesson, mistakeItems, method);
      dispatch({
        type: 'saveLessonComment',
        lessonId: lesson.id,
        comment: {
          fingerprint,
          text: result.text,
          source: result.source,
          generatedAt: new Date().toISOString(),
        },
      });
      setState({ kind: 'comment', text: result.text, source: result.source, cached: false });
    } catch (error) {
      if (error instanceof FreeformUnavailableError) {
        setState({ kind: 'unavailable' });
      } else {
        setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const busy = state.kind === 'loading';
  const showing = state.kind === 'comment';
  const upToDate = showing && cacheValid; // saved comment reflects the current answers
  const buttonLabel = busy
    ? 'Анализирую ответы…'
    : upToDate
      ? '✓ Разбор актуален'
      : showing
        ? '💬 Обновить разбор' // answers changed since the saved comment
        : '💬 Получить комментарий';

  return (
    <div className="lesson-comment">
      <button className="btn btn--ghost" onClick={handleClick} disabled={busy || upToDate}>
        {buttonLabel}
      </button>
      <p className="lesson-comment__hint">
        Разбор твоих ответов по этой теме: что пошло не так и как отвечать лучше. Сохраняется и не
        тратит запрос повторно, пока ответы не изменились.
      </p>

      {state.kind === 'no-answers' && (
        <p className="screen__note">
          Сначала пройди тест по теме — тогда я разберу твои ответы и подскажу, что улучшить.
        </p>
      )}
      {state.kind === 'all-correct' && (
        <p className="screen__note">
          Все твои ответы по этой теме зачтены — разбирать нечего, отличная работа! 🎉
        </p>
      )}
      {state.kind === 'unavailable' && (
        <div className="banner banner--warn">
          AI недоступен. Включи Chrome Built-in AI или настрой облачную оценку в настройках, чтобы
          получить персональный разбор.
        </div>
      )}
      {state.kind === 'error' && (
        <div className="banner banner--warn">Не удалось получить разбор: {state.message}.</div>
      )}
      {state.kind === 'comment' && (
        <div className="lesson-comment__result">
          <p className="lesson-comment__text">{state.text}</p>
          <p className="lesson-comment__source">
            {SOURCE_LABELS[state.source]}
            {state.cached && ' · сохранён ранее'}
          </p>
        </div>
      )}
    </div>
  );
}
