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

// ---------- V0.8 Phase 3：entity_aliases 精确别名匹配（防跨源重复实体） ----------

function catalogWith(patch) {
  const catalog = loadEmptyCatalog();
  for (const [dataset, records] of Object.entries(patch)) catalog[dataset].records = records;
  return catalog;
}

function aliasRow(id, entityType, entityId, alias, aliasType, language) {
  return {
    id, entity_type: entityType, entity_id: entityId, alias, alias_type: aliasType,
    language: language ?? "", source_name: "", source_record_id: "", notes: "", created_at: "2026-09-04T00:00:00Z",
  };
}

test("英文别名可精确命中既有厂商，不新建重复实体（V0.8 Phase 3）", () => {
  const catalog = catalogWith({
    makers: [{ id: "maker_000002", name: "アイデアポケット", name_ja: "アイデアポケット" }],
    entity_aliases: [aliasRow("ea_000001", "maker", "maker_000002", "Idea Pocket", "en", "en")],
  });
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-09-01T06:00:00Z" },
    works: [{ source_record_id: "w-1", code: "IPZZ-597", title: "Grave-bound secret", maker: { name: "Idea Pocket" } }],
  }, { catalog, batchId: "p3-maker", now: "2026-09-01T06:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.makers.length, 0, "别名命中既有厂商，不应新建重复实体");
  assert.equal(stage.append.works[0].maker_id, "maker_000002");
});

test("中文译名别名可精确命中既有分类，不新建重复实体（V0.8 Phase 3 · 中文层）", () => {
  const catalog = catalogWith({
    genres: [{ id: "genre_000007", name: "スレンダー", name_ja: "スレンダー" }],
    entity_aliases: [aliasRow("ea_000002", "genre", "genre_000007", "苗条", "cn", "zh")],
  });
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "manual-cn", fetched_at: "2026-09-04T00:00:00Z" },
    works: [{ source_record_id: "w-2", code: "TST-100", title: "T", genres: [{ name: "苗条" }] }],
  }, { catalog, batchId: "p3-cn", now: "2026-09-04T00:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.genres.length, 0, "中文译名命中既有分类，不应新建");
  assert.equal(stage.append.work_genres[0].genre_id, "genre_000007");
});

test("女优英文别名可精确命中既有女优，不新建重复实体（V0.8 Phase 3）", () => {
  const catalog = catalogWith({
    actresses: [{ id: "actress_000002", primary_name: "桃乃木かな", name_ja: "桃乃木かな", name_en: "", kana: "もものぎ かな" }],
    entity_aliases: [aliasRow("ea_000003", "actress", "actress_000002", "Kana Momonogi", "en", "en")],
  });
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-09-01T06:00:00Z" },
    actresses: [{ source_record_id: "a-1", primary_name: "Kana Momonogi" }],
  }, { catalog, batchId: "p3-actress", now: "2026-09-01T06:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.actresses.length, 0, "英文别名命中既有女优，不应新建重复实体");
  const match = stage.matches.find((m) => m.entity_type === "actress");
  assert.equal(match.entity_id, "actress_000002");
  assert.equal(match.reason, "exact-name-or-alias");
});

test("别名指向多个实体时阻断并报错，绝不自动合并（V0.8 Phase 3）", () => {
  const catalog = catalogWith({
    makers: [
      { id: "maker_000002", name: "アイデアポケット" },
      { id: "maker_000003", name: "別のメーカー" },
    ],
    entity_aliases: [
      aliasRow("ea_000004", "maker", "maker_000002", "Idea Pocket", "en", "en"),
      aliasRow("ea_000005", "maker", "maker_000003", "Idea Pocket", "en", "en"),
    ],
  });
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-09-01T06:00:00Z" },
    works: [{ source_record_id: "w-3", code: "TST-101", title: "T", maker: { name: "Idea Pocket" } }],
  }, { catalog, batchId: "p3-ambiguous", now: "2026-09-01T06:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 1);
  assert.equal(stage.issues[0].type, "ambiguous-taxonomy");
  assert.equal(stage.append.makers.length, 0, "歧义情况下不得新建实体");
});

test("未登记别名时行为保持不变，仍新建实体（V0.8 Phase 3 回归保护）", () => {
  const catalog = catalogWith({
    makers: [{ id: "maker_000002", name: "アイデアポケット" }],
    entity_aliases: [],
  });
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-09-01T06:00:00Z" },
    works: [{ source_record_id: "w-4", code: "TST-102", title: "T", maker: { name: "Idea Pocket" } }],
  }, { catalog, batchId: "p3-nomatch", now: "2026-09-01T06:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.makers.length, 1, "未登记别名时应按既有行为新建");
  assert.equal(stage.append.makers[0].name, "Idea Pocket");
});

test("新建分类时 slug 有确定性兜底，来源未给 slug 也能通过校验", () => {
  // 回归保护：slug 是必填字段，但多数来源只给名称。prepare 阶段不跑校验，
  // 该缺口只会在 import:apply 暴露，因此必须用测试锁住。
  const catalog = loadEmptyCatalog();
  const stage = prepareImport({
    schema_version: 1,
    source: { name: "javinfo-fanza", fetched_at: "2026-09-01T06:00:00Z" },
    works: [{ source_record_id: "w-5", code: "TST-200", title: "T", genres: [{ name: "Slender" }, { name: "スレンダー" }] }],
  }, { catalog, batchId: "p3-slug", now: "2026-09-04T00:00:00Z", fingerprint: "test" });

  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.genres.length, 2);
  assert.equal(stage.append.genres[0].slug, "slender", "英文名应转写为 slug");
  assert.ok(stage.append.genres[1].slug, "日文名无法转写为 ASCII 时必须回落到非空 slug");
  assert.match(stage.append.genres[1].slug, /^genre-\d{6}$/);
});
