#!/usr/bin/env node
/**
 * Build the full desktop app with the proxy sidecar and env burned in (compact monolith).
 *
 * Prerequisites:
 *   - CURSEFORGE_API_KEY must be set (it will be embedded in the sidecar binary).
 *
 * Usage (from repo root):
 *   CURSEFORGE_API_KEY=your_key bun run build:monolith
 *   # or
 *   export CURSEFORGE_API_KEY=your_key && bun run build:monolith
 *
 * Optional: override target (linux|windows|macos) for cross-build:
 *   CURSEFORGE_API_KEY=your_key bun run build:monolith -- --target=linux
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd, args, opts = {}) {
  const cwd = opts.cwd ?? root;
  const env = { ...process.env, ...opts.env };
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd, env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

// Detect platform: linux | windows | macos
const platform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";

// Parse optional --target=...
let target = platform;
const targetArg = process.argv.slice(2).find((a) => a.startsWith("--target="));
if (targetArg) {
  target = targetArg.split("=")[1];
  if (!["linux", "windows", "macos"].includes(target)) {
    console.error("Invalid --target. Use: linux, windows, or macos");
    process.exit(1);
  }
}

if (!process.env.CURSEFORGE_API_KEY?.trim()) {
  console.error("CURSEFORGE_API_KEY is required. Set it before running:");
  console.error("  export CURSEFORGE_API_KEY=your_key");
  console.error("  bun run build:monolith");
  process.exit(1);
}

console.log("Building compact monolith (sidecar + env burned in) for", target);

// 1. Shared package
run("bun", ["run", "build"], { cwd: join(root, "packages/shared") });

// 2. Proxy sidecar (env burned in) for this platform
run("bun", ["run", "build:sidecar", "--", `--target=${target}`], {
  cwd: join(root, "apps/proxy"),
  env: { CURSEFORGE_API_KEY: process.env.CURSEFORGE_API_KEY },
});

// 3. Generate icon.ico (Tauri bundle expects icons/icon.ico on all platforms)
run("bun", ["run", "generate-icon-ico"], { cwd: join(root, "apps/desktop") });

// 4. Desktop app (bundles the sidecar from apps/desktop/src-tauri/binaries)
run("bun", ["run", "build"], { cwd: join(root, "apps/desktop") });

console.log("\nDone. Bundles are in apps/desktop/src-tauri/target/release/bundle/");
