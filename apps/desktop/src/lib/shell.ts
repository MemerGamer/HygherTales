/**
 * Open URLs or local paths in the system default application (browser, Explorer, etc.).
 */

/** Open a URL in the system browser (or default app). */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Open a local path (file or folder) in the system file manager. Uses a Tauri command
 * so it works without the shell plugin's URL allowlist (which only allows http/https/mailto/tel). */
export async function openPath(path: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_path_in_file_manager", { path });
  } catch (e) {
    throw new Error(`Could not open path: ${e}`);
  }
}
