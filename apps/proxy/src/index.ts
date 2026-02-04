import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ ok: true as const });
});

const port = Number(Bun.env.PORT) || 3000;

Bun.serve({
  port,
  fetch: app.fetch,
});
