import { z } from "zod";

// --- Health ---

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// --- Mod search ---

export const modSearchRequestSchema = z.object({
  q: z.string(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export type ModSearchRequest = z.infer<typeof modSearchRequestSchema>;

export const modSummarySchema = z.object({
  provider: z.literal("curseforge"),
  projectId: z.number().int(),
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export type ModSummary = z.infer<typeof modSummarySchema>;

export const modSearchResponseSchema = z.object({
  items: z.array(modSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalCount: z.number().int(),
});

export type ModSearchResponse = z.infer<typeof modSearchResponseSchema>;

// --- Mod details ---

export const modDetailsResponseSchema = modSummarySchema.extend({
  description: z.string().nullable().optional(),
});

export type ModDetailsResponse = z.infer<typeof modDetailsResponseSchema>;

// --- Mod files ---

export const modFileSchema = z.object({
  fileId: z.number().int(),
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

export const resolveFromUrlResponseSchema = z.object({
  provider: z.literal("curseforge"),
  projectId: z.number().int(),
  slug: z.string(),
});

export type ResolveFromUrlResponse = z.infer<typeof resolveFromUrlResponseSchema>;

// --- Download ---

export const downloadResponseSchema = z.object({
  url: z.string().url(),
});

export type DownloadResponse = z.infer<typeof downloadResponseSchema>;

// --- Error ---

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
