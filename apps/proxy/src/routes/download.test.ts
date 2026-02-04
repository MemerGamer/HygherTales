import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { errorResponseSchema } from "@hyghertales/shared";
import { createDownloadRoutes } from "./download.js";
import type { CurseForgeClient } from "../lib/curseforge.js";
import { AppError } from "../lib/errors.js";
import type { OrbisClient } from "../lib/orbis.js";

function mockCfClient(overrides: Partial<CurseForgeClient> = {}): CurseForgeClient {
  return {
    getCategories: async () => ({ categories: [] }),
    getFeaturedMods: async () => ({ items: [], page: 1, pageSize: 20, totalCount: 0 }),
    search: async () => ({ items: [], page: 1, pageSize: 20, totalCount: 0 }),
    getMod: async () => null,
    getModFiles: async () => ({ files: [] }),
    getFileDownloadUrl: async () => null,
    resolveFromUrl: async () => null,
    ...overrides,
  };
}

function mockOrbisClient(overrides: Partial<OrbisClient> = {}): OrbisClient {
  return {
    list: async () => ({ items: [], page: 1, pageSize: 20, totalCount: 0 }),
    getResourceBySlug: async () => null,
    getResourceById: async () => null,
    getVersions: async () => ({ files: [] }),
    ...overrides,
  };
}

function appWithDownload(cf: CurseForgeClient, orbis: OrbisClient) {
  const app = new Hono();
  app.route("/v1/download", createDownloadRoutes(cf, orbis));
  type HttpStatus = 400 | 404 | 500 | 503;
  app.onError((err, c) => {
    if (err instanceof AppError) {
      const body = errorResponseSchema.parse(err.toJSON());
      return c.json(body, err.status as HttpStatus);
    }
    return c.json(
      errorResponseSchema.parse({
        code: "INTERNAL_ERROR",
        message: err.message ?? "Internal server error",
        details: undefined,
      }),
      500 as HttpStatus
    );
  });
  return app;
}

describe("GET /v1/download/curseforge/:projectId/:fileId", () => {
  test("returns 400 VALIDATION_ERROR for invalid projectId", async () => {
    const app = appWithDownload(mockCfClient(), mockOrbisClient());
    const res = await app.request("http://localhost/v1/download/curseforge/0/123");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ code: "VALIDATION_ERROR", message: "Invalid projectId or fileId" });
  });

  test("returns 400 VALIDATION_ERROR for invalid fileId", async () => {
    const app = appWithDownload(mockCfClient(), mockOrbisClient());
    const res = await app.request("http://localhost/v1/download/curseforge/123/0");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("returns 400 for non-numeric projectId", async () => {
    const app = appWithDownload(mockCfClient(), mockOrbisClient());
    const res = await app.request("http://localhost/v1/download/curseforge/abc/456");
    expect(res.status).toBe(400);
  });

  test("returns 503 DOWNLOAD_NOT_AVAILABLE when URL is null", async () => {
    const app = appWithDownload(mockCfClient(), mockOrbisClient());
    const res = await app.request("http://localhost/v1/download/curseforge/306612/4500000");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      code: "DOWNLOAD_NOT_AVAILABLE",
      message: expect.stringContaining("not available"),
    });
  });

  test("returns 200 and JSON { url } when URL is available", async () => {
    const fakeUrl = "https://edge.forgecdn.net/files/1234/567/mod.jar";
    const cf = mockCfClient({
      getFileDownloadUrl: async () => fakeUrl,
    });
    const app = appWithDownload(cf, mockOrbisClient());
    const res = await app.request("http://localhost/v1/download/curseforge/306612/4500000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ url: fakeUrl });
  });
});
