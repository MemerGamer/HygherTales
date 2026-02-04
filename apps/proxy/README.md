# HygherTales Proxy

Server-side wrapper for the CurseForge API. Keeps the API key on the server and exposes a small JSON API for the desktop app.

## Environment variables

| Variable | Required | Default | Description |
|--------|----------|---------|-------------|
| `CURSEFORGE_API_KEY` | **Yes** | — | CurseForge API key. Server throws a clear error at startup if missing. |
| `PORT` | No | `8787` | Port to listen on. |
| `CURSEFORGE_GAME_ID` | No | — | CurseForge game ID when needed for API calls. |
| `CORS_ORIGINS` | No | `http://localhost:1420`, `http://localhost:5173`, `http://localhost:3000` | Comma-separated list of allowed origins for CORS. |

Copy `.env.example` to `.env` and set at least `CURSEFORGE_API_KEY`.

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
- `GET /v1/search?q=&page=&pageSize=` — Search mods (stubbed).
- `GET /v1/mod/:projectId` — Mod details (stubbed).
- `GET /v1/mod/:projectId/files` — Mod files (stubbed).
- `POST /v1/resolve-from-url` — Body `{ "url": "..." }`; resolve URL to provider/projectId/slug (stubbed).

Request/response shapes are defined and validated with `@hyghertales/shared`; see `packages/shared/API.md` for examples.

Errors are returned as `{ "code": string, "message": string, "details"?: unknown }` with an appropriate HTTP status.
