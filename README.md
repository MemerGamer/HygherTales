# HygherTales

**Hytale-only** mod launcher: cross-platform desktop app for browsing and managing Hytale mods from CurseForge, and optionally launching a legally installed Hytale client.

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
  proxy/     # Bun + Hono API
packages/
  shared/    # TypeScript + Zod schemas and types
```

## Setup

From the repo root:

```bash
bun install
```

## Running the proxy

From the repo root:

```bash
bun run dev:proxy
```

Or from the proxy app directory:

```bash
bun run --cwd apps/proxy dev
```

The API runs at `http://localhost:8787` by default. Try: [http://localhost:8787/health](http://localhost:8787/health) → `{ "ok": true }`.

Copy `apps/proxy/.env.example` to `apps/proxy/.env` and set `CURSEFORGE_API_KEY` and `CURSEFORGE_GAME_ID` (Hytale's CurseForge game ID). See [apps/proxy/README.md](apps/proxy/README.md) for how to get an API key (fixes 403) and the game ID.

## Running the desktop app

From the repo root:

```bash
bun run dev
```

Or `bun run dev:desktop`. This starts the Vite dev server and opens the Tauri window. Build the shared package once if needed: `bun run build --cwd packages/shared`. Copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_PROXY_BASE_URL` if you use the proxy (e.g. `http://localhost:8787`).

## Running both together

From the repo root:

```bash
bun run dev:all
```

This runs the proxy and the desktop app in parallel (proxy + Tauri dev).

## Scripts

| Command              | Description                          |
|----------------------|--------------------------------------|
| `bun run dev:all`    | Run proxy + desktop (from root)      |
| `bun run dev`        | Run desktop app (from root)          |
| `bun run dev:proxy`  | Run proxy only (from root)           |
| `bun run dev:desktop`| Run desktop only (from root)         |
| `bun run build`      | Build current app / all workspaces  |
| `bun run lint`       | Lint (root or per package)          |
| `bun run format`     | Format with Prettier                |

## Environment templates

- **apps/proxy/.env.example** – `CURSEFORGE_API_KEY`, `PORT`, optional `CURSEFORGE_GAME_ID`
- **apps/desktop/.env.example** – `VITE_PROXY_BASE_URL`

## Tech stack

- **Monorepo**: Bun workspaces
- **Desktop**: Tauri v2, TypeScript, React, Vite
- **Proxy API**: Bun, TypeScript, Hono (CurseForge wrapper, **Hytale mods only**)
- **Shared**: TypeScript, Zod (schemas and types)
- **Tooling**: ESLint, Prettier (root config), TypeScript (base + references)

## Legal

This project does not include any pirated or illegal game files. It does not provide auth bypass or DRM bypass. The app is a **Hytale** mod launcher and can optionally launch a legally installed Hytale client.
