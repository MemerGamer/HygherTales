import { Hono } from "hono";
import { z } from "@hyghertales/shared";
import {
  modSearchRequestSchema,
  modSearchResponseSchema,
} from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";
import { AppError } from "../lib/errors.js";

const querySchema = z.object({
  q: z.string().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function createSearchRoutes(cf: CurseForgeClient) {
  const search = new Hono();

  search.get("/", async (c) => {
    const parsed = querySchema.safeParse({
      q: c.req.query("q"),
      page: c.req.query("page"),
      pageSize: c.req.query("pageSize"),
    });

    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const request = modSearchRequestSchema.parse(parsed.data);
    const response = await cf.search(request);
    const body = modSearchResponseSchema.parse(response);
    return c.json(body);
  });

  return search;
}
