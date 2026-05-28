/**
 * Local dev server for the evaluation function. Run with `bun run dev:api`.
 * Vite proxies `/api` here (see vite.config.ts), so the browser calls
 * `/api/evaluate` during development.
 *
 * Requires OPENROUTER_API_KEY in the environment (e.g. a local .env or shell).
 */
import handler from '../api/evaluate.ts';

const port = Number(process.env.PORT ?? 8787);

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/api/evaluate') return handler(req);
    return new Response('not found', { status: 404 });
  },
});

console.log(`[bkdojo] eval API on http://localhost:${port}/api/evaluate`);
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[bkdojo] OPENROUTER_API_KEY is not set — requests will return 500');
}
