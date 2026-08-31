import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCatalog, normalizeCatalogCode } from "./lib/catalog.mjs";
import { normalizeName } from "./import/lib.mjs";

const failOnError = process.argv.includes("--fail-on-error");
const catalog = loadCatalog();
const issues = [];
const add = (severity, type, message) => issues.push({ severity, type, message });

const codeOwners = new Map();
for (const row of catalog.works.records) {
  const key = normalizeCatalogCode(row.primary_code);
  if (!key) continue;
  if (!codeOwners.has(key)) codeOwners.set(key, new Set());
  codeOwners.get(key).add(row.id);
}
for (const row of catalog.work_codes.records) {
  const key = normalizeCatalogCode(row.normalized_code || row.code);
  if (!key) continue;
  if (!codeOwners.has(key)) codeOwners.set(key, new Set());
  codeOwners.get(key).add(row.work_id);
}
for (const [code, owners] of codeOwners) {
  if (owners.size > 1) add("error", "duplicate-work-code", `标准化番号 ${code} 同时属于多个作品：${[...owners].join(", ")}`);
}

const nameOwners = new Map();
const addName = (value, id, origin) => {
  const key = normalizeName(value);
  if (!key) return;
  if (!nameOwners.has(key)) nameOwners.set(key, []);
  nameOwners.get(key).push({ id, value, origin });
};
for (const row of catalog.actresses.records) {
  for (const field of ["primary_name","name_ja","name_en","kana"]) addName(row[field], row.id, field);
}
for (const row of catalog.actress_aliases.records) addName(row.alias, row.actress_id, "alias");
for (const [key, entries] of nameOwners) {
  const owners = [...new Set(entries.map((entry) => entry.id))];
  if (owners.length > 1) add("error", "actress-name-collision", `女优姓名/别名键“${key}”同时指向多个实体：${owners.join(", ")}`);
}

const workPrimaryCodeKeys = new Set(catalog.work_codes.records.filter((row) => row.is_primary === "true").map((row) => `${row.work_id}\u0000${normalizeCatalogCode(row.code)}`));
for (const row of catalog.works.records) {
  const key = `${row.id}\u0000${normalizeCatalogCode(row.primary_code)}`;
  if (!workPrimaryCodeKeys.has(key)) add("warning", "missing-primary-work-code", `${row.id} 的 primary_code=${row.primary_code} 没有对应 is_primary=true 的 work_codes 记录。`);
}

const entityIds = new Map([
  ["actress", new Set(catalog.actresses.records.map((r) => r.id))],
  ["work", new Set(catalog.works.records.map((r) => r.id))],
  ["maker", new Set(catalog.makers.records.map((r) => r.id))],
  ["label", new Set(catalog.labels.records.map((r) => r.id))],
  ["series", new Set(catalog.series.records.map((r) => r.id))],
  ["genre", new Set(catalog.genres.records.map((r) => r.id))],
  ["director", new Set(catalog.directors.records.map((r) => r.id))],
]);
for (const row of catalog.source_records.records) {
  if (!entityIds.get(row.entity_type)?.has(row.entity_id)) add("error", "orphan-source-record", `${row.id} 指向不存在的 ${row.entity_type}:${row.entity_id}`);
}

const counts = { error: issues.filter((x) => x.severity === "error").length, warning: issues.filter((x) => x.severity === "warning").length };
const lines = ["# Averia 数据质量报告", "", `- 错误：${counts.error}`, `- 警告：${counts.warning}`, "", "## 问题", ""];
if (!issues.length) lines.push("当前没有发现数据质量问题。", "");
for (const issue of issues) lines.push(`- **${issue.severity} / ${issue.type}**：${issue.message}`);
const reportDir = path.join(ROOT, "var", "reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "data-quality.md");
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`数据质量检查完成：${counts.error} 个错误，${counts.warning} 个警告。`);
console.log(`报告：${path.relative(ROOT, reportPath)}`);
if (failOnError && counts.error) process.exitCode = 1;
