# Multi-stage build: bun builds the SPA, runtime serves dist/ as static files.

FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install
# Build-time client var (baked into the bundle): the micro-platform LLM proxy URL
# that enables server-side eval. Empty = server evaluator off. Override via build arg.
ARG VITE_EVAL_ENDPOINT=
ENV VITE_EVAL_ENDPOINT=$VITE_EVAL_ENDPOINT
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV PORT=3000
# Runtime needs only the build output + the tiny static server (no node_modules,
# no secrets — open-answer eval now runs against the micro-platform proxy with the
# user's own OpenRouter key, supplied in-app).
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3000
CMD ["bun", "server/prod.ts"]
