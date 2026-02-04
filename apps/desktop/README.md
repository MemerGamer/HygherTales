# HygherTales Desktop

Tauri v2 desktop app for managing Hytale mods. Browses CurseForge and Orbis.place, manages profiles, optionally launches the game.

## Development

From repo root:

```bash
bun run dev
```

Copy `apps/desktop/.env.example` to `.env` and set `VITE_PROXY_BASE_URL` (default: `http://localhost:8787`).

## Build

```bash
bun run build
```

Creates platform-specific installers in `src-tauri/target/release/bundle/`.

---

## UI

Built with Tailwind CSS v4 (dark glassmorphism theme).

- **Components**: `src/components/ui/` (Button, Input, Card, Modal, Badge, Spinner)
- **Layout**: `src/components/layout/PageContainer`
- **Theme**: `src/styles/tailwind.css` (CSS variables via `@theme`)
- **Responsive**: `sm: 640px`, `md: 768px`, `lg: 1024px`
- **Accessibility**: Focus states, focus traps, ARIA labels, keyboard nav

### Conventions

- Use Tailwind utilities for layout/spacing
- Use CSS vars for theme colors (`var(--color-surface)`, `var(--color-text)`)
- Components are responsive by default (flex-wrap, responsive grids)
- Modals: `default` (max-w-xl) or `wide` (max-w-2xl)

---

## Mods folder detection

Auto-detects Hytale's Mods folder on Windows, macOS, and Linux. Manual override via folder picker or text input.

### Default paths

| OS      | Path |
|---------|------|
| Windows | `%APPDATA%\Hytale\UserData\Mods` |
| macOS   | `~/Library/Application Support/Hytale/UserData/Mods` |
| Linux   | `~/.var/app/com.hypixel.HytaleLauncher/data/Hytale/UserData/Mods` (Flatpak)<br>Fallback: `~/.local/share/Hytale/UserData/Mods` |

### Rust commands

- `get_default_hytale_mods_paths()` → candidate paths
- `ensure_mods_dir(path)` → creates if missing, returns `{ ok, created }`
- `check_path_access(path)` → `{ exists, is_dir, writable }`

Desktop never deletes or modifies existing mods. It only creates the Mods directory when missing.

---

## Settings persistence

Settings (proxy URL, Mods path, game exe) are stored in localStorage (Tauri webview). Not written to game config.
