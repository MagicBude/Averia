import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog, normalizeCatalogCode } from "../scripts/lib/catalog.mjs";

test("所有声明的数据集都能按精确表头加载", () => {
  const catalog = loadCatalog();
  assert.equal(Object.keys(catalog).length, 16);

  for (const dataset of Object.values(catalog)) {
    assert.deepEqual(dataset.headers, dataset.schema.columns);
  }
});

test("番号标准化结果保持确定性", () => {
  assert.equal(normalizeCatalogCode(" ssis-001 "), "SSIS001");
  assert.equal(normalizeCatalogCode("AB_CD.123"), "ABCD123");
});
