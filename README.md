# HygherTales

Cross-platform desktop app for managing mods and optionally launching a legally installed game.

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

```bash
bun run --cwd apps/proxy dev
```

Or from root (after `bun install`):

```bash
bun run dev --cwd apps/proxy
```

The API runs at `http://localhost:8787` by default. Try: [http://localhost:8787/health](http://localhost:8787/health) → `{ "ok": true }`.

Copy `apps/proxy/.env.example` to `apps/proxy/.env` and set `CURSEFORGE_API_KEY`, `PORT`, and optionally `CURSEFORGE_GAME_ID`.

## Running the desktop app

```bash
bun run --cwd apps/desktop dev
```

This starts the Vite dev server and opens the Tauri window. Copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_PROXY_BASE_URL` if you use the proxy (e.g. `http://localhost:8787`).

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
| `bun run dev`        | Run dev in current app               |
| `bun run build`      | Build current app / all workspaces  |
| `bun run lint`       | Lint (root or per package)          |
| `bun run format`     | Format with Prettier                |

## Environment templates

- **apps/proxy/.env.example** – `CURSEFORGE_API_KEY`, `PORT`, optional `CURSEFORGE_GAME_ID`
- **apps/desktop/.env.example** – `VITE_PROXY_BASE_URL`

## Tech stack

- **Monorepo**: Bun workspaces
- **Desktop**: Tauri v2, TypeScript, React, Vite
- **Proxy API**: Bun, TypeScript, Hono
- **Shared**: TypeScript, Zod (schemas and types)
- **Tooling**: ESLint, Prettier (root config), TypeScript (base + references)

## Legal

This project does not include any pirated or illegal game files. It does not provide auth bypass or DRM bypass. The app manages mods and can optionally launch a legally installed game.
