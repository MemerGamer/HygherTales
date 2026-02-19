import "./loadEnv.js"; // Must be first! Loads .env before Bun's broken parser

import { EMBEDDED_CURSEFORGE_API_KEY } from "./.embedded-env.js";
if (typeof EMBEDDED_CURSEFORGE_API_KEY === "string") {
  process.env.CURSEFORGE_API_KEY = EMBEDDED_CURSEFORGE_API_KEY;
  console.log("[sidecar] Using embedded CurseForge API key");
}

import { env } from "./lib/env.js";
import app from "./app.js";

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});
console.log(`HygherTales proxy listening on http://localhost:${env.PORT}`);
