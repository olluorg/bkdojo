/**
 * The user's own LLM provider (OpenRouter) API key for server-side open-answer
 * evaluation.
 *
 * Kept in localStorage and sent per-request to the micro-platform LLM proxy as
 * the `X-Provider-Key` header. It is deliberately NOT part of the synced
 * progress (UserProgress), so the key is never pushed to the sync server.
 */
const STORAGE_KEY = 'bkdojo.providerKey';

export function getProviderKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setProviderKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage failures (private mode, quota) */
  }
}
