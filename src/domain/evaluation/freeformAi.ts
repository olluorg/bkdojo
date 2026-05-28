import type { LanguageModelStatic } from '../../types/chrome-ai';
import type { EvalMethod } from '../models/settings';
import { serverEndpoint, type FetchFn } from './ServerAiEvaluator';

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
  fetchFn: FetchFn;
  timeoutMs: number;
  /** User preference; mirrors the evaluator resolver (auto/chrome/server/manual). */
  method: EvalMethod;
}

function defaultDeps(): FreeformDeps {
  return {
    getModel: () => globalThis.LanguageModel,
    endpoint: serverEndpoint(),
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
  if (!deps.endpoint) return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const res = await deps.fetchFn(deps.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system: input.system, user: input.user }),
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    const text = (await res.text()).trim();
    return text || undefined;
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
 * roles; the server proxy (which takes only system+user) receives the transcript
 * flattened into the user message, so no server change is needed.
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
