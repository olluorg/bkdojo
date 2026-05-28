# Multi-stage build: bun builds the SPA, runtime serves dist/ + /api/evaluate.

FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install
# Build-time client var (baked into the bundle). Override via compose build args.
ARG VITE_EVAL_ENDPOINT=/api/evaluate
ENV VITE_EVAL_ENDPOINT=$VITE_EVAL_ENDPOINT
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV PORT=3000
# Runtime needs only the build output + the tiny server (no node_modules).
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/api ./api
EXPOSE 3000
# OPENROUTER_API_KEY / OPENROUTER_MODEL are provided at runtime (compose env_file).
CMD ["bun", "server/prod.ts"]
