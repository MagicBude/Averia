// ============================================================
// enrich-actress-bio.mjs —— 手动录入演员生平（CSV 合规合并工具）
//
// 用途：把你整理好的演员生平（身高/三围/罩杯/血型/生日/出生地等）
//       按「演员名」精确匹配后，安全合并进 data/actresses/actresses.csv。
//
// 设计原则（遵循 AGENTS.md）：
//   1. actresses.csv 是唯一事实源，本脚本只改它，不碰任何自动生成产物。
//   2. 只做「空 <- 非空」补全；目标字段已有值则视为冲突，跳过并报告，绝不覆盖。
//   3. 匹配严格按 primary_name / name_ja / name_en 精确相等（已 trim），
//      不靠相似度、不自动合并实体。
//   4. 默认 dry-run（只报告，不写盘）；加 --apply 才真正落盘。
//
// 用法：
//   node scripts/enrich-actress-bio.mjs var/actress-bio-import.csv        # 预览
//   node scripts/enrich-actress-bio.mjs var/actress-bio-import.csv --apply # 落盘
//
// 落盘后流程（务必执行）：
//   pnpm data:validate && pnpm web:export
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./lib/csv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTRESSES_CSV = path.join(ROOT, "data/actresses/actresses.csv");

// 可被本次脚本补全的生平字段（与 actresses.schema.json 对应）
const BIO_FIELDS = [
  "birth_date",
  "debut_date",
  "retirement_date",
  "height_cm",
  "bust_cm",
  "waist_cm",
  "hip_cm",
  "cup",
  "blood_type",
  "birthplace",
];
// 仅用于匹配、绝不回写的键
const MATCH_KEYS = ["primary_name", "name_ja", "name_en"];

function keyOf(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

function buildIndex(records) {
  // 每个 key -> 命中的 actress 列表（同名列里出现多个不同实体时用于阻断）
  const idx = new Map();
  for (const a of records) {
    for (const k of MATCH_KEYS) {
      const v = keyOf(a[k]);
      if (!v) continue;
      if (!idx.has(v)) idx.set(v, []);
      const arr = idx.get(v);
      if (!arr.includes(a)) arr.push(a); // 同一演员的 primary_name/name_ja/name_en 相同不重复计
    }
  }
  return idx;
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const importPath = args.find((a) => !a.startsWith("--"));
  if (!importPath) {
    console.error("用法: node scripts/enrich-actress-bio.mjs <导入CSV> [--apply]");
    process.exit(1);
  }

  const { headers: aHeaders, records: actresses } = readCsv(ACTRESSES_CSV);
  const { headers: iHeaders, records: imports } = readCsv(importPath);

  const unknown = iHeaders.filter((h) => !BIO_FIELDS.includes(h) && !MATCH_KEYS.includes(h));
  if (unknown.length) {
    console.warn(`[提示] 导入表忽略未知列（不影响匹配/补全）: ${unknown.join(", ")}`);
  }

  const idx = buildIndex(actresses);
  const filled = []; // {name, field, value}
  const conflicts = []; // {name, field, existing, incoming}
  const unmatched = []; // 导入行找不到对应演员
  const noData = []; // 匹配到了但没有任何可补全字段

  for (const row of imports) {
    // 选一个匹配键
    const matchVal = MATCH_KEYS.map((k) => row[k]).find((v) => keyOf(v));
    if (!matchVal) {
      unmatched.push({ row, reason: "未提供任何匹配键" });
      continue;
    }
    const hits = idx.get(keyOf(matchVal)) || [];
    if (hits.length === 0) {
      unmatched.push({ row, reason: `无匹配演员: ${matchVal}` });
      continue;
    }
    if (hits.length > 1) {
      conflicts.push({ name: matchVal, field: "(匹配)", existing: `${hits.length} 个候选`, incoming: "阻断" });
      continue;
    }
    const a = hits[0];
    const label = a.primary_name || matchVal;
    let touched = false;
    for (const f of BIO_FIELDS) {
      const incoming = (row[f] ?? "").toString().trim();
      if (!incoming) continue;
      const existing = (a[f] ?? "").toString().trim();
      if (!existing) {
        a[f] = incoming;
        filled.push({ name: label, field: f, value: incoming });
        touched = true;
      } else if (existing !== incoming) {
        conflicts.push({ name: label, field: f, existing, incoming });
      }
    }
    if (!touched) noData.push(label);
  }

  // 报告
  console.log(`\n=== 演员生平合并预览 (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`扫描导入行: ${imports.length} | 现有演员: ${actresses.length}`);
  console.log(`将补全字段: ${filled.length}`);
  for (const f of filled) console.log(`  + ${f.name}  ${f.field} = ${f.value}`);
  if (conflicts.length) {
    console.log(`\n冲突(已跳过, 未覆盖): ${conflicts.length}`);
    for (const c of conflicts) console.log(`  ! ${c.name}  ${c.field}: 已有「${c.existing}」← 欲填「${c.incoming}」`);
  }
  if (noData.length) console.log(`\n匹配到但无新字段可补(全部已填/导入为空): ${noData.length} -> ${noData.join(", ")}`);
  if (unmatched.length) {
    console.log(`\n未匹配(跳过): ${unmatched.length}`);
    for (const u of unmatched) console.log(`  ? ${u.reason}`);
  }

  if (!apply) {
    console.log("\n[DRY-RUN] 未改动文件。确认无误后加 --apply 落盘，并运行:");
    console.log("  pnpm data:validate && pnpm web:export");
    return;
  }
  if (filled.length === 0) {
    console.log("\n[APPLY] 没有可补全字段，跳过写盘。");
    return;
  }
  writeCsv(ACTRESSES_CSV, aHeaders, actresses);
  console.log(`\n[APPLY] 已写入 ${filled.length} 个字段到 ${path.relative(ROOT, ACTRESSES_CSV)}`);
  // 强行同步 header 顺序（writeCsv 按原 headers 写回，安全）
  console.log("下一步: pnpm data:validate && pnpm web:export");
}

main();
