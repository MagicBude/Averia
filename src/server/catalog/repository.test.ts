import { afterEach, describe, expect, it } from "vitest";

import { resolveCatalogDataSource } from "./data-source";

describe("catalog data source", () => {
  afterEach(() => delete process.env.AVERIA_DATA_SOURCE);

  it("uses the reviewed demo catalog by default", () => {
    expect(resolveCatalogDataSource()).toBe("demo");
  });

  it("accepts the explicit postgres source", () => {
    expect(resolveCatalogDataSource("postgres")).toBe("postgres");
  });

  it("rejects unknown sources instead of silently falling back", () => {
    expect(() => resolveCatalogDataSource("sqlite")).toThrow("只能使用 demo 或 postgres");
  });
});
