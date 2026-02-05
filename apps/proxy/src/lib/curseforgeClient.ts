import type { CfMod, CfFile, CfDownloadUrlResponse } from "./curseforgeMappers.js";

const BASE = "https://api.curseforge.com/v1";

export interface SearchModsParams {
  q: string;
  page: number;
  pageSize: number;
  gameId?: number;
  categoryId?: number;
  /** 1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 5=Author, 6=TotalDownloads */
  sortField?: number;
  sortOrder?: "asc" | "desc";
}

export interface SearchModsResult {
  data: CfMod[];
  pagination: { index: number; pageSize: number; totalCount: number };
}

export interface CfGame {
  id?: number;
  name?: string;
  slug?: string;
}

export interface FeaturedModsResult {
  featured: CfMod[];
  popular: CfMod[];
  recentlyUpdated: CfMod[];
}


async function cfFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      throw new Error(
        `CurseForge API 403 (forbidden). ${text || "No body."} ` +
          "Use a valid API key in apps/proxy/.env (CURSEFORGE_API_KEY). " +
          "No quotes around the value. Keys with special characters (e.g. $2a$10$...) work correctly. " +
          "Verify with: curl -H \"x-api-key: YOUR_KEY\" \"https://api.curseforge.com/v1/games?pageSize=5\". See apps/proxy/README.md."
      );
    }
    throw new Error(`CurseForge API ${res.status}: ${text || "(no body)"}`);
  }
  return res.json() as Promise<T>;
}

/**
 * CurseForge API client. Uses x-api-key header.
 * Does not cache; caching is applied at the facade layer.
 */
export function createCurseForgeApiClient(apiKey: string) {
  return {
    async searchMods(params: SearchModsParams): Promise<SearchModsResult> {
      const { q, page, pageSize, gameId, categoryId, sortField, sortOrder } = params;
      if (gameId == null) {
        return { data: [], pagination: { index: 0, pageSize, totalCount: 0 } };
      }
      // API uses 0-based index
      const index = Math.max(0, (page - 1) * pageSize);
      
      // Build query string for GET request (CurseForge API requires GET, not POST)
      const query = new URLSearchParams();
      query.set("gameId", String(gameId));
      query.set("index", String(index));
      query.set("pageSize", String(pageSize));
      if (q) query.set("searchFilter", q);
      if (categoryId != null && categoryId > 0) query.set("categoryId", String(categoryId));
      if (sortField != null && sortField > 0) query.set("sortField", String(sortField));
      if (sortOrder) query.set("sortOrder", sortOrder);

      type SearchRes = {
        data?: CfMod[];
        pagination?: {
          index?: number;
          pageSize?: number;
          totalCount?: number;
          total?: number;
        };
      };
      const res = await cfFetch<SearchRes>(apiKey, `/mods/search?${query.toString()}`);
      const pag = res.pagination;
      const totalCount =
        pag?.totalCount ?? pag?.total ?? (res.data?.length ?? 0);
      return {
        data: res.data ?? [],
        pagination: {
          index: pag?.index ?? 0,
          pageSize: pag?.pageSize ?? pageSize,
          totalCount,
        },
      };
    },

    async getFeaturedMods(gameId: number): Promise<FeaturedModsResult> {
      type FeaturedRes = {
        data?: {
          featured?: CfMod[];
          popular?: CfMod[];
          recentlyUpdated?: CfMod[];
        };
      };
      const res = await cfFetch<FeaturedRes>(apiKey, "/mods/featured", {
        method: "POST",
        body: JSON.stringify({ gameId }),
      });
      const d = res.data ?? {};
      return {
        featured: d.featured ?? [],
        popular: d.popular ?? [],
        recentlyUpdated: d.recentlyUpdated ?? [],
      };
    },

    async getCategories(gameId: number): Promise<{ id: number; name: string; slug: string; parentCategoryId?: number; isClass?: boolean }[]> {
      type Cat = { id?: number; name?: string; slug?: string; parentCategoryId?: number; isClass?: boolean };
      const res = await cfFetch<{ data?: Cat[] }>(
        apiKey,
        `/categories?gameId=${gameId}`
      );
      const list = res?.data ?? [];
      return list
        .filter((c): c is Cat & { id: number; name: string; slug: string } =>
          typeof c.id === "number" && typeof c.name === "string" && typeof c.slug === "string"
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parentCategoryId: c.parentCategoryId,
          isClass: c.isClass,
        }));
    },

    async getMod(projectId: number): Promise<CfMod | null> {
      const res = await cfFetch<{ data?: CfMod | null }>(
        apiKey,
        `/mods/${projectId}`
      );
      const data = res?.data;
      if (data == null) return null;
      return { ...data, id: data.id ?? projectId };
    },

    async getModFiles(projectId: number): Promise<CfFile[]> {
      const res = await cfFetch<{ data?: CfFile[] | null }>(
        apiKey,
        `/mods/${projectId}/files`
      );
      return res?.data ?? [];
    },

    async getModDescription(projectId: number): Promise<string | null> {
      const res = await cfFetch<{ data?: string }>(
        apiKey,
        `/mods/${projectId}/description`
      );
      return res?.data ?? null;
    },

    /**
     * Returns the download URL for a file, or null if not supported / failed.
     */
    async getFileDownloadUrl(
      projectId: number,
      fileId: number
    ): Promise<string | null> {
      try {
        const res = await cfFetch<CfDownloadUrlResponse>(
          apiKey,
          `/mods/${projectId}/files/${fileId}/download-url`
        );
        const url = res?.data;
        if (typeof url === "string" && url.length > 0) return url;
        return null;
      } catch {
        return null;
      }
    },
  };
}

export type CurseForgeApiClient = ReturnType<typeof createCurseForgeApiClient>;
