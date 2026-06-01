import type { LanguageModelStatic } from '../../types/chrome-ai';
import type { EvalMethod } from '../models/settings';
import { serverEndpoint, type FetchFn } from './ServerAiEvaluator';
import { getProviderKey } from './providerKey';
import { getBaseUrl, getModel } from './llmProvider';

/**
 * Free-form AI text generation, distinct from rubric-based answer evaluation.
 *
 * Answer scoring goes through `AnswerEvaluator` → `EvaluationResult`. Some
 * features (e.g. a personalized lesson comment) instead need plain prose. This
 * keeps that path behind the same Chrome-first → server preference, and — like
 * the evaluator surface — is the only other place besides `aiCapability` /
 * `ChromePromptEvaluator` that touches the global `LanguageModel`.
 */

export type FreeformSource = 'chrome-prompt' | 'server';

export interface FreeformInput {
  system: string;
  user: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FreeformResult {
  source: FreeformSource;
  text: string;
}

export class FreeformUnavailableError extends Error {
  constructor(message = 'No AI channel is available for free-form generation') {
    super(message);
    this.name = 'FreeformUnavailableError';
  }
}

export interface FreeformDeps {
  getModel: () => LanguageModelStatic | undefined;
  endpoint: string;
  /** Caller's provider key, sent as X-Provider-Key; empty disables the server. */
  apiKey: string;
  /** Provider base URL, sent as X-Provider-Base-Url; empty = server default. */
  baseUrl: string;
  /** Model id forwarded in the request body; empty = server default. */
  model: string;
  fetchFn: FetchFn;
  timeoutMs: number;
  /** User preference; mirrors the evaluator resolver (auto/chrome/server/manual). */
  method: EvalMethod;
}

function defaultDeps(): FreeformDeps {
  return {
    getModel: () => globalThis.LanguageModel,
    endpoint: serverEndpoint(),
    apiKey: getProviderKey(),
    baseUrl: getBaseUrl(),
    model: getModel(),
    fetchFn: (input, init) => fetch(input, init),
    timeoutMs: 30_000,
    method: 'auto',
  };
}

async function tryChrome(input: FreeformInput, deps: FreeformDeps): Promise<string | undefined> {
  const model = deps.getModel();
  if (!model) return undefined;
  try {
    if ((await model.availability()) !== 'available') return undefined;
  } catch {
    return undefined;
  }

  const session = await model.create({
    initialPrompts: [{ role: 'system', content: input.system }],
    temperature: 0.4,
    topK: 3,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const text = await session.prompt(input.user, { signal: controller.signal });
    return text.trim() || undefined;
  } finally {
    clearTimeout(timer);
    session.destroy();
  }
}

async function tryServer(input: FreeformInput, deps: FreeformDeps): Promise<string | undefined> {
  if (!deps.endpoint || !deps.apiKey) return undefined;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-provider-key': deps.apiKey,
  };
  if (deps.baseUrl) headers['x-provider-base-url'] = deps.baseUrl;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const res = await deps.fetchFn(deps.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...(deps.model ? { model: deps.model } : {}),
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    // The proxy returns the upstream chat-completion verbatim; pull the content.
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates free-form text from the best available AI channel, honouring the
 * user's evaluation-method preference. Throws `FreeformUnavailableError` when no
 * channel can produce a result (e.g. `manual`, or Chrome AI off with no server).
 */
export async function runFreeformAi(
  input: FreeformInput,
  overrides: Partial<FreeformDeps> = {},
): Promise<FreeformResult> {
  const deps = { ...defaultDeps(), ...overrides };

  const wantChrome = deps.method === 'auto' || deps.method === 'chrome';
  const wantServer = deps.method === 'auto' || deps.method === 'server';

  if (wantChrome) {
    const text = await tryChrome(input, deps);
    if (text) return { source: 'chrome-prompt', text };
  }
  if (wantServer) {
    const text = await tryServer(input, deps);
    if (text) return { source: 'server', text };
  }
  throw new FreeformUnavailableError();
}

/** Renders a transcript as a single labelled string (server fallback path). */
function flattenTranscript(messages: ChatMessage[]): string {
  const lines = messages.map(
    (m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`,
  );
  lines.push('Ассистент:'); // cue the model to continue
  return lines.join('\n\n');
}

async function chromeChat(
  system: string,
  messages: ChatMessage[],
  deps: FreeformDeps,
): Promise<string | undefined> {
  const model = deps.getModel();
  if (!model || messages.length === 0) return undefined;
  try {
    if ((await model.availability()) !== 'available') return undefined;
  } catch {
    return undefined;
  }

  const last = messages[messages.length - 1]!;
  const session = await model.create({
    initialPrompts: [{ role: 'system', content: system }, ...messages.slice(0, -1)],
    temperature: 0.4,
    topK: 3,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const text = await session.prompt(last.content, { signal: controller.signal });
    return text.trim() || undefined;
  } finally {
    clearTimeout(timer);
    session.destroy();
  }
}

/**
 * Multi-turn chat against the best available AI channel. Chrome AI keeps native
 * roles; the server path sends a single system+user pair (the transcript is
 * flattened into the user message), matching the non-chat free-form request.
 */
export async function runFreeformChat(
  system: string,
  messages: ChatMessage[],
  overrides: Partial<FreeformDeps> = {},
): Promise<FreeformResult> {
  const deps = { ...defaultDeps(), ...overrides };

  const wantChrome = deps.method === 'auto' || deps.method === 'chrome';
  const wantServer = deps.method === 'auto' || deps.method === 'server';

  if (wantChrome) {
    const text = await chromeChat(system, messages, deps);
    if (text) return { source: 'chrome-prompt', text };
  }
  if (wantServer) {
    const text = await tryServer({ system, user: flattenTranscript(messages) }, deps);
    if (text) return { source: 'server', text };
  }
  throw new FreeformUnavailableError();
}
