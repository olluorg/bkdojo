import type { ContentIndex } from '../content/contentIndex';
import { getById } from '../content/contentIndex';
import { DOMAIN_LABELS } from '../models/common';
import type { AnswerRecord, UserProgress } from '../models/progress';
import type { Session, SessionItem } from '../models/session';

export interface ReviewOptions {
  now?: Date;
  size?: number;
}

interface DueEntry {
  questionId: string;
  due: number; // epoch ms
}

/** Latest record per question that is due for review (nextReviewAt <= now). */
function collectDue(progress: UserProgress, now: number): DueEntry[] {
  const latest = new Map<string, AnswerRecord>();
  for (const record of progress.history) latest.set(record.questionId, record);

  const entries: DueEntry[] = [];
  for (const record of latest.values()) {
    if (!record.nextReviewAt) continue;
    const due = Date.parse(record.nextReviewAt);
    if (!Number.isNaN(due) && due <= now) entries.push({ questionId: record.questionId, due });
  }
  return entries;
}

/** Builds a review session from the most overdue items first. */
export function buildReviewSession(
  index: ContentIndex,
  progress: UserProgress,
  options: ReviewOptions = {},
): Session {
  const now = (options.now ?? new Date()).getTime();
  const size = options.size ?? 10;

  const due = collectDue(progress, now).sort((a, b) => a.due - b.due);
  const items: SessionItem[] = [];
  for (const entry of due) {
    if (items.length >= size) break;
    const question = getById(index, entry.questionId);
    if (question) {
      items.push({
        question,
        reason: 'review',
        reasonText: `Повторение: вопрос по ${DOMAIN_LABELS[question.domain]} уже пора закрепить.`,
      });
    }
  }

  return { kind: 'review', items };
}
