import path from "node:path";
import { loadCatalog, normalizeCatalogCode, ROOT } from "./lib/catalog.mjs";
import { isValidUtcTimestamp } from "./lib/time.mjs";

const catalog = loadCatalog();
const errors = [];
const warnings = [];

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function pushError(dataset, rowNumber, field, message, value = undefined) {
  const suffix = value === undefined ? "" : `（值：${JSON.stringify(value)}）`;
  errors.push(`${dataset}:${rowNumber}:${field}: ${message}${suffix}`);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

for (const [datasetName, dataset] of Object.entries(catalog)) {
  const { schema, headers, records, filePath } = dataset;

  if (JSON.stringify(headers) !== JSON.stringify(schema.columns)) {
    errors.push(
      `${datasetName}: CSV 表头与 Schema 不匹配： ${relative(filePath)}.\n` +
      `  预期：${schema.columns.join(",")}\n` +
      `  实际：${headers.join(",")}`,
    );
  }

  const seenPrimaryKeys = new Map();

  records.forEach((record, index) => {
    const rowNumber = index + 2;

    for (const field of schema.required ?? []) {
      if (!record[field]) {
        pushError(datasetName, rowNumber, field, "必填字段为空");
      }
    }

    for (const [field, patternText] of Object.entries(schema.idFields ?? {})) {
      const value = record[field];
      if (!value) continue;
      if (!new RegExp(patternText).test(value)) {
        pushError(datasetName, rowNumber, field, `不符合格式 ${patternText}`, value);
      }
    }

    for (const field of schema.booleanFields ?? []) {
      const value = record[field];
      if (value && value !== "true" && value !== "false") {
        pushError(datasetName, rowNumber, field, "必须为 true 或 false", value);
      }
    }

    for (const field of schema.integerFields ?? []) {
      const value = record[field];
      if (value && !/^-?\d+$/.test(value)) {
        pushError(datasetName, rowNumber, field, "必须为整数", value);
      }
    }

    for (const field of schema.dateFields ?? []) {
      const value = record[field];
      if (value && !validDate(value)) {
        pushError(datasetName, rowNumber, field, "必须是合法日期，格式为 YYYY-MM-DD", value);
      }
    }

    for (const field of schema.timestampFields ?? []) {
      const value = record[field];
      if (value && !isValidUtcTimestamp(value)) {
        pushError(datasetName, rowNumber, field, "必须使用 UTC ISO 8601 格式 YYYY-MM-DDTHH:mm:ssZ 或 YYYY-MM-DDTHH:mm:ss.SSSZ", value);
      }
    }

    for (const [field, allowed] of Object.entries(schema.enumFields ?? {})) {
      const value = record[field];
      if (value && !allowed.includes(value)) {
        pushError(datasetName, rowNumber, field, `必须是以下值之一：${allowed.join(", ")}`, value);
      }
    }

    const keyFields = schema.primaryKey ?? [];
    const keyValues = keyFields.map((field) => record[field]);
    if (keyFields.length > 0 && keyValues.every(Boolean)) {
      const primaryKey = keyValues.join("\u001f");
      const previous = seenPrimaryKeys.get(primaryKey);
      if (previous !== undefined) {
        pushError(datasetName, rowNumber, keyFields.join("+"), `主键重复；首次出现于第 ${previous} 行`);
      } else {
        seenPrimaryKeys.set(primaryKey, rowNumber);
      }
    }
  });
}

for (const [datasetName, dataset] of Object.entries(catalog)) {
  dataset.records.forEach((record, index) => {
    const rowNumber = index + 2;
    for (const fk of dataset.schema.foreignKeys ?? []) {
      const value = record[fk.field];
      if (!value && fk.optional) continue;
      if (!value) {
        pushError(datasetName, rowNumber, fk.field, "外键字段为空");
        continue;
      }

      const target = catalog[fk.dataset];
      if (!target) {
        pushError(datasetName, rowNumber, fk.field, `Schema 引用了未知数据集 ${fk.dataset}`);
        continue;
      }

      if (!target.records.some((candidate) => candidate[fk.target] === value)) {
        pushError(datasetName, rowNumber, fk.field, `引用不存在的 ${fk.dataset}.${fk.target}`, value);
      }
    }
  });
}

for (const [index, record] of catalog.work_codes.records.entries()) {
  const expected = normalizeCatalogCode(record.code);
  if (record.normalized_code && record.normalized_code !== expected) {
    pushError("work_codes", index + 2, "normalized_code", `预期为 ${expected}`, record.normalized_code);
  }
}

for (const [index, record] of catalog.works.records.entries()) {
  if (!record.primary_code) continue;
  const matching = catalog.work_codes.records.filter(
    (code) =>
      code.work_id === record.id &&
      code.is_primary === "true" &&
      normalizeCatalogCode(code.code) === normalizeCatalogCode(record.primary_code),
  );

  if (matching.length === 0) {
    warnings.push(
      `works:${index + 2}:primary_code: 未找到 is_primary=true 且与主番号匹配的 work_codes 记录，作品：${record.id}`,
    );
  }
}

if (warnings.length > 0) {
  console.warn(`Averia 数据校验警告 (${warnings.length}):`);
  for (const warning of warnings) console.warn(`  - ${warning}`);
}

if (errors.length > 0) {
  console.error(`Averia 数据校验失败，共 ${errors.length} 个错误：`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  const totalRows = Object.values(catalog).reduce((sum, dataset) => sum + dataset.records.length, 0);
  console.log(`Averia 数据校验通过：${Object.keys(catalog).length} 个数据集，${totalRows} 行数据。`);
}
