/**
 * Parse CurseForge mod page URL to extract slug (and optionally projectId if present).
 * Example: https://www.curseforge.com/minecraft/mc-mods/fabric-api -> { slug: "fabric-api" }
 */
export function parseCurseForgeModUrl(url: string): { slug: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      host !== "www.curseforge.com" &&
      host !== "curseforge.com"
    ) {
      return null;
    }
    // /minecraft/mc-mods/<slug> or /mc-mods/<slug> etc.
    const segments = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const mcModsIndex = segments.findIndex(
      (s) => s.toLowerCase() === "mc-mods"
    );
    if (mcModsIndex === -1 || mcModsIndex >= segments.length - 1) return null;
    const slug = segments[mcModsIndex + 1];
    if (!slug || slug.length === 0) return null;
    return { slug };
  } catch {
    return null;
  }
}
