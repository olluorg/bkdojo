import { isDifficulty } from '../models/common';
import type { ConceptCoverage, EvaluationResult, EvaluatorId } from '../models/evaluation';
import type { OpenQuestion } from '../models/question';
import { scoreConcepts } from './conceptScoring';

export class EvaluationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationParseError';
  }
}

function isCoverage(value: unknown): value is ConceptCoverage {
  return value === 'covered' || value === 'partial' || value === 'missing';
}

/**
 * Parses model output that may be wrapped in markdown code fences or surrounded
 * by prose (common without enforced structured outputs).
 */
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
    throw new EvaluationParseError('response is not valid JSON');
  }
}

/**
 * Validates and normalizes the model's raw JSON into an EvaluationResult.
 * Throws EvaluationParseError on unusable output so the resolver can fall back.
 * Coverage is taken from the rubric (authoritative); the numeric score is
 * computed from rubric weights, never read from the model.
 */
export function parseEvaluation(
  raw: string,
  question: OpenQuestion,
  source: EvaluatorId = 'chrome-prompt',
): EvaluationResult {
  let data: unknown;
  try {
    data = parseLenient(raw);
  } catch (e) {
    if (e instanceof EvaluationParseError) throw e;
    throw new EvaluationParseError('response is not valid JSON');
  }
  if (typeof data !== 'object' || data === null) {
    throw new EvaluationParseError('response is not an object');
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.concepts)) {
    throw new EvaluationParseError('response.concepts is missing');
  }

  const coverageById = new Map<string, ConceptCoverage>();
  const commentById = new Map<string, string>();
  for (const item of obj.concepts) {
    if (typeof item !== 'object' || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c.conceptId !== 'string' || !isCoverage(c.coverage)) continue;
    coverageById.set(c.conceptId, c.coverage);
    if (typeof c.comment === 'string') commentById.set(c.conceptId, c.comment);
  }

  const scored = scoreConcepts(question.rubric, coverageById, commentById);
  const feedback = typeof obj.feedback === 'string' ? obj.feedback : '';
  const suggestedLevel = isDifficulty(obj.suggestedLevel) ? obj.suggestedLevel : undefined;

  return {
    source,
    status: 'ok',
    score: scored.score,
    verdict: scored.verdict,
    concepts: scored.concepts,
    strengths: scored.strengths,
    gaps: scored.gaps,
    feedback,
    suggestedLevel,
    raw: data,
  };
}
