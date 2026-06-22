import type { ContentIndex } from '../content/contentIndex';
import type { Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { isLessonRead } from './lessonProgress';
import { correctlyAnsweredIds, lessonQuestionIds, lessonProgress } from './lessonStatus';
import { domainMastery } from './mastery';

export type ReadState = 'unread' | 'read';
export type TestState = 'no-test' | 'not-started' | 'in-progress' | 'passed';
export type RetentionState = 'not-ready' | 'due' | 'scheduled' | 'stable';

export interface LessonLearningStatus {
  read: ReadState;
  test: {
    state: TestState;
    correct: number;
    attempted: number;
    total: number;
    progress: number;
    label: string;
  };
  retention: {
    state: RetentionState;
    due: number;
    scheduled: number;
    label: string;
  };
  labels: string[];
}

export interface DomainLearningStatus {
  domain: Domain;
  lessonsTotal: number;
  lessonsRead: number;
  testsPassed: number;
  retentionDue: number;
  completion: number;
  mastery: number;
  summary: string;
}

function latestByQuestion(history: readonly AnswerRecord[]): Map<string, AnswerRecord> {
  const latest = new Map<string, AnswerRecord>();
  for (const record of history) latest.set(record.questionId, record);
  return latest;
}

export function lessonLearningStatus(
  progress: UserProgress,
  index: ContentIndex,
  lesson: Lesson,
  now: Date = new Date(),
): LessonLearningStatus {
  const ids = lessonQuestionIds(index, lesson);
  const idSet = new Set(ids);
  const latest = latestByQuestion(progress.history);
  const correct = correctlyAnsweredIds(progress);
  const read: ReadState = isLessonRead(progress, lesson.id) ? 'read' : 'unread';
  const total = ids.length;
  const correctCount = ids.filter((id) => correct.has(id)).length;
  const attempted = ids.filter((id) => latest.has(id)).length;
  const progressValue = lessonProgress(progress, index, lesson);

  const testState: TestState =
    total === 0
      ? 'no-test'
      : correctCount === total
        ? 'passed'
        : attempted > 0
          ? 'in-progress'
          : 'not-started';

  const timestamp = now.getTime();
  let due = 0;
  let scheduled = 0;
  for (const record of latest.values()) {
    if (!idSet.has(record.questionId) || !record.nextReviewAt) continue;
    const next = Date.parse(record.nextReviewAt);
    if (Number.isNaN(next)) continue;
    if (next <= timestamp) due++;
    else scheduled++;
  }

  const retentionState: RetentionState =
    testState !== 'passed'
      ? 'not-ready'
      : due > 0
        ? 'due'
        : scheduled > 0
          ? 'scheduled'
          : 'stable';

  const testLabel =
    testState === 'no-test'
      ? 'Без теста'
      : testState === 'passed'
        ? `Тест закрыт ${correctCount}/${total}`
        : attempted > 0
          ? `Тест ${correctCount}/${total}`
          : `Тест 0/${total}`;

  const retentionLabel =
    retentionState === 'not-ready'
      ? 'Закрепление после теста'
      : retentionState === 'due'
        ? `Повторить ${due}`
        : retentionState === 'scheduled'
          ? 'Повторение запланировано'
          : 'Закреплено';

  const labels = [read === 'read' ? 'Прочитано' : 'Не прочитано', testLabel, retentionLabel];

  return {
    read,
    test: {
      state: testState,
      correct: correctCount,
      attempted,
      total,
      progress: progressValue,
      label: testLabel,
    },
    retention: { state: retentionState, due, scheduled, label: retentionLabel },
    labels,
  };
}

export function domainLearningStatus(
  progress: UserProgress,
  index: ContentIndex,
  domain: Domain,
  lessons: readonly Lesson[],
  now: Date = new Date(),
): DomainLearningStatus {
  const statuses = lessons.map((lesson) => lessonLearningStatus(progress, index, lesson, now));
  const lessonsRead = statuses.filter((s) => s.read === 'read').length;
  const testsPassed = statuses.filter((s) => s.test.state === 'passed').length;
  const retentionDue = statuses.filter((s) => s.retention.state === 'due').length;
  const completion =
    statuses.length === 0
      ? 0
      : statuses.reduce((sum, s) => sum + s.test.progress, 0) / statuses.length;
  const mastery = domainMastery(progress, index, domain);
  const summary = `${lessonsRead}/${lessons.length} прочитано · ${testsPassed}/${lessons.length} тестов · ${
    retentionDue > 0 ? `повторить ${retentionDue}` : 'без срочных повторений'
  }`;

  return {
    domain,
    lessonsTotal: lessons.length,
    lessonsRead,
    testsPassed,
    retentionDue,
    completion,
    mastery,
    summary,
  };
}
