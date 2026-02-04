import { Hono } from "hono";
import { healthResponseSchema } from "@hyghertales/shared";

const health = new Hono();

health.get("/", (c) => {
  const body = healthResponseSchema.parse({ ok: true as const });
  return c.json(body);
});

export default health;
