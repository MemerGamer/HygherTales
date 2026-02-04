/**
 * Parse CurseForge Hytale mod page URL to extract the mod slug.
 * Example: https://www.curseforge.com/hytale/mods/epics-potion-trader -> { slug: "epics-potion-trader" }
 * Only Hytale mod URLs are accepted (this launcher is Hytale-only).
 */
export function parseCurseForgeModUrl(url: string): { slug: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== "www.curseforge.com" && host !== "curseforge.com") {
      return null;
    }
    // /hytale/mods/<slug> or /hytale/mods/<slug>/...
    const segments = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const hytaleIndex = segments.findIndex((s) => s.toLowerCase() === "hytale");
    const modsIndex = segments.findIndex((s) => s.toLowerCase() === "mods");
    if (
      hytaleIndex === -1 ||
      modsIndex === -1 ||
      modsIndex !== hytaleIndex + 1 ||
      modsIndex >= segments.length - 1
    ) {
      return null;
    }
    const slug = segments[modsIndex + 1];
    if (!slug || slug.length === 0) return null;
    return { slug };
  } catch {
    return null;
  }
}
