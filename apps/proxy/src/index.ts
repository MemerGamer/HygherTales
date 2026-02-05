import "./loadEnv.js"; // Must be first! Loads .env before Bun's broken parser

// Check for embedded API key (from compiled binary) and inject it before env validation
// The .embedded-env.ts file is generated at compile time, so we use dynamic import
try {
  const embeddedEnv = await import("./.embedded-env.js" as string);
  if (embeddedEnv && typeof embeddedEnv.EMBEDDED_CURSEFORGE_API_KEY === "string") {
    process.env.CURSEFORGE_API_KEY = embeddedEnv.EMBEDDED_CURSEFORGE_API_KEY;
    console.log("[sidecar] Using embedded CurseForge API key");
  }
} catch {
  // .embedded-env.js doesn't exist (normal for dev mode)
}

import { env } from "./lib/env.js";
import app from "./app.js";

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});
console.log(`HygherTales proxy listening on http://localhost:${env.PORT}`);
