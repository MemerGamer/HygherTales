/**
 * Update detection for installed mods: pick "latest" file from provider file list,
 * compare with installed version.
 */

import type { ModFile } from "@hyghertales/shared";
import type { InstalledModRecord } from "./modsDb";

/** Release type priority for CurseForge: release > beta > alpha. Lower index = prefer first. */
const RELEASE_ORDER: Record<string, number> = {
  release: 0,
  beta: 1,
  alpha: 2,
};

function releasePriority(rt: string | null | undefined): number {
  if (rt == null) return 99;
  return RELEASE_ORDER[rt.toLowerCase()] ?? 99;
}

/**
 * Pick the single "latest" file from a CurseForge-style file list.
 * Prefers release over beta over alpha, then newest fileDate.
 */
export function getLatestCurseForgeFile(files: ModFile[]): ModFile | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => {
    const pa = releasePriority(a.releaseType);
    const pb = releasePriority(b.releaseType);
    if (pa !== pb) return pa - pb;
    const da = new Date(a.fileDate).getTime();
    const db = new Date(b.fileDate).getTime();
    return db - da; // newer first
  });
  return sorted[0] ?? null;
}

/**
 * Pick the single "latest" file from an Orbis file list (one per version, already by date).
 */
export function getLatestOrbisFile(files: ModFile[]): ModFile | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => {
    const da = new Date(a.fileDate).getTime();
    const db = new Date(b.fileDate).getTime();
    return db - da;
  });
  return sorted[0] ?? null;
}

export function getLatestFile(
  provider: "curseforge" | "orbis",
  files: ModFile[]
): ModFile | null {
  return provider === "curseforge"
    ? getLatestCurseForgeFile(files)
    : getLatestOrbisFile(files);
}

/** True if the installed mod is not the latest (different file id/version). */
export function isUpdateAvailable(
  mod: InstalledModRecord,
  latestFile: ModFile
): boolean {
  if (mod.provider === "curseforge") {
    const installedId = mod.installedFileId;
    const latestId = latestFile.fileId;
    if (installedId == null || latestId == null) return false;
    return Number(installedId) !== Number(latestId);
  }
  if (mod.provider === "orbis") {
    const installed = mod.installedFileId;
    const latest =
      latestFile.versionId != null && latestFile.fileIndex != null
        ? `${latestFile.versionId}:${latestFile.fileIndex}`
        : null;
    if (installed == null || latest == null) return false;
    return String(installed) !== String(latest);
  }
  return false;
}
