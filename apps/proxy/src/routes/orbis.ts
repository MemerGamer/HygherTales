import { Hono } from "hono";
import { z } from "@hyghertales/shared";
import { modSearchResponseSchema } from "@hyghertales/shared";
import type { OrbisClient } from "../lib/orbis.js";
import { AppError } from "../lib/errors.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["date", "downloads", "name"]).optional(),
  q: z.string().optional(),
});

export function createOrbisRoutes(orbis: OrbisClient) {
  const routes = new Hono();

  /** GET /v1/orbis/featured – first page of Orbis mods (same as list with default params). */
  routes.get("/featured", async (c) => {
    const response = await orbis.list({ page: 1, limit: 20, sortBy: "date" });
    const body = modSearchResponseSchema.parse(response);
    return c.json(body);
  });

  /** GET /v1/orbis/search?page=1&limit=20&sortBy=date&q=... – paginated list with optional text search. */
  routes.get("/search", async (c) => {
    const parsed = querySchema.safeParse({
      page: c.req.query("page"),
      limit: c.req.query("limit"),
      sortBy: c.req.query("sortBy"),
      q: c.req.query("q"),
    });

    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const response = await orbis.list({
      page: parsed.data.page,
      limit: parsed.data.limit,
      sortBy: parsed.data.sortBy,
      ...(parsed.data.q != null && parsed.data.q.trim() && { search: parsed.data.q.trim() }),
    });
    const body = modSearchResponseSchema.parse(response);
    return c.json(body);
  });

  return routes;
}
