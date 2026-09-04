// scripts/resolve-link.mjs
// V0.8 Phase 3：显式跨源 / 跨语言别名登记。
//
// 用途：当来源给出的名称与既有实体其实是同一实体、但字符串不相等时
// （アイデアポケット ↔ Idea Pocket、桃乃木かな ↔ Kana Momonogi、スレンダー ↔ 苗条），
// 用本命令“拒绝新建、改挂别名”，把该名称登记为既有实体的精确别名。
//
// 设计约束（AGENTS §数据采集边界 + 设计文档 3.3 硬规则）：
//   - 只登记精确别名，不做任何模糊 / 相似度匹配；
//   - 任何会造成 matcher 歧义的登记一律阻断，不静默覆盖；
//   - 写入前备份 data/，写入后跑全量校验，失败自动回滚。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCatalog } from "./lib/catalog.mjs";
import { writeCsv } from "./lib/csv.mjs";
import { aliasKeys, nextIdFactory, parseArgs } from "./import/lib.mjs";

const ENTITY_DATASET = {
  actress: "actresses",
  work: "works",
  maker: "makers",
  label: "labels",
  series: "series",
  genre: "genres",
  director: "directors",
};

const DEFAULT_LANGUAGE = {
  en: "en",
  ja: "ja",
  cn: "zh",
  kana: "ja",
  romanized: "",
  external_id: "",
  alternate: "",
};

const USAGE = `用法：pnpm resolve:link -- --alias <名称> --entity <实体ID> --type <别名类型> [选项]

必填：
  --alias <名称>       要登记为别名的字符串（如 "Idea Pocket"、"苗条"）
  --entity <实体ID>    目标实体 ID（如 maker_000002、actress_000002）
  --type <别名类型>    romanized | en | ja | cn | kana | external_id | alternate

选项：
  --language <语言>        语言标记，默认按 --type 推断（cn→zh、ja→ja、en→en）
  --source-name <来源>     该别名的来源名称
  --source-record-id <ID>  来源记录 ID
  --notes <备注>
  --dry-run               只预览，不写入
  --help                  显示本说明`;

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const text = (key) => (typeof args[key] === "string" ? args[key].trim() : "");
const alias = text("alias");
const entityId = text("entity");
const aliasType = text("type");

if (!alias || !entityId || !aliasType) {
  console.error(USAGE);
  process.exit(1);
}
if (!(aliasType in DEFAULT_LANGUAGE)) {
  console.error(`未知的别名类型：${aliasType}\n可选：${Object.keys(DEFAULT_LANGUAGE).join(" | ")}`);
  process.exit(1);
}

const catalog = loadCatalog();
const dataset = catalog.entity_aliases;

// 目标实体必须真实存在；entity_type 由数据推断，不接受手工输入，避免写错类型。
let entityType = "";
for (const [type, name] of Object.entries(ENTITY_DATASET)) {
  if (catalog[name].records.some((row) => row.id === entityId)) {
    entityType = type;
    break;
  }
}
if (!entityType) {
  console.error(`找不到实体：${entityId}`);
  console.error("可登记的实体类型：" + Object.keys(ENTITY_DATASET).join("、"));
  process.exit(1);
}

const keys = aliasKeys(entityType, alias);
if (!keys.length) {
  console.error("--alias 不能为空。");
  process.exit(1);
}
const overlaps = (value) => aliasKeys(entityType, value).some((key) => keys.includes(key));

// 守卫 1：同一别名已指向别的实体 → 会让 matcher 命中多个 ID，阻断。
const conflicts = new Set();
for (const row of dataset.records) {
  if (row.entity_id === entityId) continue;
  if (overlaps(row.alias)) conflicts.add(row.entity_id);
}
if (conflicts.size) {
  console.error(`别名“${alias}”已指向其它实体：${[...conflicts].join("、")}。`);
  console.error("这会让 matcher 命中多个 ID。按设计文档 3.3 硬规则只接受精确唯一命中，故阻断。");
  console.error("请先人工裁决其中一个登记的归属，再重新执行。");
  process.exit(2);
}

// 守卫 2：别名与另一个同类型实体的正式名完全相同 → 那不是加别名，是合并实体，需人工确认。
const nameFieldsOf = (row) => {
  if (entityType === "actress") return [row.primary_name, row.name_ja, row.name_en, row.kana];
  if (entityType === "work") return [row.title, row.title_ja, row.primary_code];
  return [row.name, row.name_ja, row.name_en];
};
const nameConflict = catalog[ENTITY_DATASET[entityType]].records.find((row) => {
  if (row.id === entityId) return false;
  return nameFieldsOf(row).some(overlaps);
});
if (nameConflict) {
  console.error(`已存在同名的独立实体：${nameConflict.id}（${nameConflict.name ?? nameConflict.primary_name ?? nameConflict.title ?? ""}）。`);
  console.error("把该名称挂为别名等同于合并两个实体，属于人工决策，本命令拒绝自动执行。");
  process.exit(3);
}

// 守卫 3：完全重复的登记 → 幂等，不重复写。
const duplicate = dataset.records.find((row) => row.entity_id === entityId && overlaps(row.alias));
if (duplicate) {
  console.log(`别名已登记，无需重复写入：${duplicate.id} → ${entityId}（${duplicate.alias}）。`);
  process.exit(0);
}

const nextId = nextIdFactory(catalog);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const row = Object.fromEntries(dataset.schema.columns.map((column) => [column, ""]));
Object.assign(row, {
  id: nextId("ea"),
  entity_type: entityType,
  entity_id: entityId,
  alias,
  alias_type: aliasType,
  language: text("language") || DEFAULT_LANGUAGE[aliasType],
  source_name: text("source-name"),
  source_record_id: text("source-record-id"),
  notes: text("notes"),
  created_at: now,
});

console.log(`将登记别名：${row.id}  ${entityType}/${entityId}  “${alias}”  (${aliasType})`);
if (args["dry-run"]) {
  console.log("--dry-run：未写入。");
  process.exit(0);
}

const stamp = now.replace(/[:.]/g, "-").replace("Z", "");
const backupDir = path.join(ROOT, "var", "backups", `resolve-link-${stamp}`);
fs.mkdirSync(path.dirname(backupDir), { recursive: true });
fs.cpSync(path.join(ROOT, "data"), backupDir, { recursive: true });

try {
  writeCsv(dataset.filePath, dataset.schema.columns, [...dataset.records, row]);
  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-data.mjs")], { cwd: ROOT, encoding: "utf8" });
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr);
  if (check.status !== 0) throw new Error("写入后的数据校验失败。");
  console.log(`已写入 ${row.id}。备份目录：${path.relative(ROOT, backupDir)}`);
  console.log("建议继续执行：pnpm data:export");
} catch (error) {
  fs.rmSync(path.join(ROOT, "data"), { recursive: true, force: true });
  fs.cpSync(backupDir, path.join(ROOT, "data"), { recursive: true });
  console.error(`写入失败，已自动恢复备份：${error.message}`);
  process.exit(1);
}
