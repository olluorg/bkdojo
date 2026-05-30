/**
 * Production server for a VPS: serves the built SPA (dist/) in one Bun process.
 * Run after `bun run build` with `bun run start`.
 *
 * Open-answer evaluation no longer runs here — it goes to the micro-platform LLM
 * proxy (`VITE_EVAL_ENDPOINT` → /functions/llm) with the user's own key. This
 * server is now pure static hosting; put it behind a reverse proxy for TLS.
 */
const port = Number(process.env.PORT ?? 3000);
const distDir = new URL('../dist/', import.meta.url);
const indexHtml = Bun.file(new URL('index.html', distDir));

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    // Keep the opener<->popup handle alive for the Google OAuth popup login
    // (the popup visits accounts.google.com, which is COOP:same-origin).
    const spaHeaders = { 'cross-origin-opener-policy': 'same-origin-allow-popups' };

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = Bun.file(new URL(rel, distDir));
    if (await file.exists()) return new Response(file, { headers: spaHeaders });

    // Hash-router app: unknown paths fall back to index.html.
    return new Response(indexHtml, { headers: { 'content-type': 'text/html', ...spaHeaders } });
  },
});

console.log(`[bkdojo] serving dist on http://localhost:${port}`);
