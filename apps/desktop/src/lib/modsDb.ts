/**
 * Installed mods DB and file operations via Tauri commands.
 * Matches Rust InstalledModRecord (camelCase in JSON).
 */

import { invoke } from "@tauri-apps/api/core";

export interface InstalledModRecord {
  id?: number;
  provider: "curseforge" | "orbis";
  projectId?: number | null;
  resourceId?: string | null;
  slug: string;
  name: string;
  installedFileId?: number | string | null;
  installedFilename: string;
  installedAt: string;
  sourceUrl?: string | null;
  enabled: boolean;
}

export async function readInstalledMods(): Promise<InstalledModRecord[]> {
  return invoke<InstalledModRecord[]>("read_installed_mods");
}

export async function writeInstalledMods(
  mods: InstalledModRecord[]
): Promise<void> {
  return invoke("write_installed_mods", { mods });
}

export async function ensureModsDisabledDir(modsDir: string): Promise<{
  ok: boolean;
  created: boolean;
}> {
  return invoke("ensure_mods_disabled_dir", { modsDir });
}

/** Move file; if destination exists, a unique name is used. Returns final path. */
export async function moveModFile(
  fromPath: string,
  toPath: string
): Promise<string> {
  return invoke("move_mod_file", { fromPath, toPath });
}

export async function moveFileToTrash(path: string): Promise<void> {
  return invoke("move_file_to_trash", { path });
}

export async function listModDirFileNames(dirPath: string): Promise<string[]> {
  return invoke("list_mod_dir_file_names", { dirPath });
}

/** Download URL to path; returns final path (may differ if collision). */
export async function downloadFileToPath(
  url: string,
  destPath: string
): Promise<string> {
  return invoke("download_file_to_path", { url, destPath });
}

/** Generate next id for a new record (max existing + 1). */
export function nextId(mods: InstalledModRecord[]): number {
  const ids = mods
    .map((m) => m.id)
    .filter((id): id is number => typeof id === "number");
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}
