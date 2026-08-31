import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { normalizeName, prepareImport, recordHash } from "../scripts/import/lib.mjs";

test("女优姓名标准化只做确定性精确规则", () => {
  assert.equal(normalizeName("  Ａ B　C  "), "abc");
  assert.notEqual(normalizeName("波多野结衣"), normalizeName("波多野结衣A"));
});

test("原始记录 Hash 不受对象字段顺序影响", () => {
  assert.equal(recordHash({ a: 1, b: 2 }), recordHash({ b: 2, a: 1 }));
});

test("统一导入格式可以为全新女优和作品生成可审核 Stage", () => {
  const catalog = loadCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "test-source", fetched_at: "2026-08-31T08:30:00Z" },
    actresses: [{ source_record_id: "a-1", primary_name: "测试女优", aliases: ["Test Actress"] }],
    works: [{ source_record_id: "w-1", code: "TST-001", title: "测试作品", cast: [{ source_record_id: "a-1" }] }],
  }, { catalog, batchId: "test", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.actresses.length, 1);
  assert.equal(stage.append.works.length, 1);
  assert.equal(stage.append.work_cast.length, 1);
  assert.equal(stage.append.source_records.length, 2);
  assert.equal(stage.append.work_codes[0].normalized_code, "TST001");
});

test("无法解析的作品参演者会阻止批次自动应用", () => {
  const catalog = loadCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "test-source" },
    works: [{ code: "TST-002", title: "测试作品2", cast: [{ name: "不存在的女优" }] }],
  }, { catalog, batchId: "test", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 1);
  assert.equal(stage.issues[0].type, "unresolved-cast");
});
