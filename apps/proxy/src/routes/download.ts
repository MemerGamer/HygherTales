import { Hono } from "hono";
import { z } from "@hyghertales/shared";
import { downloadResponseSchema } from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import { AppError } from "../lib/errors.js";

/**
 * Download helper: GET /v1/download/:projectId/:fileId
 *
 * We return JSON { url: string } (Option A) rather than streaming file bytes (Option B)
 * so that: (1) the client can download directly from CurseForge, avoiding proxy bandwidth;
 * (2) CurseForge often returns time-limited signed URLs—streaming would require the proxy
 * to hold the connection and could hit token expiry; (3) the proxy stays stateless.
 * We never log full URLs because they may contain tokens.
 */
const paramsSchema = z.object({
  projectId: z.coerce.number().int().min(1),
  fileId: z.coerce.number().int().min(1),
});

export function createDownloadRoutes(cf: CurseForgeClient) {
  const download = new Hono();

  download.get("/:projectId/:fileId", async (c) => {
    const parsed = paramsSchema.safeParse(c.req.param());
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

  return download;
}
