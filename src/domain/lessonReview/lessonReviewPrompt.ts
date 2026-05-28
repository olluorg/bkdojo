import type { Verdict } from '../models/evaluation';

/** One reviewed question: what was asked, what the learner said, what's expected. */
export interface LessonReviewItem {
  prompt: string;
  type: 'open' | 'choice';
  /** The learner's resolved answer (text, chosen options, or a "skipped" note). */
  userAnswer: string;
  /** Reference: model answer (open) or the correct options (choice). */
  reference: string;
  verdict: Verdict;
  /** Titles of rubric concepts left partial/missing (open questions only). */
  missedConcepts: string[];
}

export interface LessonReviewInput {
  lessonTitle: string;
  lessonSummary: string;
  items: LessonReviewItem[];
}

export interface PromptParts {
  system: string;
  user: string;
}

/** Keep the prompt comfortably under the server proxy's 8000-char user limit. */
const MAX_ITEMS = 6;
const MAX_ANSWER = 500;
const MAX_REFERENCE = 400;

const VERDICT_RU: Record<Verdict, string> = {
  correct: 'зачёт',
  partial: 'частично',
  incorrect: 'не зачёт',
};

const SYSTEM = [
  'Ты — наставник по backend-разработке (Java/Kotlin), который готовит к собеседованиям.',
  'Ученик прочитал урок и прошёл тест. Тебе дают тему урока, вопросы, ответы ученика и эталонные ответы.',
  'Объясни персонально, в чём именно ошибся ученик и как отвечать правильно — так, чтобы он понял суть и больше не повторял эти ошибки.',
  'Разбери каждый проблемный вопрос отдельно: коротко, по делу, с акцентом на пробел в понимании, а не на формулировку.',
  'В конце дай короткий список из 2–4 рекомендаций, что повторить.',
  'Пиши по-русски, дружелюбно, но конкретно. Обычный текст с короткими абзацами, без JSON и без markdown-заголовков.',
].join(' ');

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Builds the system + user prompt for a personalized lesson-mistakes comment. */
export function buildLessonReviewPrompt(input: LessonReviewInput): PromptParts {
  const items = input.items.slice(0, MAX_ITEMS);

  const blocks = items.map((item, i) => {
    const lines = [
      `Вопрос ${i + 1} (${VERDICT_RU[item.verdict]}): ${item.prompt}`,
      `Ответ ученика: ${truncate(item.userAnswer, MAX_ANSWER) || '(пусто)'}`,
      `Эталон: ${truncate(item.reference, MAX_REFERENCE) || '(нет)'}`,
    ];
    if (item.missedConcepts.length > 0) {
      lines.push(`Не раскрыто: ${item.missedConcepts.join(', ')}`);
    }
    return lines.join('\n');
  });

  const user = [
    `Тема урока: ${input.lessonTitle}`,
    `Кратко: ${input.lessonSummary}`,
    '',
    'Проблемные вопросы и ответы ученика:',
    '',
    blocks.join('\n\n'),
    '',
    'Разбери ошибки ученика по пунктам и заверши списком рекомендаций.',
  ].join('\n');

  return { system: SYSTEM, user };
}
