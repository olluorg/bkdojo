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
 * Whether to ask one clarifying question before settling the verdict. We probe a
 * brief answer that is on track (correct or partial) to check its depth; a
 * clearly wrong answer (verdict `incorrect`) is left to the corrective round and
 * mentor chat, not nagged with a follow-up.
 */
export function shouldClarify(answer: string, evaluation: EvaluationResult | undefined): boolean {
  if (!evaluation) return false;
  if (evaluation.verdict === 'incorrect') return false;
  return wordCount(answer) < BRIEF_WORD_LIMIT;
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
