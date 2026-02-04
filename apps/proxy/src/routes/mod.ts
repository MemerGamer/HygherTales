import { Hono } from "hono";
import { z } from "@hyghertales/shared";
import {
  modDetailsResponseSchema,
  modFilesResponseSchema,
} from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import { AppError } from "../lib/errors.js";

const projectIdParam = z.object({
  projectId: z.coerce.number().int().min(1),
});

export function createModRoutes(cf: CurseForgeClient) {
  const mod = new Hono();

  mod.get("/:projectId", async (c) => {
    const parsed = projectIdParam.safeParse(c.req.param());
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid projectId", 400);
    }

    const details = await cf.getMod(parsed.data.projectId);
    if (details == null) {
      throw new AppError("NOT_FOUND", "Mod project not found", 404);
    }

    const body = modDetailsResponseSchema.parse(details);
    return c.json(body);
  });

  mod.get("/:projectId/files", async (c) => {
    const parsed = projectIdParam.safeParse(c.req.param());
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid projectId", 400);
    }

    const response = await cf.getModFiles(parsed.data.projectId);
    const body = modFilesResponseSchema.parse(response);
    return c.json(body);
  });

  return mod;
}
