import { describe, expect, test } from "bun:test";
import { createTtlCache } from "./cache.js";

describe("createTtlCache", () => {
  test("get returns undefined for missing key", () => {
    const cache = createTtlCache<number>(60_000);
    expect(cache.get("missing")).toBeUndefined();
  });

  test("set then get returns value", () => {
    const cache = createTtlCache<number>(60_000);
    cache.set("a", 42);
    expect(cache.get("a")).toBe(42);
  });

  test("get returns undefined after TTL expires", async () => {
    const cache = createTtlCache<number>(50); // 50ms TTL
    cache.set("b", 1);
    expect(cache.get("b")).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("b")).toBeUndefined();
  });

  test("delete removes key", () => {
    const cache = createTtlCache<string>(60_000);
    cache.set("c", "v");
    expect(cache.get("c")).toBe("v");
    expect(cache.delete("c")).toBe(true);
    expect(cache.get("c")).toBeUndefined();
  });
});
