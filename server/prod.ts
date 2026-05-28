/**
 * Production server for a VPS: serves the built SPA (dist/) and the evaluation
 * API in one Bun process. Run after `bun run build` with `bun run start`.
 *
 * Put it behind a reverse proxy (Caddy/nginx) for TLS. See DEPLOY.md.
 * Env: PORT (default 3000), OPENROUTER_API_KEY (+ OPENROUTER_MODEL) for the API.
 */
import handler from '../api/evaluate.ts';

const port = Number(process.env.PORT ?? 3000);
const distDir = new URL('../dist/', import.meta.url);
const indexHtml = Bun.file(new URL('index.html', distDir));

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/evaluate') return handler(req);

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = Bun.file(new URL(rel, distDir));
    if (await file.exists()) return new Response(file);

    // Hash-router app: unknown paths fall back to index.html.
    return new Response(indexHtml, { headers: { 'content-type': 'text/html' } });
  },
});

console.log(`[bkdojo] serving dist + /api on http://localhost:${port}`);
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[bkdojo] OPENROUTER_API_KEY is not set — open-answer eval will 500');
}
