import { getById, type ContentIndex } from '../content/contentIndex';
import {
  runFreeformAi,
  type FreeformResult,
  type FreeformSource,
} from '../evaluation/freeformAi';
import type { Lesson } from '../models/lesson';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { isFillBlankQuestion, isOpenQuestion, type Question } from '../models/question';
import type { EvalMethod } from '../models/settings';
import { lessonQuestionIds } from '../progress/lessonStatus';
import { buildLessonReviewPrompt, type LessonReviewItem } from './lessonReviewPrompt';

export interface LessonAnswerSummary {
  /** Distinct lesson questions answered at least once. */
  answeredCount: number;
  /** Most recent answer is not correct — the material for a personalized comment. */
  mistakeItems: LessonReviewItem[];
}

/** Most recent record per question id (history is appended chronologically). */
function latestByQuestion(history: AnswerRecord[]): Map<string, AnswerRecord> {
  const map = new Map<string, AnswerRecord>();
  for (const record of history) map.set(record.questionId, record);
  return map;
}

/** Compact, order-independent FNV-1a hash → base36, used for the cache key. */
function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * A stable signature of the learner's latest answers to a lesson's questions.
 * It changes exactly when the comment would change — a verdict flips, a wrong
 * answer is reworded, or a new question gets answered — so an unchanged
 * signature lets us reuse the cached comment instead of calling the LLM again.
 * Correct answers contribute only their verdict (re-wording a correct answer
 * doesn't alter the mistake breakdown).
 */
export function lessonAnswersFingerprint(
  progress: UserProgress,
  index: ContentIndex,
  lesson: Lesson,
): string {
  const latest = latestByQuestion(progress.history);
  const parts: string[] = [];
  for (const id of [...lessonQuestionIds(index, lesson)].sort()) {
    const record = latest.get(id);
    if (!record) continue;
    if (record.verdict === 'correct') {
      parts.push(`${id}|correct`);
      continue;
    }
    const sel = [...(record.selectedOptionIds ?? [])].sort().join(',');
    const cov = [...(record.conceptCoverage ?? [])]
      .map((c) => `${c.conceptId}:${c.coverage}`)
      .sort()
      .join(',');
    parts.push(`${id}|${record.verdict}|${record.evaluatedBy}|${record.answer ?? ''}|${sel}|${cov}`);
  }
  return hashString(parts.join('\n'));
}

function resolveUserAnswer(question: Question, record: AnswerRecord): string {
  if (record.evaluatedBy === 'skipped') return '(пропущено — «Я не знаю»)';
  if (isOpenQuestion(question) || isFillBlankQuestion(question)) {
    return record.answer?.trim() || '(ответ не сохранён)';
  }
  const ids = new Set(record.selectedOptionIds ?? []);
  const picked = question.options.filter((o) => ids.has(o.id)).map((o) => o.text);
  return picked.length > 0 ? picked.join('; ') : '(не выбрано)';
}

function resolveReference(question: Question): string {
  if (isOpenQuestion(question)) {
    return question.answerGuide.normal || question.answerGuide.short || '';
  }
  if (isFillBlankQuestion(question)) {
    return question.blanks.map((b) => `${b.id}: ${b.accept[0]}`).join('; ');
  }
  const correct = new Set(question.correctOptionIds);
  return question.options
    .filter((o) => correct.has(o.id))
    .map((o) => o.text)
    .join('; ');
}

function missedConceptTitles(question: Question, record: AnswerRecord): string[] {
  if (!isOpenQuestion(question) || !record.conceptCoverage) return [];
  const titleById = new Map(question.rubric.map((c) => [c.id, c.title]));
  return record.conceptCoverage
    .filter((c) => c.coverage !== 'covered')
    .map((c) => titleById.get(c.conceptId) ?? c.conceptId);
}

/**
 * Folds the learner's stored answers for a lesson into a review summary: how many
 * of its questions were answered, and which ones are still wrong (the input for
 * the personalized comment). Pure — reads only persisted progress + content.
 */
export function summarizeLessonAnswers(
  progress: UserProgress,
  index: ContentIndex,
  lesson: Lesson,
): LessonAnswerSummary {
  const latest = latestByQuestion(progress.history);
  const ids = lessonQuestionIds(index, lesson);

  let answeredCount = 0;
  const mistakeItems: LessonReviewItem[] = [];

  for (const id of ids) {
    const record = latest.get(id);
    const question = getById(index, id);
    if (!record || !question) continue;
    answeredCount++;
    if (record.verdict === 'correct') continue;
    mistakeItems.push({
      prompt: question.prompt,
      type: isOpenQuestion(question) ? 'open' : 'choice',
      userAnswer: resolveUserAnswer(question, record),
      reference: resolveReference(question),
      verdict: record.verdict,
      missedConcepts: missedConceptTitles(question, record),
    });
  }

  return { answeredCount, mistakeItems };
}

export type LessonCommentSource = FreeformSource;

/**
 * Generates the personalized "what you got wrong and how to fix it" comment for
 * a lesson, from the learner's stored mistakes. Throws `FreeformUnavailableError`
 * when no AI channel is available — callers fall back to manual review.
 */
export async function generateLessonComment(
  lesson: Lesson,
  mistakeItems: LessonReviewItem[],
  method: EvalMethod,
): Promise<FreeformResult> {
  const prompt = buildLessonReviewPrompt({
    lessonTitle: lesson.title,
    lessonSummary: lesson.summary,
    items: mistakeItems,
  });
  return runFreeformAi(prompt, { method });
}
