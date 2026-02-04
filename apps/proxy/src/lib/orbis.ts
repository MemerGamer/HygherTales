import type { ModSearchResponse } from "@hyghertales/shared";
import { modSearchResponseSchema } from "@hyghertales/shared";
import { createTtlCache } from "./cache.js";

const ORBIS_API_BASE = "https://api.orbis.place";
const CACHE_TTL_MS = 60_000; // 60 seconds

/** Minimal Orbis.place resource (from GET /resources?type=MOD). */
interface OrbisResource {
  id?: string;
  name?: string;
  slug?: string;
  tagline?: string | null;
  iconUrl?: string | null;
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

/**
 * Orbis.place client: list Hytale mods from api.orbis.place.
 * No API key required. Responses cached 60s.
 */
export function createOrbisClient() {
  const searchCache = createTtlCache<ModSearchResponse>(CACHE_TTL_MS);

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
  };
}

export type OrbisClient = ReturnType<typeof createOrbisClient>;
