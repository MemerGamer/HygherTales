import { describe, expect, test } from "bun:test";
import { parseCurseForgeModUrl } from "./curseforgeUrl.js";

describe("parseCurseForgeModUrl", () => {
  test("extracts slug from standard minecraft mc-mods URL", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/minecraft/mc-mods/fabric-api")
    ).toEqual({ slug: "fabric-api" });
  });

  test("extracts slug from curseforge.com without www", () => {
    expect(
      parseCurseForgeModUrl("https://curseforge.com/minecraft/mc-mods/curios")
    ).toEqual({ slug: "curios" });
  });

  test("returns null for non-CurseForge host", () => {
    expect(parseCurseForgeModUrl("https://modrinth.com/mod/fabric-api")).toBeNull();
  });

  test("returns null when path has no mc-mods segment", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/minecraft/texture-packs/something")
    ).toBeNull();
  });

  test("returns null for invalid URL", () => {
    expect(parseCurseForgeModUrl("not-a-url")).toBeNull();
  });
});
