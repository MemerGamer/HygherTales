import {
  modSearchResponseSchema,
  modDetailsResponseSchema,
  modFilesResponseSchema,
  resolveFromUrlResponseSchema,
  type ModSearchRequest,
  type ModSearchResponse,
  type ModDetailsResponse,
  type ModFilesResponse,
  type ResolveFromUrlResponse,
} from "@hyghertales/shared";
import { createTtlCache } from "./cache.js";
import { createCurseForgeApiClient } from "./curseforgeClient.js";
import {
  mapCfModToModSummary,
  mapCfModToModDetails,
  mapCfFileToModFile,
} from "./curseforgeMappers.js";
import { parseCurseForgeModUrl } from "./curseforgeUrl.js";

const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Facade: CurseForge API client with 60s TTL cache and mapping to shared schemas.
 * Never exposes the API key.
 */
export function createCurseForgeClient(apiKey: string, gameId?: number) {
  const api = createCurseForgeApiClient(apiKey);
  const searchCache = createTtlCache<ModSearchResponse>(CACHE_TTL_MS);
  const modCache = createTtlCache<ModDetailsResponse>(CACHE_TTL_MS);
  const filesCache = createTtlCache<ModFilesResponse>(CACHE_TTL_MS);

  return {
    async search(params: ModSearchRequest): Promise<ModSearchResponse> {
      const cacheKey = `search:${params.q}:${params.page}:${params.pageSize}:${gameId ?? ""}`;
      const cached = searchCache.get(cacheKey);
      if (cached) return cached;

      const result = await api.searchMods({
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
        gameId,
      });
      const items = result.data.map((cf) =>
        mapCfModToModSummary(cf, cf.id ?? 0)
      );
      const response: ModSearchResponse = {
        items,
        page: params.page,
        pageSize: params.pageSize,
        totalCount: result.pagination?.totalCount ?? items.length,
      };
      const parsed = modSearchResponseSchema.parse(response);
      searchCache.set(cacheKey, parsed);
      return parsed;
    },

    async getMod(projectId: number): Promise<ModDetailsResponse | null> {
      const cacheKey = `mod:${projectId}`;
      const cached = modCache.get(cacheKey);
      if (cached) return cached;

      const cf = await api.getMod(projectId);
      if (cf == null) return null;
      const details = mapCfModToModDetails(cf, cf.id ?? projectId);
      const parsed = modDetailsResponseSchema.parse(details);
      modCache.set(cacheKey, parsed);
      return parsed;
    },

    async getModFiles(projectId: number): Promise<ModFilesResponse> {
      const cacheKey = `files:${projectId}`;
      const cached = filesCache.get(cacheKey);
      if (cached) return cached;

      const data = await api.getModFiles(projectId);
      const files = data.map((f) => mapCfFileToModFile(f, projectId));
      const response: ModFilesResponse = { files };
      const parsed = modFilesResponseSchema.parse(response);
      filesCache.set(cacheKey, parsed);
      return parsed;
    },

    async getFileDownloadUrl(
      projectId: number,
      fileId: number
    ): Promise<string | null> {
      return api.getFileDownloadUrl(projectId, fileId);
    },

    async resolveFromUrl(url: string): Promise<ResolveFromUrlResponse | null> {
      const parsed = parseCurseForgeModUrl(url);
      if (!parsed) return null;
      if (gameId == null) return null;

      const result = await api.searchMods({
        q: parsed.slug,
        page: 1,
        pageSize: 10,
        gameId,
      });
      const match = result.data.find(
        (m) => (m.slug ?? "").toLowerCase() === parsed.slug.toLowerCase()
      );
      if (!match?.id) return null;

      const response: ResolveFromUrlResponse = {
        provider: "curseforge",
        projectId: match.id,
        slug: match.slug ?? parsed.slug,
      };
      return resolveFromUrlResponseSchema.parse(response);
    },
  };
}

export type CurseForgeClient = ReturnType<typeof createCurseForgeClient>;
