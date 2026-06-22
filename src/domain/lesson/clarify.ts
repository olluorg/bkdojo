import { runFreeformAi, type FreeformInput, type FreeformResult } from '../evaluation/freeformAi';
import type { AnswerOutcome } from '../models/answer';
import type { EvaluationResult } from '../models/evaluation';
import type { OpenQuestion } from '../models/question';
import type { EvalMethod } from '../models/settings';
import { priorityUncoveredConcept } from './correctiveRound';

/**
 * A short open answer is fine — it shouldn't fail the learner. Below this word
 * count we probe depth with one clarifying question instead of trusting the
 * surface evaluation (directive 3).
 */
export const BRIEF_WORD_LIMIT = 30;

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Whether to give one pre-verdict hint instead of showing the result straight
 * away — so a near-miss doesn't feel like an error first. We probe:
 *  - any `partial` answer ("почти" — a small mistake), regardless of length;
 *  - a brief but `correct` answer, to check its depth (directive 3).
 * A clearly wrong answer (`incorrect`) goes straight to the result/diagnosis.
 */
export function shouldClarify(answer: string, evaluation: EvaluationResult | undefined): boolean {
  if (!evaluation) return false;
  if (evaluation.verdict === 'partial') return true;
  if (evaluation.verdict === 'correct') return wordCount(answer) < BRIEF_WORD_LIMIT;
  return false;
}

/** Builds a prompt for ONE clarifying question probing the weakest concept. */
export function buildClarifyPrompt(
  question: OpenQuestion,
  evaluation: EvaluationResult,
): FreeformInput {
  const probeId = priorityUncoveredConcept(evaluation);
  const probe = question.rubric.find((c) => c.id === probeId) ?? question.rubric[0];

  const system = [
    'Ты — доброжелательный интервьюер по backend-разработке (Java/Kotlin).',
    'Кандидат ответил кратко — это нормально. Не вали его, а проверь глубину.',
    'Задай РОВНО ОДИН короткий уточняющий вопрос, чтобы он мог раскрыть тему глубже.',
    'Не подсказывай ответ, не упоминай критерии. Пиши по-русски, одной строкой, обычным текстом.',
  ].join(' ');

  const lines = [`Вопрос: ${question.prompt}`];
  if (probe) lines.push(`Углуби именно тему: ${probe.title}`);

  return { system, user: lines.join('\n') };
}

/**
 * A deterministic, no-AI nudge for a near-miss: names the weakest uncovered
 * rubric aspect to think about, without revealing the answer. Used when the
 * AI clarifying channel is unavailable so the "almost" second chance still works.
 */
export function fallbackHint(question: OpenQuestion, evaluation: EvaluationResult): string {
  const probeId = priorityUncoveredConcept(evaluation);
  const probe = question.rubric.find((c) => c.id === probeId) ?? question.rubric[0];
  const aspect = probe?.title ?? 'ключевой момент';
  return `Ты почти у цели. Подумай ещё над аспектом «${aspect}» — что здесь важно добавить?`;
}

/** Merges the original answer and the learner's clarification for re-evaluation. */
export function combineAnswers(original: string, clarification: string): string {
  return `${original.trim()}\n\nУточнение: ${clarification.trim()}`;
}

/** Probing must never punish: keep whichever outcome scored higher (ties → newer). */
export function pickBetterOutcome(base: AnswerOutcome, clarified: AnswerOutcome): AnswerOutcome {
  return clarified.score >= base.score ? clarified : base;
}

export interface ClarifyDeps {
  method: EvalMethod;
  /** Injectable for tests; defaults to the Chrome-first → server freeform channel. */
  run?: (input: FreeformInput, method: EvalMethod) => Promise<FreeformResult>;
}

/**
 * Requests one clarifying question from the AI. Returns undefined when no channel
 * is available or it produces nothing — the caller then settles the original
 * verdict without nagging.
 */
export async function requestClarifyingQuestion(
  question: OpenQuestion,
  evaluation: EvaluationResult,
  deps: ClarifyDeps,
): Promise<string | undefined> {
  const run = deps.run ?? ((input, method) => runFreeformAi(input, { method }));
  try {
    const result = await run(buildClarifyPrompt(question, evaluation), deps.method);
    return result.text.trim() || undefined;
  } catch {
    return undefined;
  }
}
