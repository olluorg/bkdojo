import type {
  AiAvailability,
  AnswerEvaluator,
  EvaluationInput,
  EvaluationResult,
} from '../models/evaluation';
import { buildEvaluationPrompt } from './evaluationPrompt';
import { buildEvaluationSchema } from './evaluationSchema';
import { parseEvaluation } from './parseEvaluation';

export class ServerEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerEvaluatorError';
  }
}

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ServerDeps {
  /** Evaluation endpoint; empty string disables the server evaluator. */
  endpoint: string;
  timeoutMs: number;
  fetchFn: FetchFn;
}

/** Endpoint comes from build-time env so it's opt-in (no surprise paid calls). */
export function serverEndpoint(): string {
  return import.meta.env?.VITE_EVAL_ENDPOINT ?? '';
}

const defaultDeps: ServerDeps = {
  endpoint: serverEndpoint(),
  timeoutMs: 30_000,
  fetchFn: (input, init) => fetch(input, init),
};

/**
 * Open-answer evaluator backed by a serverless proxy that calls OpenRouter.
 * The client only sends the prompt + schema (built locally) — the API key
 * lives on the server. Reuses the same prompt/schema/parse as ChromePromptEvaluator,
 * so the rest of the app is unchanged.
 */
export class ServerAiEvaluator implements AnswerEvaluator {
  readonly id = 'server' as const;

  constructor(private readonly deps: ServerDeps = defaultDeps) {}

  availability(): Promise<AiAvailability> {
    return Promise.resolve(this.deps.endpoint ? 'available' : 'unavailable');
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    if (!this.deps.endpoint) throw new ServerEvaluatorError('server endpoint is not configured');

    const { system, user } = buildEvaluationPrompt(input);
    const schema = buildEvaluationSchema(input.question.rubric.map((c) => c.id));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.timeoutMs);
    try {
      const res = await this.deps.fetchFn(this.deps.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system, user, schema }),
        signal: controller.signal,
      });
      if (!res.ok) throw new ServerEvaluatorError(`server responded with ${res.status}`);
      const raw = await res.text();
      return parseEvaluation(raw, input.question, 'server');
    } finally {
      clearTimeout(timer);
    }
  }
}
