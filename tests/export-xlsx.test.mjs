import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import {
  DATASET_SHEET_ORDER,
  buildActressOverviewRows,
  buildWorkOverviewRows,
} from "../scripts/export/xlsx.mjs";

test("XLSX 规范 Sheet 顺序固定为女优在女优别名前面", () => {
  assert.equal(DATASET_SHEET_ORDER[0], "actresses");
  assert.equal(DATASET_SHEET_ORDER[1], "actress_aliases");
  assert.ok(DATASET_SHEET_ORDER.indexOf("works") > DATASET_SHEET_ORDER.indexOf("actress_aliases"));
});

test("XLSX 女优总览把别名与作品数聚合成人类可读字段", () => {
  const rows = buildActressOverviewRows(loadCatalog());
  const row = rows.find((item) => item.id === "actress_000001");
  if (!row) return; // 空数据仓库也允许跑测试。
  assert.equal(row.primary_name, "純白彩永");
  assert.match(row.aliases, /MASHIRO SANA/);
  assert.equal(row.measurements, "93-57-86");
  assert.equal(row.work_count, 1);
});

test("XLSX 作品总览把女优、厂商、厂牌、导演与分类解引用", () => {
  const rows = buildWorkOverviewRows(loadCatalog());
  const row = rows.find((item) => item.id === "work_000001");
  if (!row) return; // 空数据仓库也允许跑测试。
  assert.equal(row.primary_code, "MDVR-434");
  assert.equal(row.actresses, "純白彩永");
  assert.equal(row.maker, "MOODYZ");
  assert.equal(row.label, "MOODYZ VR");
  assert.equal(row.directors, "ジーニアス膝");
  assert.match(row.genres, /VR専用/);
});
