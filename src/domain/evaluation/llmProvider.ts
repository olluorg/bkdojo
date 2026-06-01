/**
 * LLM provider selection for server-side open-answer evaluation.
 *
 * The user picks a provider (which fixes the upstream base URL sent to the
 * micro-platform proxy as `X-Provider-Base-Url`) and may override the model.
 * Both live in localStorage only — never in synced UserProgress — alongside the
 * API key (see providerKey.ts).
 */
export interface LlmProvider {
  id: string;
  label: string;
  /** OpenAI-compatible base URL; the proxy appends "/chat/completions". */
  baseUrl: string;
  defaultModel: string;
}

export const LLM_PROVIDERS: readonly LlmProvider[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  {
    id: 'routerai',
    label: 'routerai.ru',
    baseUrl: 'https://routerai.ru/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
];

const DEFAULT_PROVIDER = LLM_PROVIDERS[0]!;
const PROVIDER_STORAGE_KEY = 'bkdojo.llmProvider';
const MODEL_STORAGE_KEY = 'bkdojo.llmModel';

function read(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(key, trimmed);
    else localStorage.removeItem(key);
  } catch {
    /* ignore storage failures (private mode, quota) */
  }
}

export function getProviderId(): string {
  const id = read(PROVIDER_STORAGE_KEY);
  return LLM_PROVIDERS.some((p) => p.id === id) ? id : DEFAULT_PROVIDER.id;
}

export function setProviderId(id: string): void {
  write(PROVIDER_STORAGE_KEY, id);
}

export function getProvider(): LlmProvider {
  return LLM_PROVIDERS.find((p) => p.id === getProviderId()) ?? DEFAULT_PROVIDER;
}

/** User's explicit model override, or empty when using the provider default. */
export function getModelOverride(): string {
  return read(MODEL_STORAGE_KEY);
}

export function setModelOverride(model: string): void {
  write(MODEL_STORAGE_KEY, model);
}

/** Effective model: the user's override, else the selected provider's default. */
export function getModel(): string {
  return getModelOverride() || getProvider().defaultModel;
}

export function getBaseUrl(): string {
  return getProvider().baseUrl;
}
