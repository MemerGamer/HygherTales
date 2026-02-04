# HygherTales Proxy

Server-side wrapper for the CurseForge API. Keeps the API key on the server and exposes a small JSON API for the desktop app.

## Environment variables

| Variable | Required | Default | Description |
|--------|----------|---------|-------------|
| `CURSEFORGE_API_KEY` | **Yes** | — | CurseForge API key. Server throws a clear error at startup if missing. |
| `PORT` | No | `8787` | Port to listen on. |
| `CURSEFORGE_GAME_ID` | No | — | CurseForge game ID when needed for API calls. |
| `CORS_ORIGINS` | No | `http://localhost:1420`, … | Comma-separated list of allowed origins for CORS. |
| `RATE_LIMIT_PER_MIN` | No | `60` | Per-IP rate limit (requests per minute). |

Copy `.env.example` to `.env` and set at least `CURSEFORGE_API_KEY`.

In-memory cache (60s TTL) is used for search, mod details, and mod files. Rate limiting is applied per IP before route handlers.

## Run

**Development (with hot reload):**

```bash
bun run dev
```

**Production (after build):**

```bash
bun run build
bun run start
```

## API

- `GET /health` — Liveness; returns `{ "ok": true }`.
- `GET /v1/search?q=&page=&pageSize=` — Search mods (CurseForge API; requires `CURSEFORGE_GAME_ID` for results).
- `GET /v1/mod/:projectId` — Mod details.
- `GET /v1/mod/:projectId/files` — Mod files.
- `POST /v1/resolve-from-url` — Body `{ "url": "..." }`; parses CurseForge mod URL and resolves to provider/projectId/slug (requires `CURSEFORGE_GAME_ID`).
- `GET /v1/download/:projectId/:fileId` — Returns JSON `{ "url": string }` (temporary download URL). Use this so the desktop app never needs the API key. Returns `503` with code `DOWNLOAD_NOT_AVAILABLE` when CurseForge does not provide a URL.

Request/response shapes are defined and validated with `@hyghertales/shared`; see `packages/shared/API.md` for examples.

Errors are returned as `{ "code": string, "message": string, "details"?: unknown }` with an appropriate HTTP status.

## Tests

```bash
bun test src
```

Covers URL parsing (resolve-from-url), TTL cache behaviour, pure mappers, and the download endpoint (param validation, DOWNLOAD_NOT_AVAILABLE when URL is unavailable).
