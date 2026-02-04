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
  categoryId: z.coerce.number().int().min(0).optional(),
  sortField: z.coerce.number().int().min(0).max(6).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export function createSearchRoutes(cf: CurseForgeClient) {
  const search = new Hono();

  search.get("/", async (c) => {
    const parsed = querySchema.safeParse({
      q: c.req.query("q"),
      page: c.req.query("page"),
      pageSize: c.req.query("pageSize"),
      categoryId: c.req.query("categoryId"),
      sortField: c.req.query("sortField"),
      sortOrder: c.req.query("sortOrder"),
    });

    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const request = modSearchRequestSchema.parse({
      ...parsed.data,
      categoryId: parsed.data.categoryId === 0 ? undefined : parsed.data.categoryId,
      sortField: parsed.data.sortField === 0 ? undefined : parsed.data.sortField,
    });
    const response = await cf.search(request);
    const body = modSearchResponseSchema.parse(response);
    return c.json(body);
  });

  return search;
}
