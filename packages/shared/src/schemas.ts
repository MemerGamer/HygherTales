import { z } from "zod";

// --- Health ---

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// --- Mod search ---

/** sortField: 1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 5=Author, 6=TotalDownloads (CurseForge API) */
export const modSearchRequestSchema = z.object({
  q: z.string(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  categoryId: z.number().int().min(0).optional(),
  sortField: z.number().int().min(0).max(6).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type ModSearchRequest = z.infer<typeof modSearchRequestSchema>;

// --- Categories (for filter dropdown) ---

export const modCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
});

export type ModCategory = z.infer<typeof modCategorySchema>;

export const modCategoriesResponseSchema = z.object({
  categories: z.array(modCategorySchema),
});

export type ModCategoriesResponse = z.infer<typeof modCategoriesResponseSchema>;

const modSummaryBase = {
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
};

export const modSummaryCurseForgeSchema = z.object({
  provider: z.literal("curseforge"),
  projectId: z.number().int(),
  ...modSummaryBase,
});

export const modSummaryOrbisSchema = z.object({
  provider: z.literal("orbis"),
  resourceId: z.string(),
  ...modSummaryBase,
});

export const modSummarySchema = z.discriminatedUnion("provider", [
  modSummaryCurseForgeSchema,
  modSummaryOrbisSchema,
]);

export type ModSummary = z.infer<typeof modSummarySchema>;

export const modSearchResponseSchema = z.object({
  items: z.array(modSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalCount: z.number().int(),
});

export type ModSearchResponse = z.infer<typeof modSearchResponseSchema>;

// --- Mod details ---

export const modDetailsResponseCurseForgeSchema =
  modSummaryCurseForgeSchema.extend({
    description: z.string().nullable().optional(),
  });
export const modDetailsResponseOrbisSchema = modSummaryOrbisSchema.extend({
  description: z.string().nullable().optional(),
});
export const modDetailsResponseSchema = z.discriminatedUnion("provider", [
  modDetailsResponseCurseForgeSchema,
  modDetailsResponseOrbisSchema,
]);

export type ModDetailsResponse = z.infer<typeof modDetailsResponseSchema>;

// --- Mod files ---
// CurseForge: fileId required. Orbis: versionId + fileIndex required, downloadUrl required.

export const modFileSchema = z.object({
  fileId: z.number().int().optional(), // CurseForge
  versionId: z.string().optional(), // Orbis
  fileIndex: z.number().int().min(0).optional(), // Orbis: index in version.files[]
  fileName: z.string(),
  displayName: z.string().nullable().optional(),
  releaseType: z.string().nullable().optional(),
  fileDate: z.string(), // ISO timestamp
  downloadUrl: z.string().url().nullable().optional(),
});

export type ModFile = z.infer<typeof modFileSchema>;

export const modFilesResponseSchema = z.object({
  files: z.array(modFileSchema),
});

export type ModFilesResponse = z.infer<typeof modFilesResponseSchema>;

// --- Resolve from URL ---

export const resolveFromUrlRequestSchema = z.object({
  url: z.string().url(),
});

export type ResolveFromUrlRequest = z.infer<typeof resolveFromUrlRequestSchema>;

export const resolveFromUrlResponseCurseForgeSchema = z.object({
  provider: z.literal("curseforge"),
  projectId: z.number().int(),
  slug: z.string(),
});

export const resolveFromUrlResponseOrbisSchema = z.object({
  provider: z.literal("orbis"),
  resourceId: z.string(),
  slug: z.string(),
});

export const resolveFromUrlResponseSchema = z.discriminatedUnion("provider", [
  resolveFromUrlResponseCurseForgeSchema,
  resolveFromUrlResponseOrbisSchema,
]);

export type ResolveFromUrlResponse = z.infer<typeof resolveFromUrlResponseSchema>;

// --- Download ---

export const downloadResponseSchema = z.object({
  url: z.string().url(),
});

export type DownloadResponse = z.infer<typeof downloadResponseSchema>;

// --- Installed mod (local DB) ---

export const installedModSchema = z.object({
  id: z.number().int().optional(), // row id
  provider: z.enum(["curseforge", "orbis"]),
  projectId: z.number().int().nullable().optional(), // CurseForge
  resourceId: z.string().nullable().optional(), // Orbis
  slug: z.string(),
  name: z.string(),
  installedFileId: z.union([z.number().int(), z.string()]).nullable().optional(), // CF fileId or Orbis "versionId:fileIndex"
  installedFilename: z.string(),
  installedAt: z.string(), // ISO timestamp
  sourceUrl: z.string().url().optional(),
  enabled: z.boolean(),
});

export type InstalledMod = z.infer<typeof installedModSchema>;

// --- Error ---

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
