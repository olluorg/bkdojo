/**
 * Serverless evaluation proxy → OpenRouter.
 *
 * Platform-agnostic Fetch handler `(Request) => Response` — runs on Vercel Edge,
 * Cloudflare Workers, Deno, or Bun (see ../server/dev.ts for local dev).
 *
 * The browser sends only the prompt + JSON schema (built client-side); the
 * OpenRouter API key never leaves the server. The model's raw JSON is returned
 * to the client, which normalizes it via `parseEvaluation`.
 *
 * Env: OPENROUTER_API_KEY (required), OPENROUTER_MODEL (optional),
 *      OPENROUTER_BASE_URL (optional, default https://openrouter.ai/api/v1 — for
 *        OpenAI-compatible gateways/proxies), OPENROUTER_URL (optional, full
 *        completions URL that overrides the base),
 *      OPENROUTER_REFERER (optional, for OpenRouter attribution),
 *      ALLOWED_ORIGIN (optional CORS allowlist; defaults to reflecting Origin).
 *
 * NOTE: intentionally excluded from the app tsconfig (different runtime/globals).
 */

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function completionsUrl(): string {
  if (process.env.OPENROUTER_URL) return process.env.OPENROUTER_URL;
  const base = (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

function corsHeaders(origin: string): Record<string, string> {
  const allow = process.env.ALLOWED_ORIGIN || origin || '*';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: 'OPENROUTER_API_KEY is not set on the server' }, 500, origin);

  let body: { system?: unknown; user?: unknown; schema?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400, origin);
  }

  const { system, user, schema } = body;
  if (typeof system !== 'string' || typeof user !== 'string') {
    return json({ error: 'fields "system" and "user" (strings) are required' }, 400, origin);
  }
  if (user.length > 8000) return json({ error: 'answer is too long' }, 413, origin);

  const basePayload: Record<string, unknown> = {
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  // Structured outputs (json_schema) are fragile across OpenRouter providers, so
  // they're OFF by default: the system prompt already demands strict JSON and the
  // client validates it. Enable with OPENROUTER_STRUCTURED_OUTPUTS=1 for providers
  // that support them.
  const useSchema =
    !!schema && typeof schema === 'object' && process.env.OPENROUTER_STRUCTURED_OUTPUTS === '1';
  const url = completionsUrl();

  const call = (extra: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_REFERER || '',
        'X-Title': 'bkdojo',
      },
      body: JSON.stringify({ ...basePayload, ...extra }),
    });

  let upstream: Response;
  try {
    upstream = await call(
      useSchema
        ? { response_format: { type: 'json_schema', json_schema: { name: 'evaluation', strict: true, schema } } }
        : {},
    );
    // Many providers reject json_schema (and OpenRouter may wrap that as 5xx, not
    // 400). On ANY failure when a schema was sent, retry once without it — the
    // prompt already demands strict JSON and the client validates the result.
    if (!upstream.ok && useSchema) {
      upstream = await call({});
    }
  } catch {
    return json({ error: 'upstream request failed' }, 502, origin);
  }

  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 500);
    return json({ error: 'openrouter error', status: upstream.status, detail }, 502, origin);
  }

  const data = await upstream.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return json({ error: 'no content in model response' }, 502, origin);

  // Return the model's raw JSON string; the client runs parseEvaluation on it.
  return new Response(content, {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}
