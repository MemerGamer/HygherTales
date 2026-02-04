# HygherTales Proxy

Server-side wrapper for **Hytale mods** from **CurseForge** and **Orbis.place**. CurseForge uses a **single API key** set in `.env` only; Orbis.place requires no API key.

## Getting a CurseForge API key (fixes 403)

A **403** means CurseForge rejected the request — you need a valid API key. Set it **only** in the proxy `.env` as `CURSEFORGE_API_KEY`.

- **CurseForge for Studios:** Use your **organization key** from the Studios console (access to all public games including Hytale).
- **3rd-party key:** [Apply via the CurseForge API key form](https://forms.monday.com/forms/dce5ccb7afda9a1c21dab1a1aa1d84eb?r=use1). After approval, Overwolf emails you a key. Put it in `apps/proxy/.env` as `CURSEFORGE_API_KEY`. [Support article](https://support.curseforge.com/en/support/solutions/articles/9000208346-about-the-curseforge-api-and-how-to-apply-for-a-key).

**If you still get 403:** Check copy/paste (no spaces). Contact [CurseForge support](https://support.curseforge.com/en/support/tickets/new) if a key you were given is rejected.

## Environment variables

| Variable | Required | Default | Description |
|--------|----------|---------|-------------|
| `CURSEFORGE_API_KEY` | **Yes** | — | CurseForge API key. Must be set in `.env`; the proxy uses only this key. |
| `CURSEFORGE_GAME_ID` | **Yes for search/featured** | — | **Hytale’s** CurseForge game ID. Without it, search and featured return no/error. See below. |
| `PORT` | No | `8787` | Port to listen on. |
| `CORS_ORIGINS` | No | `http://localhost:1420`, … | Comma-separated list of allowed origins for CORS. |
| `RATE_LIMIT_PER_MIN` | No | `60` | Per-IP rate limit (requests per minute). |

Copy `.env.example` to `.env`. Set **both** `CURSEFORGE_API_KEY` and `CURSEFORGE_GAME_ID` for featured/search to work.

**Finding Hytale’s game ID:** After you have a valid API key, call CurseForge once to get the list of games and find Hytale’s `id`:

```bash
curl -H "x-api-key: YOUR_API_KEY" "https://api.curseforge.com/v1/games?pageSize=50"
```

Look for the game with `"slug": "hytale"` and set `CURSEFORGE_GAME_ID` to that `id` in `.env`.

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

## Docker

Build from the **repository root** (monorepo context):

```bash
docker build -f apps/proxy/Dockerfile -t hyghertales-proxy .
```

Run with env vars (no secrets in the image):

```bash
docker run -p 8787:8787 \
  -e CURSEFORGE_API_KEY=your_key \
  -e CURSEFORGE_GAME_ID=70216 \
  hyghertales-proxy
```

**Env vars for Docker (same as table above):**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CURSEFORGE_API_KEY` | **Yes** | — | CurseForge API key. Set only at runtime; never baked into the image. |
| `CURSEFORGE_GAME_ID` | **Yes for search/featured** | — | Hytale’s CurseForge game ID (e.g. `70216`). |
| `PORT` | No | `8787` | Port the container listens on (map with `-p`). |
| `CORS_ORIGINS` | No | localhost dev origins | Comma-separated allowed origins. |
| `RATE_LIMIT_PER_MIN` | No | `60` | Per-IP rate limit (requests per minute). |

Example with CORS and rate limit:

```bash
docker run -p 8787:8787 \
  -e CURSEFORGE_API_KEY=xxx \
  -e CURSEFORGE_GAME_ID=70216 \
  -e CORS_ORIGINS=https://myapp.com,https://desktop.local \
  -e RATE_LIMIT_PER_MIN=120 \
  hyghertales-proxy
```

## API (Hytale mods only)

All `/v1/*` endpoints that call CurseForge use **only** the API key from `CURSEFORGE_API_KEY` in the proxy `.env`.

- `GET /health` — Liveness; returns `{ "ok": true }`.
- `GET /v1/featured` — Featured/popular/recently updated **Hytale** mods (requires `CURSEFORGE_GAME_ID`).
- `GET /v1/search?q=&page=&pageSize=&categoryId=&sortField=&sortOrder=` — Search **Hytale** mods. Optional: `categoryId`, `sortField` (1–6), `sortOrder` (asc/desc). Requires `CURSEFORGE_GAME_ID`.
- `GET /v1/categories` — Hytale mod categories for filter dropdown (subcategories under "Mods" class).
- `GET /v1/mod/:projectId` — Mod details.
- `GET /v1/mod/:projectId/files` — Mod files.
- `POST /v1/resolve-from-url` — Body `{ "url": "..." }`; parses CurseForge mod URL and resolves to provider/projectId/slug (requires `CURSEFORGE_GAME_ID`).
- `GET /v1/download/:projectId/:fileId` — Returns JSON `{ "url": string }` (temporary download URL). Use this so the desktop app never needs the API key. Returns `503` with code `DOWNLOAD_NOT_AVAILABLE` when CurseForge does not provide a URL.

**Orbis.place (no API key):**

- `GET /v1/orbis/featured` — First page of Hytale mods from [Orbis.place](https://www.orbis.place/) (same `ModSearchResponse` shape; items have `provider: "orbis"` and `resourceId`).
- `GET /v1/orbis/search?page=1&limit=20&sortBy=date` — Paginated list. Optional `sortBy`: `date`, `downloads`, `name`. No text search; use for browse/pagination.

Request/response shapes are defined and validated with `@hyghertales/shared`; see `packages/shared/API.md` for examples.

Errors are returned as `{ "code": string, "message": string, "details"?: unknown }` with an appropriate HTTP status.

## Tests

```bash
bun test src
```

Covers URL parsing (resolve-from-url), TTL cache behaviour, pure mappers, and the download endpoint (param validation, DOWNLOAD_NOT_AVAILABLE when URL is unavailable).
