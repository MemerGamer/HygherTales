import { Hono } from "hono";
import {
  resolveFromUrlRequestSchema,
  resolveFromUrlResponseSchema,
} from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import { AppError } from "../lib/errors.js";

export function createResolveRoutes(cf: CurseForgeClient) {
  const resolve = new Hono();

  resolve.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid JSON body",
        400
      );
    }

    const parsed = resolveFromUrlRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.flatten()
      );
    }

    const result = await cf.resolveFromUrl(parsed.data.url);
    if (result == null) {
      throw new AppError(
        "NOT_FOUND",
        "Could not resolve URL to a CurseForge mod",
        404
      );
    }

    const response = resolveFromUrlResponseSchema.parse(result);
    return c.json(response);
  });

  return resolve;
}
