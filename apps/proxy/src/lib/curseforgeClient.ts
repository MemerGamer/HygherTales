import type { CfMod, CfFile, CfDownloadUrlResponse } from "./curseforgeMappers.js";

const BASE = "https://api.curseforge.com/v1";

export interface SearchModsParams {
  q: string;
  page: number;
  pageSize: number;
  gameId?: number;
}

export interface SearchModsResult {
  data: CfMod[];
  pagination: { index: number; pageSize: number; totalCount: number };
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
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CurseForge API ${res.status}: ${text}`);
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
      const { q, page, pageSize, gameId } = params;
      if (gameId == null) {
        return { data: [], pagination: { index: 0, pageSize, totalCount: 0 } };
      }
      // API uses 0-based index
      const index = Math.max(0, (page - 1) * pageSize);
      const body = {
        gameId,
        searchFilter: q || undefined,
        index,
        pageSize,
      };
      type SearchRes = {
        data?: CfMod[];
        pagination?: {
          index?: number;
          pageSize?: number;
          totalCount?: number;
          total?: number;
        };
      };
      const res = await cfFetch<SearchRes>(
        apiKey,
        "/mods/search",
        { method: "POST", body: JSON.stringify(body) }
      );
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
