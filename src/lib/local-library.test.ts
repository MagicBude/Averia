import { describe, expect, it } from "vitest";

import {
  createLibraryExport,
  mergeLibraryExport,
  normalizeStoredLibrary,
  parseLibraryExport,
} from "./local-library";

describe("local library", () => {
  it("keeps old version 1 favorites while adding empty annotations", () => {
    expect(
      normalizeStoredLibrary({ version: 1, favorites: { people: ["p1"], works: ["w1"] } }),
    ).toEqual({
      version: 1,
      favorites: { people: ["p1"], works: ["w1"] },
      annotations: {},
    });
  });

  it("exports favorites and private annotations without losing entity types", () => {
    const value = createLibraryExport(
      {
        version: 1,
        favorites: { people: ["p1"], works: [] },
        annotations: { "person:p1": { tags: ["稍后查看"], note: "本地备注" } },
      },
      "2026-09-22T00:00:00.000Z",
    );

    expect(value.items).toEqual([
      {
        entityType: "person",
        entityId: "p1",
        favorite: true,
        tags: ["稍后查看"],
        note: "本地备注",
      },
    ]);
  });

  it("rejects unsupported imports before they can mutate local data", () => {
    expect(() => parseLibraryExport('{"format":"unknown","version":1,"items":[]}')).toThrow(
      "不是受支持",
    );
  });

  it("merges imported values by entity and preserves unrelated local entries", () => {
    const current = normalizeStoredLibrary({
      version: 1,
      favorites: { people: ["p2"], works: [] },
      annotations: { "person:p2": { tags: [], note: "保留" } },
    });
    const imported = parseLibraryExport(
      JSON.stringify({
        format: "averia-local-library",
        version: 1,
        exportedAt: "2026-09-22T00:00:00.000Z",
        items: [
          {
            entityType: "work",
            entityId: "w1",
            favorite: true,
            tags: ["精选"],
            note: "导入",
          },
        ],
      }),
    );

    expect(mergeLibraryExport(current, imported)).toMatchObject({
      favorites: { people: ["p2"], works: ["w1"] },
      annotations: {
        "person:p2": { tags: [], note: "保留" },
        "work:w1": { tags: ["精选"], note: "导入" },
      },
    });
  });
});
