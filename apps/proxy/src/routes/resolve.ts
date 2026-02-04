import { Hono } from "hono";
import {
  resolveFromUrlRequestSchema,
  resolveFromUrlResponseSchema,
} from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import type { OrbisClient } from "../lib/orbis.js";
import { parseOrbisModUrl } from "../lib/orbisUrl.js";
import { AppError } from "../lib/errors.js";

export function createResolveRoutes(cf: CurseForgeClient, orbis: OrbisClient) {
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

    const url = parsed.data.url;

    const cfResult = await cf.resolveFromUrl(url);
    if (cfResult != null) {
      const response = resolveFromUrlResponseSchema.parse(cfResult);
      return c.json(response);
    }

    const orbisParsed = parseOrbisModUrl(url);
    if (orbisParsed != null) {
      const details = await orbis.getResourceBySlug(orbisParsed.slug);
      if (details != null && details.provider === "orbis") {
        const response = resolveFromUrlResponseSchema.parse({
          provider: "orbis",
          resourceId: details.resourceId,
          slug: details.slug,
        });
        return c.json(response);
      }
    }

    throw new AppError(
      "NOT_FOUND",
      "Could not resolve URL to a CurseForge or Orbis.place mod",
      404
    );
  });

  return resolve;
}
