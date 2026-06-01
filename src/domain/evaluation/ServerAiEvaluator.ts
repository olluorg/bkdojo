import type {
  AiAvailability,
  AnswerEvaluator,
  EvaluationInput,
  EvaluationResult,
} from '../models/evaluation';
import { buildEvaluationPrompt } from './evaluationPrompt';
import { parseEvaluation } from './parseEvaluation';
import { getProviderKey } from './providerKey';
import { getBaseUrl, getModel } from './llmProvider';

export class ServerEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerEvaluatorError';
  }
}

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ServerDeps {
  /** LLM proxy endpoint (micro-platform /functions/llm); empty disables it. */
  endpoint: string;
  /** Caller's provider key, sent as X-Provider-Key; empty disables it. */
  apiKey: string;
  /** Provider base URL, sent as X-Provider-Base-Url; empty = server default. */
  baseUrl: string;
  /** Model id forwarded in the request body; empty = server default. */
  model: string;
  timeoutMs: number;
  fetchFn: FetchFn;
}

/** Endpoint comes from build-time env so it's opt-in (no surprise paid calls). */
export function serverEndpoint(): string {
  return import.meta.env?.VITE_EVAL_ENDPOINT ?? '';
}

function liveDeps(): ServerDeps {
  return {
    endpoint: serverEndpoint(),
    apiKey: getProviderKey(),
    baseUrl: getBaseUrl(),
    model: getModel(),
    timeoutMs: 30_000,
    fetchFn: (input, init) => fetch(input, init),
  };
}

/**
 * Open-answer evaluator backed by the micro-platform LLM proxy (`/functions/llm`),
 * a generic OpenAI-compatible passthrough. The client builds the prompt locally
 * and brings its own OpenRouter key (sent as `X-Provider-Key`), so no key lives
 * on any bkdojo server. Reuses the same prompt/parse as ChromePromptEvaluator,
 * so the rest of the app is unchanged.
 */
export class ServerAiEvaluator implements AnswerEvaluator {
  readonly id = 'server' as const;

  constructor(private readonly deps: ServerDeps = liveDeps()) {}

  availability(): Promise<AiAvailability> {
    return Promise.resolve(this.deps.endpoint && this.deps.apiKey ? 'available' : 'unavailable');
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    if (!this.deps.endpoint) throw new ServerEvaluatorError('server endpoint is not configured');
    if (!this.deps.apiKey) throw new ServerEvaluatorError('provider API key is not set');

    const { system, user } = buildEvaluationPrompt(input);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-provider-key': this.deps.apiKey,
    };
    if (this.deps.baseUrl) headers['x-provider-base-url'] = this.deps.baseUrl;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.timeoutMs);
    try {
      const res = await this.deps.fetchFn(this.deps.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(this.deps.model ? { model: this.deps.model } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new ServerEvaluatorError(`server responded with ${res.status}`);
      // The proxy returns the upstream chat-completion verbatim; pull the content.
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new ServerEvaluatorError('no content in model response');
      return parseEvaluation(content, input.question, 'server');
    } finally {
      clearTimeout(timer);
    }
  }
}
