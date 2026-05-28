import type { AiStatus } from '../hooks/useAiCapability';

/** Chrome-first UX cue: nudges the user toward Chrome / explains degraded mode. */
export function AiStatusBanner({ status }: { status: AiStatus }) {
  if (status === 'checking' || status === 'available') return null;

  if (status === 'unavailable') {
    return (
      <div className="banner banner--warn">
        AI-оценка недоступна в этом браузере. Открытые вопросы — в режиме самопроверки. Полный опыт:
        Google Chrome Desktop.
      </div>
    );
  }

  return (
    <div className="banner banner--info">
      Модель AI ещё не загружена — она подключится при первой проверке открытого ответа.
    </div>
  );
}
