# HygherTales Proxy

Server API for Hytale mods from CurseForge and Orbis.place. CurseForge requires an API key (set on server only). Orbis.place requires no key.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CURSEFORGE_API_KEY` | Yes | — | CurseForge API key (server only, never in desktop) |
| `CURSEFORGE_GAME_ID` | Yes | — | Hytale's game ID (typically `70216`) |
| `PORT` | No | `8787` | Server port |
| `CORS_ORIGINS` | No | localhost dev origins | Comma-separated allowed origins |
| `RATE_LIMIT_PER_MIN` | No | `60` | Per-IP rate limit |

Copy `.env.example` to `.env` and set at minimum `CURSEFORGE_API_KEY` and `CURSEFORGE_GAME_ID`.

---

## Getting a CurseForge API key

**403 error = missing or invalid API key.**

Get a key from:
- [CurseForge for Studios](https://console.curseforge.com/) (if you have an org)
- [3rd-party API key form](https://forms.monday.com/forms/dce5ccb7afda9a1c21dab1a1aa1d84eb?r=use1) (Overwolf emails you after approval)

[CurseForge API key support article](https://support.curseforge.com/en/support/solutions/articles/9000208346)

Set in `apps/proxy/.env`:

```
CURSEFORGE_API_KEY=your_key_here
```

**Keys with special characters (e.g. `$2a$10$...`) work correctly** — paste them as-is with no escaping needed.

**If you still get 403:**

1. **No quotes** – Use `CURSEFORGE_API_KEY=abc123` not `CURSEFORGE_API_KEY="abc123"`.
2. **No extra spaces or newlines** – Paste the key on a single line with no space after `=`.
3. **Verify the key** – From a terminal:
   ```bash
   curl -H "x-api-key: YOUR_KEY_HERE" "https://api.curseforge.com/v1/games?pageSize=5"
   ```
   If you get JSON with a `data` array, the key works. If you get 403, the key is invalid or not yet active.
4. **Activation delay** – Keys from the [3rd-party form](https://forms.monday.com/forms/dce5ccb7afda9a1c21dab1a1aa1d84eb?r=use1) can take a short time to activate after approval.
5. **Run from proxy directory** – When running the server, use `bun run dev:proxy` from the repo root (so the proxy runs with `apps/proxy` as cwd and loads `.env`), or run `bun run dev` from `apps/proxy`.

---

## Finding Hytale's game ID

After getting a valid API key:

```bash
curl -H "x-api-key: YOUR_KEY" "https://api.curseforge.com/v1/games?pageSize=50"
```

Find the game with `"slug": "hytale"` and use its `id`. Set in `.env`:

```
CURSEFORGE_GAME_ID=70216
```

---

## Development

```bash
bun run dev
```

Hot reload enabled. Server at `http://localhost:8787`.

---

## Production

```bash
bun run build
bun run start
```

---

## Docker

Build from repository root:

```bash
docker build -f apps/proxy/Dockerfile -t hyghertales-proxy .
```

Run (secrets via env, not baked in):

```bash
docker run -p 8787:8787 \
  -e CURSEFORGE_API_KEY=your_key \
  -e CURSEFORGE_GAME_ID=70216 \
  hyghertales-proxy
```

**With CORS and rate limit:**

```bash
docker run -p 8787:8787 \
  -e CURSEFORGE_API_KEY=xxx \
  -e CURSEFORGE_GAME_ID=70216 \
  -e CORS_ORIGINS=https://myapp.com,https://desktop.local \
  -e RATE_LIMIT_PER_MIN=120 \
  hyghertales-proxy
```

---

## API

All endpoints return JSON. Errors: `{ "code": string, "message": string }`.

**CurseForge (uses API key from env):**

- `GET /health` → `{ "ok": true }`
- `GET /v1/featured` → Featured Hytale mods
- `GET /v1/search?q=&page=&pageSize=` → Search mods
- `GET /v1/categories` → Mod categories
- `GET /v1/mod/curseforge/:projectId` → Mod details
- `GET /v1/mod/curseforge/:projectId/files` → Mod files/versions
- `GET /v1/download/curseforge/:projectId/:fileId` → Download URL
- `POST /v1/resolve-from-url` (body: `{ "url": "..." }`) → Parse CurseForge URL

**Orbis.place (no API key):**

- `GET /v1/orbis/featured` → Featured mods
- `GET /v1/orbis/search?page=&limit=&sortBy=` → Paginated mods
- `GET /v1/mod/orbis/:resourceId` → Mod details
- `GET /v1/mod/orbis/:resourceId/files` → Mod files
- `GET /v1/download/orbis/:resourceId/:versionId/:fileIndex` → Download URL

Schemas in `packages/shared/API.md`.

---

## Rate limiting & caching

- Per-IP rate limit (default 60 req/min, configurable)
- In-memory cache (60s TTL) for search, mod details, files

---

## Tests

```bash
bun test src
```

Covers URL parsing, cache behavior, mappers, download endpoint.
