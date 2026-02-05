#!/usr/bin/env node
/**
 * Generate icon.ico from icon.png for Windows build.
 * Run from apps/desktop: node scripts/generate-icon-ico.mjs
 */
import { writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pngPath = join(root, "src-tauri", "icons", "icon.png");
const icoPath = join(root, "src-tauri", "icons", "icon.ico");

if (!existsSync(pngPath)) {
  console.error("Missing source:", pngPath);
  process.exit(1);
}

const mod = await import("png-to-ico");
const pngToIco = mod.default ?? mod;
if (typeof pngToIco !== "function") {
  console.error("png-to-ico export not found");
  process.exit(1);
}

const icoBuffer = await pngToIco(pngPath);
writeFileSync(icoPath, icoBuffer);
console.log("Wrote", icoPath);
