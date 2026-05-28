import {
  runFreeformChat,
  type ChatMessage,
  type FreeformResult,
} from '../evaluation/freeformAi';
import type { AnswerOutcome } from '../models/answer';
import type { Verdict } from '../models/evaluation';
import { isOpenQuestion, type Question } from '../models/question';
import type { EvalMethod } from '../models/settings';

export type { ChatMessage } from '../evaluation/freeformAi';

const VERDICT_RU: Record<Verdict, string> = {
  correct: 'зачёт',
  partial: 'частично',
  incorrect: 'не зачёт',
};

const MAX_ANSWER = 800;

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** The learner's answer as text — open text, chosen options, or a "skipped" note. */
export function outcomeAnswerText(question: Question, outcome: AnswerOutcome): string {
  if (outcome.evaluatedBy === 'skipped') return '(пропущено — «Я не знаю»)';
  if (isOpenQuestion(question)) return outcome.answer?.trim() || '(ответ не сохранён)';
  const ids = new Set(outcome.selectedOptionIds ?? []);
  const picked = question.options.filter((o) => ids.has(o.id)).map((o) => o.text);
  return picked.length > 0 ? picked.join('; ') : '(не выбрано)';
}

function reference(question: Question): string {
  if (isOpenQuestion(question)) {
    return question.answerGuide.normal || question.answerGuide.short || '';
  }
  const correct = new Set(question.correctOptionIds);
  return question.options
    .filter((o) => correct.has(o.id))
    .map((o) => o.text)
    .join('; ');
}

/**
 * System prompt grounding the clarification chat in this specific question: what
 * was asked, the reference answer, the rubric, and the learner's (wrong) answer.
 * The model acts as a mentor who resolves the learner's follow-up questions
 * without drifting off-topic. Pure — easy to test.
 */
export function buildQuestionChatSystem(
  question: Question,
  userAnswer: string,
  verdict: Verdict,
): string {
  const lines = [
    'Ты — наставник по backend-разработке (Java/Kotlin). Студент ошибся на вопросе с собеседования и хочет разобраться.',
    'Отвечай на его уточняющие вопросы по этому вопросу и его теме: объясняй понятно и по делу, с примерами и кодом, где это помогает.',
    'Держись темы вопроса, ничего не выдумывай. Если студент не прав — мягко поправь и объясни почему. Пиши по-русски, кратко, обычным текстом без JSON.',
    '',
    `Вопрос: ${question.prompt}`,
  ];

  const ref = reference(question);
  if (ref) lines.push(`Эталонный ответ: ${ref}`);

  if (isOpenQuestion(question) && question.rubric.length > 0) {
    lines.push(`Критерии хорошего ответа: ${question.rubric.map((c) => c.title).join('; ')}`);
  }
  if (question.answerGuide.traps.length > 0) {
    lines.push(`Типичные ошибки: ${question.answerGuide.traps.join('; ')}`);
  }
  lines.push(`Ответ студента (${VERDICT_RU[verdict]}): ${truncate(userAnswer, MAX_ANSWER)}`);

  return lines.join('\n');
}

/** Sends the chat transcript to the AI, honouring the user's method preference. */
export function askQuestionChat(
  system: string,
  messages: ChatMessage[],
  method: EvalMethod,
): Promise<FreeformResult> {
  return runFreeformChat(system, messages, { method });
}
