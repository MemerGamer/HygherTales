import { config } from "dotenv";
import { resolve } from "path";

// Bun has a bug where $ in .env values truncates everything after it.
// CRITICAL: Delete the mangled value from process.env FIRST, then load with dotenv
if (process.env.CURSEFORGE_API_KEY) {
  delete process.env.CURSEFORGE_API_KEY;
}

// Now load .env with dotenv (which handles $ correctly)
config({ path: resolve(import.meta.dir, "../.env"), override: true });
