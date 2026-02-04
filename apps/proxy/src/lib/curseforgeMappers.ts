import type { ModSummary, ModDetailsResponse, ModFile } from "@hyghertales/shared";

/** Minimal upstream CurseForge mod (search/list and get mod). */
export interface CfMod {
  id?: number;
  slug?: string;
  name?: string;
  summary?: string | null;
  description?: string | null;
  logo?: { url?: string | null } | null;
}

/** Minimal upstream CurseForge file. */
export interface CfFile {
  id?: number;
  displayName?: string | null;
  fileName?: string;
  fileDate?: string;
  releaseType?: number;
  fileLength?: number;
}

/** CurseForge API returns download URL in a wrapper. */
export interface CfDownloadUrlResponse {
  data?: string | null;
}

const PROVIDER = "curseforge" as const;

function safeUrl(s: string | null | undefined): string | null | undefined {
  if (s == null || s === "") return null;
  try {
    new URL(s);
    return s;
  } catch {
    return null;
  }
}

/** Map upstream mod to ModSummary. Missing fields become null. */
export function mapCfModToModSummary(cf: CfMod, projectId: number): ModSummary {
  return {
    provider: PROVIDER,
    projectId,
    slug: cf.slug ?? "",
    name: cf.name ?? "",
    summary: cf.summary ?? null,
    logoUrl: safeUrl(cf.logo?.url ?? null) ?? null,
  };
}

/** Map upstream mod to ModDetailsResponse. */
export function mapCfModToModDetails(cf: CfMod, projectId: number): ModDetailsResponse {
  return {
    ...mapCfModToModSummary(cf, projectId),
    description: cf.description ?? null,
  };
}

/** Release type enum from CurseForge (1=release, 2=beta, 3=alpha). */
function releaseTypeLabel(releaseType?: number): string | null {
  if (releaseType == null) return null;
  switch (releaseType) {
    case 1:
      return "release";
    case 2:
      return "beta";
    case 3:
      return "alpha";
    default:
      return null;
  }
}

/** Map upstream file to ModFile. */
export function mapCfFileToModFile(cf: CfFile, _projectId: number): ModFile {
  return {
    fileId: cf.id ?? 0,
    fileName: cf.fileName ?? "",
    displayName: cf.displayName ?? null,
    releaseType: releaseTypeLabel(cf.releaseType) ?? null,
    fileDate: cf.fileDate ?? new Date(0).toISOString(),
    downloadUrl: null, // Filled by getFileDownloadUrl when needed
  };
}
