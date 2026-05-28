import { hrefFor } from '../app/router';
import { useStreak } from '../hooks/useStreak';

const TITLES: Record<string, string> = {
  active: 'Серия активна — ты занимался сегодня',
  'at-risk': 'Позанимайся сегодня, чтобы не потерять серию',
  none: 'Занимайся каждый день, чтобы набрать серию',
};

/** Duolingo-style daily streak: a flame + day count, always visible in the header. */
export function StreakWidget() {
  const { days, state } = useStreak();
  return (
    <a
      className={`streak streak--${state}`}
      href={hrefFor('/stats')}
      title={TITLES[state]}
      aria-label={`Серия: ${days} дней`}
    >
      <span className="streak__flame">🔥</span>
      <span className="streak__count">{days}</span>
    </a>
  );
}
