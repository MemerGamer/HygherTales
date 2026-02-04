# HygherTales Desktop

Tauri v2 + React + Vite desktop app for managing Hytale mods.

## Run & build

From repo root:

- **Dev:** `bun run dev` or `bun run dev:desktop` (builds shared package if needed)
- **Build:** `bun run build` (from root builds all; or `bun run build` from `apps/desktop`)

Copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_PROXY_BASE_URL` (e.g. `http://localhost:8787`) if you use the proxy.

## Hytale Mods folder detection and validation

### Goal

- Find default Hytale **UserData/Mods** folder on Windows, macOS, and Linux.
- Allow manual override via folder picker or text input.
- Ensure the Mods directory exists (create if missing); never delete or modify existing mods.

### Default paths (assumptions)

Paths are taken from multiple sources: official Hytale install-mod guide (hytale.game), low.ms knowledgebase, and Flatpak documentation. The game may use different paths in future; users can always set a custom path.

| OS      | Default Mods path(s) |
|--------|------------------------------------------|
| Windows | `%APPDATA%\Hytale\UserData\Mods` |
| macOS   | `~/Library/Application Support/Hytale/UserData/Mods` |
| Linux   | **Official Linux build is Flatpak only.** Primary: `~/.var/app/com.hypixel.HytaleLauncher/data/Hytale/UserData/Mods`. Fallback for native/AUR: `$XDG_DATA_HOME/Hytale/UserData/Mods` or `~/.local/share/Hytale/UserData/Mods`. |

- **Windows:** `APPDATA` (Roaming), e.g. `C:\Users\<user>\AppData\Roaming\Hytale\UserData\Mods`.
- **macOS:** `~/Library/Application Support/Hytale/UserData/Mods`.
- **Linux:** Flatpak app ID is `com.hypixel.HytaleLauncher`; Mods path is `data/Hytale/UserData/Mods` inside the sandbox. One XDG/`~/.local/share` fallback for non-Flatpak installs; duplicates are deduplicated.

### Tauri commands (Rust)

- **`get_default_hytale_mods_paths()`** → `string[]`  
  Returns candidate paths for the default Mods folder on the current platform. No I/O; only builds paths from env vars.

- **`ensure_mods_dir(path: string)`** → `{ ok: true, created: boolean }` or error  
  Creates the directory (and parents) if it does not exist. If it already exists and is a directory, returns `ok: true, created: false`. Does **not** delete or modify any existing files.

- **`check_path_access(path: string)`** → `{ exists, is_dir, writable }`  
  Checks whether the path exists, is a directory, and is writable (via a temporary test file that is removed).

### Settings UI

- **Auto-detect:** Calls `get_default_hytale_mods_paths()`, shows the list of candidates; user can pick one to set as the Mods directory.
- **Browse…:** Opens a native folder picker (Tauri dialog plugin); selected folder is set as the Mods path.
- **Validate:** Runs `check_path_access` on the current path. If the path does not exist, calls `ensure_mods_dir` to create it, then reports status. Displays one of: valid and writable, created, missing, not a directory, not writable, or error. Settings are saved when validation succeeds.

### Constraints

- **No automatic deletion or modification of mods** – We only create the Mods directory when it is missing; we do not delete, move, or overwrite existing mod files.
- **Safe path handling** – Paths are trimmed and validated; empty paths are rejected. Creation uses `create_dir_all` and does not follow symlinks in a way that would write outside the chosen path.

### Persistence

The chosen Mods directory path is stored in the app’s settings (e.g. localStorage in the Tauri webview). It is not written to the game’s config; the game will use whatever path it normally uses. This app uses the configured path only for installing or managing mods from HygherTales.
