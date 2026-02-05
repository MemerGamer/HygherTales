# HygherTales proxy – build and run with Bun.
# Build from repo root: docker build -f apps/proxy/Dockerfile .
# Run: docker run -p 8787:8787 -e CURSEFORGE_API_KEY=xxx -e CURSEFORGE_GAME_ID=70216 hyghertales-proxy

FROM oven/bun:1.3 AS builder

WORKDIR /app

# Workspace root and shared package (needed for proxy build)
COPY package.json bun.lock* ./
COPY packages/shared packages/shared
COPY apps/proxy apps/proxy

# Partial workspace copy: lockfile is for full monorepo, so we install without frozen lockfile
RUN bun install

# Build only shared and proxy (do not run root build script; it would try to build desktop too)
RUN cd packages/shared && bun run build
RUN cd apps/proxy && bun run build

# Production image
FROM oven/bun:1.3-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY --from=builder /app .
WORKDIR /app/apps/proxy

EXPOSE 8787

# Config via env only (no secrets in image). See apps/proxy/README.md and root README.
# Required: CURSEFORGE_API_KEY, CURSEFORGE_GAME_ID (e.g. 70216 for Hytale)
# Optional: PORT, CORS_ORIGINS, RATE_LIMIT_PER_MIN
CMD ["bun", "run", "dist/index.js"]
