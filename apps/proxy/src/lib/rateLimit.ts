import type { Context, Next } from "hono";

/**
 * Per-IP rate limit: max requests per minute. Uses a simple in-memory map.
 * Configurable via env RATE_LIMIT_PER_MIN.
 */
export function createRateLimitMiddleware(maxPerMinute: number) {
  const counts = new Map<string, { n: number; resetAt: number }>();
  const WINDOW_MS = 60_000;

  return async function rateLimit(c: Context, next: Next) {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const now = Date.now();
    let entry = counts.get(ip);
    if (!entry || now >= entry.resetAt) {
      entry = { n: 0, resetAt: now + WINDOW_MS };
      counts.set(ip, entry);
    }
    entry.n += 1;
    if (entry.n > maxPerMinute) {
      return c.json(
        { code: "RATE_LIMITED", message: "Too many requests", details: undefined },
        { status: 429 }
      );
    }
    await next();
  };
}
