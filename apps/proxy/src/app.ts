import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorResponseSchema } from "@hyghertales/shared";
import health from "./routes/health.js";
import { createSearchRoutes } from "./routes/search.js";
import { createModRoutes } from "./routes/mod.js";
import { createResolveRoutes } from "./routes/resolve.js";
import { createCurseForgeClient } from "./lib/curseforge.js";
import { AppError } from "./lib/errors.js";
import { env } from "./lib/env.js";

const cf = createCurseForgeClient(env.CURSEFORGE_API_KEY, env.CURSEFORGE_GAME_ID);

const app = new Hono();

// CORS: allowlist from env (defaults include localhost for desktop dev)
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      const allowed = env.CORS_ORIGINS;
      if (allowed.includes("*") || allowed.includes(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Health (no prefix)
app.route("/health", health);

// v1 API
app.route("/v1/search", createSearchRoutes(cf));
app.route("/v1/mod", createModRoutes(cf));
app.route("/v1/resolve-from-url", createResolveRoutes(cf));

// Central error handler: return ErrorResponse consistently
type HttpStatus = 400 | 404 | 500;
app.onError((err, c) => {
  if (err instanceof AppError) {
    const body = errorResponseSchema.parse(err.toJSON());
    return c.json(body, err.status as HttpStatus);
  }
  const body = errorResponseSchema.parse({
    code: "INTERNAL_ERROR",
    message: err.message ?? "Internal server error",
    details: undefined,
  });
  return c.json(body, 500 as HttpStatus);
});

export default app;
