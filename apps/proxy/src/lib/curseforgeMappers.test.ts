import { describe, expect, test } from "bun:test";
import {
  mapCfModToModSummary,
  mapCfModToModDetails,
  mapCfFileToModFile,
  type CfMod,
  type CfFile,
} from "./curseforgeMappers.js";

describe("mapCfModToModSummary", () => {
  test("maps full mod to ModSummary", () => {
    const cf: CfMod = {
      id: 306612,
      slug: "fabric-api",
      name: "Fabric API",
      summary: "Core API.",
      logo: { url: "https://example.com/logo.png" },
    };
    expect(mapCfModToModSummary(cf, 306612)).toEqual({
      provider: "curseforge",
      projectId: 306612,
      slug: "fabric-api",
      name: "Fabric API",
      summary: "Core API.",
      logoUrl: "https://example.com/logo.png",
    });
  });

  test("uses null for missing optional fields", () => {
    const cf: CfMod = { id: 1 };
    expect(mapCfModToModSummary(cf, 1)).toEqual({
      provider: "curseforge",
      projectId: 1,
      slug: "",
      name: "",
      summary: null,
      logoUrl: null,
    });
  });
});

describe("mapCfModToModDetails", () => {
  test("includes description", () => {
    const cf: CfMod = {
      id: 2,
      slug: "x",
      name: "X",
      description: "Long description",
    };
    expect(mapCfModToModDetails(cf, 2).description).toBe("Long description");
  });
});

describe("mapCfFileToModFile", () => {
  test("maps file and release type", () => {
    const cf: CfFile = {
      id: 4500000,
      fileName: "mod-1.0.jar",
      displayName: "1.0",
      fileDate: "2024-01-15T12:00:00Z",
      releaseType: 1,
    };
    expect(mapCfFileToModFile(cf, 306612)).toEqual({
      fileId: 4500000,
      fileName: "mod-1.0.jar",
      displayName: "1.0",
      releaseType: "release",
      fileDate: "2024-01-15T12:00:00Z",
      downloadUrl: null,
    });
  });

  test("maps beta release type", () => {
    const cf: CfFile = { id: 1, fileName: "a.jar", releaseType: 2 };
    expect(mapCfFileToModFile(cf, 1).releaseType).toBe("beta");
  });
});
