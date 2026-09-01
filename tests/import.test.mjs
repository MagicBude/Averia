import test from "node:test";
import assert from "node:assert/strict";
import { normalizeName, prepareImport, recordHash } from "../scripts/import/lib.mjs";
import { loadEmptyCatalog } from "./helpers/catalog.mjs";

test("女优姓名标准化只做确定性精确规则", () => {
  assert.equal(normalizeName("  Ａ B　C  "), "abc");
  assert.notEqual(normalizeName("波多野结衣"), normalizeName("波多野结衣A"));
});

test("原始记录 Hash 不受对象字段顺序影响", () => {
  assert.equal(recordHash({ a: 1, b: 2 }), recordHash({ b: 2, a: 1 }));
});

test("统一导入格式可以为全新女优和作品生成可审核 Stage", () => {
  const catalog = loadEmptyCatalog();
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
  const catalog = loadEmptyCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "test-source" },
    works: [{ code: "TST-002", title: "测试作品2", cast: [{ name: "不存在的女优" }] }],
  }, { catalog, batchId: "test", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 1);
  assert.equal(stage.issues[0].type, "unresolved-cast");
});


test("统一导入格式可以为作品建立导演实体和作品导演关系", () => {
  const catalog = loadEmptyCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "test-source" },
    works: [{ code: "TST-003", title: "测试作品3", directors: [{ name: "测试导演", name_ja: "测试导演" }] }],
  }, { catalog, batchId: "test-director", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.directors.length, 1);
  assert.equal(stage.append.directors[0].name, "测试导演");
  assert.equal(stage.append.work_directors.length, 1);
  assert.equal(stage.append.work_directors[0].director_id, stage.append.directors[0].id);
});

test("空导入批次不产生任何 observations（V0.8 Phase 2）", () => {
  const catalog = loadEmptyCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "test-source", fetched_at: "2026-08-31T08:30:00Z" },
    actresses: [],
    works: [],
  }, { catalog, batchId: "empty", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.observations.length, 0);
  assert.equal(stage.summary.append_counts.observations, 0);
});

test("Prepare 对每个贡献字段产出 observations（含跨语言 taxonomy，V0.8 Phase 2）", () => {
  const catalog = loadEmptyCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-08-31T08:30:00Z" },
    actresses: [{ source_record_id: "a-1", primary_name: "テスト", name_en: "Test Actress", height_cm: "160" }],
    works: [{
      source_record_id: "w-1", code: "TST-001", title: "Test Title", title_ja: "テスト作品",
      maker: { name: "Idea Pocket" },
      label: { name: "Dish" },
      genres: [{ name: "Slender" }],
      cast: [{ source_record_id: "a-1" }],
    }],
  }, { catalog, batchId: "obs", now: "2026-08-31T08:30:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  const obs = stage.append.observations;
  assert.ok(obs.length > 0, "应有 observations 产出");

  // 女优 name_en 观察来自 javinfo-fanza，语言标记为 en
  const actressId = stage.append.actresses[0].id;
  const nameEnObs = obs.find((o) => o.entity_type === "actress" && o.entity_id === actressId && o.field === "name_en");
  assert.ok(nameEnObs, "应记录女优 name_en 观察");
  assert.equal(nameEnObs.observed_value, "Test Actress");
  assert.equal(nameEnObs.observed_language, "en");
  assert.equal(nameEnObs.source_name, "javinfo-fanza");

  // 跨语言 taxonomy 名称观察：Idea Pocket（maker）/ Dish（label）/ Slender（genre），语言标记 en
  const makerId = stage.append.makers[0].id;
  const makerObs = obs.find((o) => o.entity_type === "maker" && o.entity_id === makerId && o.field === "name");
  assert.ok(makerObs, "应记录 maker name 观察");
  assert.equal(makerObs.observed_value, "Idea Pocket");
  assert.equal(makerObs.observed_language, "en");

  const genreId = stage.append.genres[0].id;
  const genreObs = obs.find((o) => o.entity_type === "genre" && o.entity_id === genreId && o.field === "name");
  assert.ok(genreObs, "应记录 genre name 观察");
  assert.equal(genreObs.observed_value, "Slender");
});

test("匹配既有实体的来源观察也会写入 observations（不静默丢弃，V0.8 Phase 2）", () => {
  // 使用真实目录（MDVR-434 已入库），验证“测试不能假设 CSV 永远为空”
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "moodyz-official", fetched_at: "2026-08-31T08:30:00Z" },
    works: [{ source_record_id: "mdvr-434-page", code: "MDVR-434", title: "再収録作品", title_ja: "純白彩永の作品" }],
  }, { batchId: "match", now: "2026-08-31T08:30:00Z", fingerprint: "x" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.works.length, 0, "应匹配既有作品，不新增");
  assert.ok(stage.append.observations.length > 0, "匹配既有实体也应产出 observations");
  const workObs = stage.append.observations.find((o) => o.entity_type === "work" && o.field === "title_ja");
  assert.ok(workObs, "应记录匹配作品的 title_ja 观察");
  assert.equal(workObs.source_name, "moodyz-official");
});
