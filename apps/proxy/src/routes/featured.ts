import { Hono } from "hono";
import { modSearchResponseSchema } from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";

export function createFeaturedRoutes(cf: CurseForgeClient) {
  const featured = new Hono();

  featured.get("/", async (c) => {
    const response = await cf.getFeaturedMods();
    const body = modSearchResponseSchema.parse(response);
    return c.json(body);
  });

  return featured;
}
