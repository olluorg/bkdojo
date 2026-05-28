import { runFreeformAi, type FreeformInput, type FreeformResult } from '../evaluation/freeformAi';
import type { Difficulty } from '../models/common';
import type { EvalMethod } from '../models/settings';
import type { OpenQuestion, Question } from '../models/question';
import { validateQuestions } from '../content/questionValidation';
import { GENERATED_SOURCE } from '../content/generatedQuestions';

export interface GenerateFollowupDeps {
  method: EvalMethod;
  /** Injectable for tests; defaults to the Chrome-first → server freeform channel. */
  run?: (input: FreeformInput, method: EvalMethod) => Promise<FreeformResult>;
}

/** Stable id so the same (question, concept) gap reuses one cached follow-up. */
export function followupId(sourceId: string, conceptId: string): string {
  return `gen-${sourceId}-${conceptId}`;
}

function buildPrompt(source: Question, conceptTitle: string): FreeformInput {
  const system = [
    'Ты — наставник по backend-разработке (Java/Kotlin).',
    'Студент частично ответил на вопрос с собеседования и не раскрыл одну тему.',
    'Сформулируй ОДИН короткий уточняющий вопрос ровно про эту тему, чтобы дать ему добрать именно её.',
    'Вопрос должен быть простым и конкретным, без воды. Верни ТОЛЬКО валидный JSON без markdown и текста вокруг.',
  ].join(' ');

  const user = [
    `Исходный вопрос: ${source.prompt}`,
    `Непокрытая тема: ${conceptTitle}`,
    '',
    'Верни СТРОГО такой JSON:',
    '{',
    '  "prompt": "<короткий вопрос ровно про непокрытую тему>",',
    '  "concept": { "title": "<краткое название критерия>", "description": "<что должен раскрыть ответ>" },',
    '  "answerGuide": {',
    '    "short": "<эталонный ответ в 1–2 предложениях>",',
    '    "normal": "<более полный ответ>",',
    '    "traps": ["<типичная ошибка>"],',
    '    "followUps": ["<возможный доп. вопрос>"]',
    '  }',
    '}',
  ].join('\n');

  return { system, user };
}

function parseLenient(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new Error('not JSON');
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Assembles the model's JSON into a validated open question focused on the
 * missing concept, tagged as AI-generated. Returns undefined if the payload is
 * unusable so the caller can fall back to re-asking the source question.
 */
function assemble(raw: string, source: Question, conceptId: string): OpenQuestion | undefined {
  let data: Record<string, unknown>;
  try {
    const parsed = parseLenient(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    data = parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const prompt = asString(data.prompt);
  const concept = (data.concept ?? {}) as Record<string, unknown>;
  const guide = (data.answerGuide ?? {}) as Record<string, unknown>;
  const conceptTitle = asString(concept.title);
  const conceptDescription = asString(concept.description);
  const short = asString(guide.short);
  const normal = asString(guide.normal);
  if (!prompt || !conceptTitle || !conceptDescription || !short || !normal) return undefined;

  // Probe one notch easier than the source, never below 1.
  const difficulty = Math.max(1, source.difficulty - 1) as Difficulty;

  const candidate = {
    id: followupId(source.id, conceptId),
    domain: source.domain,
    difficulty,
    type: 'open' as const,
    mode: 'definition' as const,
    prompt,
    tags: source.tags,
    rubric: [
      { id: conceptId, title: conceptTitle, description: conceptDescription, required: true, weight: 1 },
    ],
    answerGuide: { short, normal, traps: asStringArray(guide.traps), followUps: asStringArray(guide.followUps) },
    meta: { verified: false, source: GENERATED_SOURCE },
  };

  const { valid } = validateQuestions([candidate], { expectedDomain: source.domain });
  return valid[0] as OpenQuestion | undefined;
}

/**
 * Generates a short follow-up open question that probes only `conceptId`. Returns
 * undefined when no AI channel is available or the output can't be parsed — the
 * corrective round then falls back to re-asking the original question.
 */
export async function generateFollowupQuestion(
  source: Question,
  conceptId: string,
  conceptTitle: string,
  deps: GenerateFollowupDeps,
): Promise<OpenQuestion | undefined> {
  const run = deps.run ?? ((input, method) => runFreeformAi(input, { method }));
  try {
    const result = await run(buildPrompt(source, conceptTitle), deps.method);
    return assemble(result.text, source, conceptId);
  } catch {
    return undefined;
  }
}
