import { hrefFor } from '../app/router';
import type { AiStatus } from '../hooks/useAiCapability';

/** Chrome-first UX cue: nudges the user toward Chrome / explains degraded mode. */
export function AiStatusBanner({
  status,
  onDismiss,
}: {
  status: AiStatus;
  onDismiss?: () => void;
}) {
  if (status === 'checking' || status === 'available') return null;

  const dismissBtn = onDismiss ? (
    <button
      type="button"
      className="banner__close"
      title="Скрыть (останется в настройках)"
      aria-label="Скрыть уведомление"
      onClick={onDismiss}
    >
      ✕
    </button>
  ) : null;

  if (status === 'unavailable') {
    return (
      <div className="banner banner--warn">
        <span className="banner__text">
          AI-оценка недоступна в этом браузере — открытые вопросы пойдут в режиме самопроверки.
          Полный опыт — в Google Chrome Desktop, либо{' '}
          <a href={hrefFor('/settings')}>подключи облачную оценку в настройках</a>.
        </span>
        {dismissBtn}
      </div>
    );
  }

  return (
    <div className="banner banner--info">
      <span className="banner__text">
        Модель AI ещё не загружена — она подключится при первой проверке открытого ответа.
      </span>
      {dismissBtn}
    </div>
  );
}
