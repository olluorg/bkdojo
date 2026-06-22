import { useMemo } from 'react';
import { DOMAIN_LABELS } from '../../domain/models/common';
import type { AppEvent, SessionKind } from '../../domain/models/event';
import type { AnswerRecord } from '../../domain/models/progress';
import { dayKey, unifiedTimeline, type TimelineEntry } from '../../domain/progress/analytics';
import { useGlossary } from '../../hooks/useGlossary';
import { useLessons } from '../../hooks/useLessons';
import { useProgress } from '../../state/ProgressContext';
import { EmptyState } from '../../components/EmptyState';

const SESSION_LABELS: Record<SessionKind, string> = {
  practice: 'практика',
  review: 'слабые места',
  interview: 'интервью',
};

interface Row {
  icon: string;
  title: string;
  meta?: string;
}

function answerRow(a: AnswerRecord): Row {
  const correct = a.verdict === 'correct';
  return {
    icon: correct ? '✅' : a.verdict === 'partial' ? '🟡' : '❌',
    title: correct ? 'Верный ответ' : a.verdict === 'partial' ? 'Частичный ответ' : 'Ошибка в вопросе',
    meta: `${DOMAIN_LABELS[a.domain]} · ${Math.round(a.score * 100)}%`,
  };
}

function eventRow(
  e: AppEvent,
  lessonTitle: (id?: string) => string | undefined,
  termTitle: (id?: string) => string | undefined,
): Row {
  switch (e.type) {
    case 'lesson_started':
      return { icon: '📖', title: 'Открыт урок', meta: lessonTitle(e.refId) };
    case 'lesson_completed':
      return { icon: '🎓', title: 'Урок пройден', meta: lessonTitle(e.refId) };
    case 'term_drilled':
      return {
        icon: e.correct ? '📗' : '📕',
        title: e.correct ? 'Термин: верно' : 'Термин: ошибка',
        meta: termTitle(e.refId),
      };
    case 'session_started':
      return { icon: '▶️', title: 'Начата сессия', meta: SESSION_LABELS[e.refId as SessionKind] };
    case 'session_completed':
      return { icon: '🏁', title: 'Сессия завершена', meta: SESSION_LABELS[e.refId as SessionKind] };
    case 'placement_completed':
      return { icon: '🎚️', title: 'Пройден тест уровня' };
    case 'override_used':
      return { icon: '↩️', title: 'Самооценка засчитана' };
    default:
      return { icon: '•', title: e.type };
  }
}

function dayHeading(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return 'Сегодня';
  if (key === yesterdayKey) return 'Вчера';
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function HistoryScreen() {
  const { progress } = useProgress();
  const { byId: lessonsById } = useLessons();
  const terms = useGlossary();

  const termsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of terms) m.set(t.id, t.term);
    return m;
  }, [terms]);

  const entries = useMemo(() => unifiedTimeline(progress, 200), [progress]);

  const now = new Date();
  const todayKey = dayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);

  // Group the (already newest-first) entries by local day, preserving order.
  const groups: { key: string; items: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(new Date(entry.at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(entry);
    else groups.push({ key, items: [entry] });
  }

  const toRow = (entry: TimelineEntry): Row =>
    entry.source === 'answer'
      ? answerRow(entry.answer!)
      : eventRow(
          entry.event!,
          (id) => (id ? lessonsById.get(id)?.title : undefined),
          (id) => (id ? termsById.get(id) : undefined),
        );

  return (
    <section>
      <h1 className="screen__title">История</h1>
      <p className="screen__note">
        Все твои учебные действия по дням — уроки, ответы, ошибки, сессии и тренировки.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          icon="🗒️"
          title="Пока пусто"
          description="Начни заниматься — пройди урок или сделай практику, и события появятся здесь."
          actionLabel="К практике"
          actionHref="/practice"
        />
      ) : (
        groups.map((group) => (
          <div key={group.key} className="history-day">
            <h2 className="history-day__h">{dayHeading(group.key, todayKey, yesterdayKey)}</h2>
            <ul className="history-list">
              {group.items.map((entry, i) => {
                const row = toRow(entry);
                return (
                  <li key={`${entry.at}-${i}`} className="history-row">
                    <span className="history-row__icon" aria-hidden>
                      {row.icon}
                    </span>
                    <span className="history-row__body">
                      <span className="history-row__title">{row.title}</span>
                      {row.meta && <span className="history-row__meta">{row.meta}</span>}
                    </span>
                    <time className="history-row__time">{timeLabel(entry.at)}</time>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
