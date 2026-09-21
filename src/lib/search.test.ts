import { describe, expect, it } from "vitest";

import { matchesSearch, normalizeSearchText } from "./search";

describe("normalizeSearchText", () => {
  it("归一化全角字符、大小写和多余空格", () => {
    expect(normalizeSearchText("  ＤＥＭＯ　００１  ")).toBe("demo 001");
  });

  it("统一常见连字符", () => {
    expect(normalizeSearchText("DEMO—001")).toBe("demo-001");
  });
});

describe("matchesSearch", () => {
  it("可以通过别名命中实体", () => {
    expect(matchesSearch("Haruka", ["天海遥", "天海はるか", "Haruka Amami"])).toBe(true);
  });

  it("空查询返回全部候选", () => {
    expect(matchesSearch(" ", ["任意值"])).toBe(true);
  });
});
