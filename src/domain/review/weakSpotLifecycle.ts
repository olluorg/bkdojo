import type { ConceptCoverage } from '../models/evaluation';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { rankWeakConcepts, type ConceptWeakness } from './weakSpotDetection';

export type WeakSpotState = 'active' | 'practiced-today' | 'cooldown' | 'resolved';

export interface WeakConceptStatus extends ConceptWeakness {
  state: WeakSpotState;
  label: string;
  lastCoverage?: ConceptCoverage;
  lastAnsweredAt?: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function recordsForConcept(progress: UserProgress, conceptId: string): {
  record: AnswerRecord;
  coverage: ConceptCoverage;
}[] {
  const records: { record: AnswerRecord; coverage: ConceptCoverage }[] = [];
  for (const record of progress.history) {
    const hit = record.conceptCoverage?.find((c) => c.conceptId === conceptId);
    if (hit) records.push({ record, coverage: hit.coverage });
  }
  return records;
}

export function weakSpotState(
  progress: UserProgress,
  conceptId: string,
  now: Date = new Date(),
): WeakSpotState {
  const records = recordsForConcept(progress, conceptId);
  if (records.length === 0) return 'active';

  const latest = records[records.length - 1]!;
  const latestAt = new Date(latest.record.answeredAt);
  const latestWasToday = !Number.isNaN(latestAt.getTime()) && isSameDay(latestAt, now);

  const lastTwo = records.slice(-2);
  if (lastTwo.length >= 2 && lastTwo.every((r) => r.coverage === 'covered')) return 'resolved';
  if (latestWasToday) return 'practiced-today';

  if (latest.coverage === 'covered' || latest.coverage === 'partial') return 'cooldown';
  return 'active';
}

export function weakSpotStatus(
  progress: UserProgress,
  concept: ConceptWeakness,
  now: Date = new Date(),
): WeakConceptStatus {
  const records = recordsForConcept(progress, concept.conceptId);
  const latest = records.at(-1);
  const state = weakSpotState(progress, concept.conceptId, now);
  const label =
    state === 'resolved'
      ? 'Закрывается'
      : state === 'practiced-today'
        ? 'Отработано сегодня'
        : state === 'cooldown'
          ? 'Ждём повторения'
          : 'Нужно отработать';

  return {
    ...concept,
    state,
    label,
    lastCoverage: latest?.coverage,
    lastAnsweredAt: latest?.record.answeredAt,
  };
}

export function rankWeakConceptStatuses(
  progress: UserProgress,
  options: { now?: Date; minAttempts?: number; includeResolved?: boolean } = {},
): WeakConceptStatus[] {
  const now = options.now ?? new Date();
  return rankWeakConcepts(progress, options.minAttempts)
    .filter((c) => c.missRate > 0)
    .map((concept) => weakSpotStatus(progress, concept, now))
    .filter((concept) => options.includeResolved || concept.state !== 'resolved');
}
