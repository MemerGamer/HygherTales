#!/usr/bin/env node
/**
 * Fallback: generate icon.ico from icon.png when "tauri icon" is not available (e.g. CI Windows).
 * Run from apps/desktop: node scripts/generate-icon-ico.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pngPath = join(root, "src-tauri", "icons", "icon.png");
const icoPath = join(root, "src-tauri", "icons", "icon.ico");

const pngToIco = (await import("png-to-ico")).default;
const icoBuffer = await pngToIco(pngPath);
writeFileSync(icoPath, icoBuffer);
console.log("Wrote", icoPath);
