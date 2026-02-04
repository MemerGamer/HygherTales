import { Hono } from "hono";
import { modCategoriesResponseSchema } from "@hyghertales/shared";
import type { CurseForgeClient } from "../lib/curseforge.js";

export function createCategoriesRoutes(cf: CurseForgeClient) {
  const categories = new Hono();

  categories.get("/", async (c) => {
    const response = await cf.getCategories();
    const body = modCategoriesResponseSchema.parse(response);
    return c.json(body);
  });

  return categories;
}
