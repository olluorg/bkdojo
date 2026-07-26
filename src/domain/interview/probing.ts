import { runFreeformAi, type FreeformInput, type FreeformResult } from '../evaluation/freeformAi';
import type { AnswerOutcome } from '../models/answer';
import type { ConceptCoverage, EvaluationResult } from '../models/evaluation';
import type { EvaluationConcept, OpenQuestion } from '../models/question';
import type { EvalMethod } from '../models/settings';

/**
 * The interviewer loop.
 *
 * This module encodes a product decision: the AI is a *sparring partner*, not a
 * judge. Settling a verdict on a single answer is what an exam does, and it makes
 * the learner defensive — you find out you were wrong, not how to be right. A
 * real interviewer keeps asking "why?" until the depth is established, and that
 * is the thing actually worth rehearsing.
 *
 * So an open answer opens a short dialogue: up to `MAX_PROBES` follow-ups, each
 * aimed at the weakest gap the evaluator found, with the verdict settled only at
 * the end from the whole transcript. Being pressed can never lower the score
 * (see `pickBetterOutcome`) — pressure has to feel like a chance, not a trap.
 */

/** Ceiling on follow-ups: past this it stops being practice and becomes a grind. */
export const MAX_PROBES = 3;

export interface InterviewTurn {
  /** What the interviewer asked. */
  question: string;
  /** What the learner answered. */
  answer: string;
}

/** `missing` gaps are worth probing before merely `partial` ones. */
const COVERAGE_RANK: Record<ConceptCoverage, number> = { missing: 0, partial: 1, covered: 2 };

/**
 * The rubric concept the interviewer should press on next, or `undefined` when
 * the dialogue is over — the turn ceiling is reached, the evaluator produced
 * nothing, or every concept is either covered or already probed.
 *
 * A fully covered answer yields `undefined` and gets its verdict immediately: a
 * complete answer must not be nagged, or the dialogue reads as punishment.
 *
 * So does a clearly wrong one. Pressing someone who does not know the topic
 * produces nothing but three rounds of humiliation — that case belongs to the
 * explanation and the mentor chat, which is where it already went before this
 * loop existed.
 *
 * Ranking: `missing` before `partial`, then heavier rubric weight, then required
 * before optional, then rubric order (stable and content-authored).
 */
export function nextProbeConcept(
  question: OpenQuestion,
  evaluation: EvaluationResult | undefined,
  probedConceptIds: readonly string[],
  turns: number,
): EvaluationConcept | undefined {
  if (!evaluation) return undefined;
  if (evaluation.verdict === 'incorrect') return undefined;
  if (turns >= MAX_PROBES) return undefined;

  const probed = new Set(probedConceptIds);
  const byId = new Map(question.rubric.map((concept) => [concept.id, concept]));
  const rubricOrder = new Map(question.rubric.map((concept, i) => [concept.id, i]));

  const candidates: { coverage: ConceptCoverage; concept: EvaluationConcept }[] = [];
  for (const result of evaluation.concepts) {
    if (result.coverage === 'covered') continue;
    if (probed.has(result.conceptId)) continue;
    const concept = byId.get(result.conceptId);
    if (!concept) continue; // evaluator hallucinated an id — ignore it
    candidates.push({ coverage: result.coverage, concept });
  }

  candidates.sort((a, b) => {
    const byCoverage = COVERAGE_RANK[a.coverage] - COVERAGE_RANK[b.coverage];
    if (byCoverage !== 0) return byCoverage;
    if (a.concept.weight !== b.concept.weight) return b.concept.weight - a.concept.weight;
    if (a.concept.required !== b.concept.required) return a.concept.required ? -1 : 1;
    return (rubricOrder.get(a.concept.id) ?? 0) - (rubricOrder.get(b.concept.id) ?? 0);
  });

  return candidates[0]?.concept;
}

/**
 * Renders the whole dialogue as one answer for the final evaluation, so the
 * verdict reflects everything the learner said — not just the opening. Empty
 * turns (skipped follow-ups) are dropped.
 */
export function combineTranscript(original: string, turns: readonly InterviewTurn[]): string {
  const parts = [original.trim()];
  for (const turn of turns) {
    const answer = turn.answer.trim();
    if (!answer) continue;
    parts.push(`Вопрос интервьюера: ${turn.question.trim()}\nОтвет: ${answer}`);
  }
  return parts.join('\n\n');
}

/**
 * Probing must never punish: keep whichever outcome scored higher (ties → newer,
 * so a dialogue that merely confirms the answer still records the fresh result).
 */
export function pickBetterOutcome(base: AnswerOutcome, probed: AnswerOutcome): AnswerOutcome {
  return probed.score >= base.score ? probed : base;
}

/** Builds the prompt for ONE follow-up question aimed at `concept`. */
export function buildProbePrompt(
  question: OpenQuestion,
  concept: EvaluationConcept,
  turns: readonly InterviewTurn[],
): FreeformInput {
  const system = [
    'Ты — интервьюер на техническом собеседовании по backend-разработке (Java/Kotlin).',
    'Ты не оцениваешь ответ и не объясняешь материал — ты копаешь глубже, как живой интервьюер.',
    'Задай РОВНО ОДИН короткий вопрос по теме, которую кандидат не раскрыл.',
    'Спрашивай «почему», «а если», «как это устроено под капотом».',
    'Не подсказывай ответ и не называй критерии оценки.',
    'Пиши по-русски, одной строкой, обычным текстом без markdown.',
  ].join(' ');

  const lines = [
    `Исходный вопрос: ${question.prompt}`,
    `Кандидат не раскрыл: ${concept.title} — ${concept.description}`,
  ];
  if (turns.length > 0) {
    lines.push('Уже спрошено — не повторяйся:');
    for (const turn of turns) lines.push(`— ${turn.question}`);
  }

  return { system, user: lines.join('\n') };
}

export interface ProbeDeps {
  method: EvalMethod;
  /** Injectable for tests; defaults to the Chrome-first → server freeform channel. */
  run?: (input: FreeformInput, method: EvalMethod) => Promise<FreeformResult>;
}

/**
 * Asks the AI for the next follow-up. Returns `undefined` when no channel is
 * available or it produces nothing — the caller then settles the verdict rather
 * than blocking the session on a missing interviewer.
 */
export async function requestProbe(
  question: OpenQuestion,
  concept: EvaluationConcept,
  turns: readonly InterviewTurn[],
  deps: ProbeDeps,
): Promise<string | undefined> {
  const run = deps.run ?? ((input, method) => runFreeformAi(input, { method }));
  try {
    const result = await run(buildProbePrompt(question, concept, turns), deps.method);
    return result.text.trim() || undefined;
  } catch {
    return undefined;
  }
}
