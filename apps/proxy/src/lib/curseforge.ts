import type {
  ModSearchRequest,
  ModSearchResponse,
  ModDetailsResponse,
  ModFilesResponse,
  ResolveFromUrlResponse,
} from "@hyghertales/shared";

/**
 * CurseForge API client. Upstream calls are stubbed with mock data;
 * replace with real fetch to CurseForge when implementing.
 */
export function createCurseForgeClient(_apiKey: string, _gameId?: number) {
  return {
    async search(_params: ModSearchRequest): Promise<ModSearchResponse> {
      // TODO: GET https://api.curseforge.com/v1/mods/search?gameId=...&searchFilter=...
      return {
        items: [
          {
            provider: "curseforge",
            projectId: 306612,
            slug: "fabric-api",
            name: "Fabric API",
            summary: "Core API for the Fabric toolchain.",
            logoUrl: null,
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 1,
      };
    },

    async getMod(projectId: number): Promise<ModDetailsResponse | null> {
      // TODO: GET https://api.curseforge.com/v1/mods/{modId}
      return {
        provider: "curseforge",
        projectId,
        slug: "fabric-api",
        name: "Fabric API",
        summary: "Core API for the Fabric toolchain.",
        logoUrl: null,
        description: null,
      };
    },

    async getModFiles(_projectId: number): Promise<ModFilesResponse> {
      // TODO: GET https://api.curseforge.com/v1/mods/{modId}/files
      return {
        files: [
          {
            fileId: 4_500_000,
            fileName: "fabric-api-0.100.0+1.20.1.jar",
            displayName: "0.100.0 for 1.20.1",
            releaseType: "release",
            fileDate: "2024-01-15T12:00:00.000Z",
            downloadUrl: null,
          },
        ],
      };
    },

    async resolveFromUrl(_url: string): Promise<ResolveFromUrlResponse | null> {
      // TODO: Parse CurseForge URL or call API to resolve
      return {
        provider: "curseforge",
        projectId: 306612,
        slug: "fabric-api",
      };
    },
  };
}

export type CurseForgeClient = ReturnType<typeof createCurseForgeClient>;
