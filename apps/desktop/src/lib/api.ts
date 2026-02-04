import type { z } from "@hyghertales/shared";
import {
  healthResponseSchema,
  modSearchResponseSchema,
  modCategoriesResponseSchema,
  modDetailsResponseSchema,
  modFilesResponseSchema,
  downloadResponseSchema,
  errorResponseSchema,
  type ModSearchRequest,
  type ModSearchResponse,
  type ModCategoriesResponse,
  type ModDetailsResponse,
  type ModFilesResponse,
  type DownloadResponse,
  type ErrorResponse,
} from "@hyghertales/shared";

type ZodSchema<T> = z.ZodType<T>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ErrorResponse
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch JSON and validate with zod. Throws ApiError on non-2xx or validation failure.
 */
async function fetchJson<T>(
  baseUrl: string,
  path: string,
  schema: ZodSchema<T>,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) },
  });
  const data = (await res.json()) as unknown;

  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(data);
    const body = parsed.success ? parsed.data : undefined;
    throw new ApiError(
      body?.message ?? `Request failed: ${res.status}`,
      res.status,
      body
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError("Invalid response from server", res.status);
  }
  return parsed.data;
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    await fetchJson(baseUrl, "/health", healthResponseSchema);
    return true;
  } catch {
    return false;
  }
}

export async function searchMods(
  baseUrl: string,
  params: ModSearchRequest
): Promise<ModSearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.q,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.categoryId != null && params.categoryId > 0) {
    searchParams.set("categoryId", String(params.categoryId));
  }
  if (params.sortField != null && params.sortField > 0) {
    searchParams.set("sortField", String(params.sortField));
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  return fetchJson<ModSearchResponse>(
    baseUrl,
    `/v1/search?${searchParams.toString()}`,
    modSearchResponseSchema
  );
}

/** Categories for filter dropdown (Hytale mod subcategories under "Mods" class). */
export async function getCategories(
  baseUrl: string
): Promise<ModCategoriesResponse> {
  return fetchJson<ModCategoriesResponse>(
    baseUrl,
    "/v1/categories",
    modCategoriesResponseSchema
  );
}

/** Featured / popular / recently updated mods for the configured game (no search term). */
export async function getFeaturedMods(
  baseUrl: string
): Promise<ModSearchResponse> {
  return fetchJson<ModSearchResponse>(
    baseUrl,
    "/v1/featured",
    modSearchResponseSchema
  );
}

/** Orbis.place: first page of mods (no API key). */
export async function getOrbisFeatured(
  baseUrl: string
): Promise<ModSearchResponse> {
  return fetchJson<ModSearchResponse>(
    baseUrl,
    "/v1/orbis/featured",
    modSearchResponseSchema
  );
}

/** Orbis.place: paginated list with optional text search (q) and sortBy. */
export async function getOrbisSearch(
  baseUrl: string,
  params: { page?: number; limit?: number; sortBy?: "date" | "downloads" | "name"; q?: string }
): Promise<ModSearchResponse> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.q != null && params.q.trim()) searchParams.set("q", params.q.trim());
  return fetchJson<ModSearchResponse>(
    baseUrl,
    `/v1/orbis/search?${searchParams.toString()}`,
    modSearchResponseSchema
  );
}

/** Mod details by provider and id (projectId for CurseForge, resourceId for Orbis). */
export async function getModDetails(
  baseUrl: string,
  provider: "curseforge" | "orbis",
  id: string
): Promise<ModDetailsResponse> {
  return fetchJson<ModDetailsResponse>(
    baseUrl,
    `/v1/mod/${provider}/${encodeURIComponent(id)}`,
    modDetailsResponseSchema
  );
}

/** Mod files/versions by provider and id. */
export async function getModFiles(
  baseUrl: string,
  provider: "curseforge" | "orbis",
  id: string
): Promise<ModFilesResponse> {
  return fetchJson<ModFilesResponse>(
    baseUrl,
    `/v1/mod/${provider}/${encodeURIComponent(id)}/files`,
    modFilesResponseSchema
  );
}

/** CurseForge: get download URL for a file. */
export async function getDownloadUrlCurseForge(
  baseUrl: string,
  projectId: number,
  fileId: number
): Promise<DownloadResponse> {
  return fetchJson<DownloadResponse>(
    baseUrl,
    `/v1/download/curseforge/${projectId}/${fileId}`,
    downloadResponseSchema
  );
}

/** Orbis: get download URL for a version file (or use file.downloadUrl from getModFiles if present). */
export async function getDownloadUrlOrbis(
  baseUrl: string,
  resourceId: string,
  versionId: string,
  fileIndex: number
): Promise<DownloadResponse> {
  return fetchJson<DownloadResponse>(
    baseUrl,
    `/v1/download/orbis/${encodeURIComponent(resourceId)}/${encodeURIComponent(versionId)}/${fileIndex}`,
    downloadResponseSchema
  );
}
