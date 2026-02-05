import "./loadEnv.js"; // Must be first! Loads .env before Bun's broken parser
import { env } from "./lib/env.js";
import app from "./app.js";

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});
console.log(`HygherTales proxy listening on http://localhost:${env.PORT}`);
