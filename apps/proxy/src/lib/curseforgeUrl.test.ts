import { describe, expect, test } from "bun:test";
import { parseCurseForgeModUrl } from "./curseforgeUrl.js";

describe("parseCurseForgeModUrl (Hytale only)", () => {
  test("extracts slug from Hytale mod URL", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/hytale/mods/epics-potion-trader")
    ).toEqual({ slug: "epics-potion-trader" });
  });

  test("extracts slug from curseforge.com without www", () => {
    expect(
      parseCurseForgeModUrl("https://curseforge.com/hytale/mods/some-mod")
    ).toEqual({ slug: "some-mod" });
  });

  test("extracts slug from URL with trailing path (e.g. install)", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/hytale/mods/my-mod/install/123")
    ).toEqual({ slug: "my-mod" });
  });

  test("returns null for non-CurseForge host", () => {
    expect(parseCurseForgeModUrl("https://modrinth.com/mod/fabric-api")).toBeNull();
  });

  test("returns null for Minecraft URL (not Hytale)", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/minecraft/mc-mods/fabric-api")
    ).toBeNull();
  });

  test("returns null when path has no hytale/mods segment", () => {
    expect(
      parseCurseForgeModUrl("https://www.curseforge.com/hytale/search")
    ).toBeNull();
  });

  test("returns null for invalid URL", () => {
    expect(parseCurseForgeModUrl("not-a-url")).toBeNull();
  });
});
