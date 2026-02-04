import { Hono } from "hono";
import { z } from "@hyghertales/shared";
import { downloadResponseSchema } from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import type { OrbisClient } from "../lib/orbis.js";
import { AppError } from "../lib/errors.js";

/**
 * Download helper: returns JSON { url: string } so the client can download directly.
 * CurseForge: GET /v1/download/curseforge/:projectId/:fileId
 * Orbis: GET /v1/download/orbis/:resourceId/:versionId/:fileIndex
 * We never log full URLs because they may contain tokens.
 */
const cfParamsSchema = z.object({
  projectId: z.coerce.number().int().min(1),
  fileId: z.coerce.number().int().min(1),
});

const orbisParamsSchema = z.object({
  resourceId: z.string().min(1),
  versionId: z.string().min(1),
  fileIndex: z.coerce.number().int().min(0),
});

export function createDownloadRoutes(cf: CurseForgeClient, orbis: OrbisClient) {
  const download = new Hono();

  download.get("/curseforge/:projectId/:fileId", async (c) => {
    const parsed = cfParamsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid projectId or fileId",
        400
      );
    }

    const { projectId, fileId } = parsed.data;
    const url = await cf.getFileDownloadUrl(projectId, fileId);

    if (url == null || url === "") {
      throw new AppError(
        "DOWNLOAD_NOT_AVAILABLE",
        "Download URL is not available for this file (CurseForge may block distribution or the file is not accessible).",
        503
      );
    }

    const body = downloadResponseSchema.parse({ url });
    return c.json(body);
  });

  download.get("/orbis/:resourceId/:versionId/:fileIndex", async (c) => {
    const parsed = orbisParamsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid resourceId, versionId or fileIndex",
        400
      );
    }

    const { resourceId, versionId, fileIndex } = parsed.data;
    const filesResponse = await orbis.getVersions(resourceId);
    const file = filesResponse.files.find(
      (f) => f.versionId === versionId && f.fileIndex === fileIndex
    );

    if (file?.downloadUrl == null || file.downloadUrl === "") {
      throw new AppError(
        "DOWNLOAD_NOT_AVAILABLE",
        "Download URL is not available for this Orbis file.",
        503
      );
    }

    const body = downloadResponseSchema.parse({ url: file.downloadUrl });
    return c.json(body);
  });

  return download;
}
