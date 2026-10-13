# syntax=docker/dockerfile:1
# Production image for the VPS (scripts/deploy-vps.sh). Plain `next start`
# rather than `output: "standalone"`: lib/data.ts reads data/streameth.db at
# runtime, and the full tree keeps that path working without extra copying.
# The data files removed after the build are build-db inputs only — the same
# list next.config.ts keeps out of file tracing.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* values are inlined at build time and scripts/check-seo.mjs
# (postbuild) reads Supabase, so the build sees the same env file the
# container runs with — mounted as a secret so it never lands in a layer.
RUN --mount=type=secret,id=env,target=/app/.env.production \
    NODE_OPTIONS=--max-old-space-size=8192 pnpm build \
 && pnpm prune --prod \
 && rm -rf .next/cache data/transcripts.json data/sources/youtube-transcripts.json \
      data/sources/youtube-transcripts data/sources/youtube-metadata.json \
      data/sources/youtube-speakers.json data/sources/mira-ethdenver-2025.json

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
