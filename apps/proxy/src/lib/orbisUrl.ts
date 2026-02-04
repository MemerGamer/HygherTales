/**
 * Parse Orbis.place mod/resource page URL to extract the slug.
 * Examples:
 *   https://www.orbis.place/mod/bettermap -> { slug: "bettermap" }
 *   https://orbis.place/plugin/votale -> { slug: "votale" }
 */
export function parseOrbisModUrl(url: string): { slug: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== "www.orbis.place" && host !== "orbis.place") {
      return null;
    }
    const segments = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    // /mod/<slug> or /plugin/<slug> or /resources/<slug>
    const typeIndex = segments.findIndex(
      (s) =>
        s.toLowerCase() === "mod" ||
        s.toLowerCase() === "plugin" ||
        s.toLowerCase() === "resources"
    );
    if (typeIndex === -1 || typeIndex >= segments.length - 1) {
      return null;
    }
    const slug = segments[typeIndex + 1];
    if (!slug || slug.length === 0) return null;
    return { slug };
  } catch {
    return null;
  }
}
