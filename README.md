# HygherTales

**Hytale-only** mod launcher: cross-platform desktop app for browsing and managing Hytale mods from CurseForge and Orbis.place, and optionally launching a legally installed Hytale client.

## Prerequisites

- **Bun** – [Install Bun](https://bun.sh)
- **Rust toolchain** – For Tauri desktop app: [rustup](https://rustup.rs) (includes `cargo`)

Optional for desktop packaging:

- **Linux**: `webkit2gtk`, `libappindicator`, etc. (see [Tauri docs](https://v2.tauri.app/start/install/))
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools, WebView2

## Repository structure

```
apps/
  desktop/   # Tauri v2 + React + Vite
  proxy/     # Bun + Hono API (CurseForge + Orbis)
packages/
  shared/    # TypeScript + Zod schemas and types
```

## Setup

From the repo root:

```bash
bun install
```

---

## Running locally (Bun)

### Proxy (required for CurseForge)

From the repo root:

```bash
bun run dev:proxy
```

The API runs at `http://localhost:8787` by default. [http://localhost:8787/health](http://localhost:8787/health) → `{ "ok": true }`.

Copy `apps/proxy/.env.example` to `apps/proxy/.env` and set `CURSEFORGE_API_KEY` and `CURSEFORGE_GAME_ID` (Hytale’s CurseForge game ID). See [apps/proxy/README.md](apps/proxy/README.md) for how to get an API key and the game ID.

### Desktop app

From the repo root:

```bash
bun run dev
```

Or `bun run dev:desktop`. Copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_PROXY_BASE_URL` (e.g. `http://localhost:8787`) so the app talks to your proxy.

### Both together

```bash
bun run dev:all
```

Runs proxy and desktop in parallel.

---

## Running the proxy in Docker

Build from the **repo root**:

```bash
docker build -f apps/proxy/Dockerfile -t hyghertales-proxy .
```

Run (pass API key and game ID at runtime; never bake secrets into the image):

```bash
docker run -p 8787:8787 \
  -e CURSEFORGE_API_KEY=your_key \
  -e CURSEFORGE_GAME_ID=70216 \
  hyghertales-proxy
```

See [apps/proxy/README.md](apps/proxy/README.md) for all env vars (`CORS_ORIGINS`, `RATE_LIMIT_PER_MIN`, etc.).

---

## Pointing the desktop to a hosted proxy

If the proxy runs elsewhere (e.g. your own server or a team deployment):

1. In the desktop app, open **Settings**.
2. Set **Proxy base URL** to your proxy URL (e.g. `https://proxy.example.com`).
3. Ensure the proxy’s `CORS_ORIGINS` includes the origin of the desktop app (for Tauri that may be a custom scheme or `null`; test from the app).

The desktop app never stores or sends API keys; all CurseForge requests go through the proxy, which holds the key on the server only. See [SECURITY.md](SECURITY.md).

## Scripts

| Command               | Description                           |
|-----------------------|---------------------------------------|
| `bun run dev:all`     | Run proxy + desktop (from root)       |
| `bun run dev`         | Run desktop app (from root)           |
| `bun run dev:proxy`   | Run proxy only (from root)            |
| `bun run dev:desktop` | Run desktop only (from root)          |
| `bun run build`       | Build shared, proxy, and desktop      |
| `bun run lint`        | Lint (root or per package)            |
| `bun run format`      | Format with Prettier                  |

## Distribution

- **Releases**: [release-please](https://github.com/googleapis/release-please) manages version bumps and GitHub releases. Merging the automated release PR creates a tag and triggers CI.
- **CI** (`.github/workflows/release-please.yml`): Builds the Tauri desktop app for **Windows**, **macOS**, and **Linux**, and builds the proxy **Docker** image; artifacts are attached to the release. No secrets are stored in the desktop bundle; the proxy expects `CURSEFORGE_API_KEY` only on the server (env or Docker).

## Environment templates

- **apps/proxy/.env.example** – `CURSEFORGE_API_KEY`, `PORT`, optional `CURSEFORGE_GAME_ID`, `CORS_ORIGINS`, `RATE_LIMIT_PER_MIN`
- **apps/desktop/.env.example** – `VITE_PROXY_BASE_URL`

## Tech stack

- **Monorepo**: Bun workspaces
- **Desktop**: Tauri v2, TypeScript, React, Vite
- **Proxy API**: Bun, TypeScript, Hono (CurseForge + Orbis.place, **Hytale mods only**)
- **Shared**: TypeScript, Zod (schemas and types)
- **Tooling**: ESLint, Prettier (root config), TypeScript (base + references)

## Legal

This project does not include any pirated or illegal game files. It does not provide auth bypass or DRM bypass. The app is a **Hytale** mod launcher and can optionally launch a legally installed Hytale client.
