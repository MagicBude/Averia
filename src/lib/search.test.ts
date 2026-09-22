import { describe, expect, it } from "vitest";

import { findSearchMatch, matchesSearch, normalizeSearchText } from "./search";

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

  it("允许轻微拼写错误，但只返回排序和展示信息", () => {
    expect(findSearchMatch("Haruka Amam", ["天海遥", "Haruka Amami"])).toEqual({
      index: 1,
      kind: "prefix",
      score: 80,
      value: "Haruka Amami",
    });
    expect(findSearchMatch("Haruka Amqmi", ["Haruka Amami"])?.kind).toBe("fuzzy");
  });

  it("返回实际命中的别名而不是规范名", () => {
    expect(findSearchMatch("水原りん", ["水原凛", "水原りん", "Rin Mizuhara"])?.index).toBe(1);
  });
});
