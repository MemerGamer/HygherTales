import type {
  ModSearchResponse,
  ModDetailsResponse,
  ModFilesResponse,
} from "@hyghertales/shared";
import {
  modSearchResponseSchema,
  modDetailsResponseSchema,
  modFilesResponseSchema,
} from "@hyghertales/shared";
import { createTtlCache } from "./cache.js";

const ORBIS_API_BASE = "https://api.orbis.place";
const CACHE_TTL_MS = 60_000; // 60 seconds

/** Minimal Orbis.place resource (from GET /resources?type=MOD or GET /resources/slug/:slug). */
interface OrbisResource {
  id?: string;
  name?: string;
  slug?: string;
  tagline?: string | null;
  iconUrl?: string | null;
  description?: string | null;
}

/** Orbis version (from GET /resources/:id/versions). One row per version; use primaryFile or first file. */
interface OrbisVersionFile {
  id?: string;
  url?: string;
  filename?: string;
  displayName?: string;
}
interface OrbisVersion {
  id?: string;
  name?: string;
  versionNumber?: string;
  createdAt?: string;
  primaryFileId?: string;
  files?: OrbisVersionFile[];
}

interface OrbisListResponse {
  data?: OrbisResource[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

function safeUrl(s: string | null | undefined): string | null | undefined {
  if (s == null || s === "") return null;
  try {
    new URL(s);
    return s;
  } catch {
    return null;
  }
}

async function fetchOrbisResources(params: {
  page: number;
  limit: number;
  sortBy?: string;
  search?: string;
}): Promise<OrbisListResponse> {
  const searchParams = new URLSearchParams({
    type: "MOD",
    page: String(params.page),
    limit: String(params.limit),
    ...(params.sortBy && { sortBy: params.sortBy }),
    ...(params.search && params.search.trim() && { search: params.search.trim() }),
  });
  const url = `${ORBIS_API_BASE}/resources?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.orbis.place",
      Referer: "https://www.orbis.place/",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Orbis.place API error ${res.status}: ${text.slice(0, 200)}`
    );
  }

  return (await res.json()) as OrbisListResponse;
}

async function fetchOrbisJson<T>(path: string): Promise<T> {
  const url = `${ORBIS_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.orbis.place",
      Referer: "https://www.orbis.place/",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orbis.place API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** GET /resources/slug/:slug response. */
interface OrbisResourceBySlugResponse {
  resource?: OrbisResource;
}

/** GET /resources/:id/versions response. */
interface OrbisVersionsResponse {
  versions?: OrbisVersion[];
}

/**
 * Orbis.place client: list Hytale mods from api.orbis.place.
 * No API key required. Responses cached 60s.
 */
export function createOrbisClient() {
  const searchCache = createTtlCache<ModSearchResponse>(CACHE_TTL_MS);
  const detailCache = createTtlCache<ModDetailsResponse>(CACHE_TTL_MS);
  const filesCache = createTtlCache<ModFilesResponse>(CACHE_TTL_MS);

  return {
    async list(params: {
      page: number;
      limit: number;
      sortBy?: string;
      search?: string;
    }): Promise<ModSearchResponse> {
      const searchPart = params.search?.trim() ?? "";
      const cacheKey = `orbis:list:${params.page}:${params.limit}:${params.sortBy ?? "date"}:${searchPart}`;
      const cached = searchCache.get(cacheKey);
      if (cached) return cached;

      const raw = await fetchOrbisResources({
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy ?? "date",
        ...(searchPart && { search: searchPart }),
      });

      const data = raw.data ?? [];
      const meta = raw.meta ?? {};
      const items = data
        .filter((r) => r.id != null)
        .map((r) => ({
          provider: "orbis" as const,
          resourceId: r.id!,
          slug: r.slug ?? "",
          name: r.name ?? "",
          summary: r.tagline ?? null,
          logoUrl: safeUrl(r.iconUrl ?? null) ?? undefined,
        }));

      const response: ModSearchResponse = {
        items,
        page: meta.page ?? params.page,
        pageSize: meta.limit ?? params.limit,
        totalCount: meta.total ?? items.length,
      };
      const parsed = modSearchResponseSchema.parse(response);
      searchCache.set(cacheKey, parsed);
      return parsed;
    },

    async getResourceBySlug(slug: string): Promise<ModDetailsResponse | null> {
      const cacheKey = `orbis:detail:slug:${slug}`;
      const cached = detailCache.get(cacheKey);
      if (cached) return cached;

      const raw = await fetchOrbisJson<OrbisResourceBySlugResponse>(
        `/resources/slug/${encodeURIComponent(slug)}`
      );
      const resource = raw.resource;
      if (resource?.id == null) return null;

      const details: ModDetailsResponse = {
        provider: "orbis",
        resourceId: resource.id,
        slug: resource.slug ?? slug,
        name: resource.name ?? "",
        summary: resource.tagline ?? null,
        logoUrl: safeUrl(resource.iconUrl ?? null) ?? undefined,
        description: resource.description ?? null,
      };
      const parsed = modDetailsResponseSchema.parse(details);
      detailCache.set(cacheKey, parsed);
      return parsed;
    },

    async getResourceById(resourceId: string): Promise<ModDetailsResponse | null> {
      const cacheKey = `orbis:detail:id:${resourceId}`;
      const cached = detailCache.get(cacheKey);
      if (cached) return cached;

      const raw = await fetchOrbisJson<OrbisResourceBySlugResponse | OrbisResource>(
        `/resources/${encodeURIComponent(resourceId)}`
      );
      const resource = "resource" in raw && raw.resource != null ? raw.resource : (raw as OrbisResource);
      if (resource?.id == null) return null;

      const details: ModDetailsResponse = {
        provider: "orbis",
        resourceId: resource.id,
        slug: resource.slug ?? "",
        name: resource.name ?? "",
        summary: resource.tagline ?? null,
        logoUrl: safeUrl(resource.iconUrl ?? null) ?? undefined,
        description: resource.description ?? null,
      };
      const parsed = modDetailsResponseSchema.parse(details);
      detailCache.set(cacheKey, parsed);
      return parsed;
    },

    async getVersions(resourceId: string): Promise<ModFilesResponse> {
      const cacheKey = `orbis:files:${resourceId}`;
      const cached = filesCache.get(cacheKey);
      if (cached) return cached;

      const raw = await fetchOrbisJson<OrbisVersionsResponse>(
        `/resources/${encodeURIComponent(resourceId)}/versions`
      );
      const versions = raw.versions ?? [];
      const files: ModFilesResponse["files"] = [];
      for (const ver of versions) {
        const versionId = ver.id ?? "";
        const versionName = ver.versionNumber ?? ver.name ?? "";
        const versionDate = ver.createdAt ?? new Date(0).toISOString();
        const list = ver.files ?? [];
        const primaryId = ver.primaryFileId;
        const chosen =
          (primaryId && list.find((f) => f.id === primaryId)) || list[0];
        if (!chosen) continue;
        const fileIndex = list.indexOf(chosen);
        const fileUrl = chosen.url ?? "";
        files.push({
          versionId,
          fileIndex: fileIndex >= 0 ? fileIndex : 0,
          fileName: chosen.filename ?? chosen.displayName ?? "",
          displayName: (chosen.displayName ?? chosen.filename ?? versionName) || null,
          releaseType: null,
          fileDate: versionDate,
          downloadUrl: safeUrl(fileUrl) ?? null,
        });
      }
      const response: ModFilesResponse = { files };
      const parsed = modFilesResponseSchema.parse(response);
      filesCache.set(cacheKey, parsed);
      return parsed;
    },
  };
}

export type OrbisClient = ReturnType<typeof createOrbisClient>;
