#!/usr/bin/env node
/**
 * Averia V0.9 — SQLite 派生层只读查询 CLI
 *
 * 用法：
 *   node scripts/db-query.mjs sync
 *   node scripts/db-query.mjs search-works "<词>" [--limit N]
 *   node scripts/db-query.mjs search-actresses "<词>" [--limit N]
 *   node scripts/db-query.mjs work <work_id>
 *   node scripts/db-query.mjs actress <actress_id>
 *   node scripts/db-query.mjs stats
 *
 * 查询路径全部只读，永不写库。V1.0 API 与 V1.1 Web 复用 lib/db.mjs 的同一批函数。
 */
import {
  openDatabase,
  databaseExists,
  searchWorks,
  searchActresses,
  getWork,
  getActress,
  getStats,
} from "./lib/db.mjs";
import { syncDatabase } from "./db-sync.mjs";

function parseLimit(args) {
  const i = args.indexOf("--limit");
  if (i >= 0 && args[i + 1]) {
    const n = Number.parseInt(args[i + 1], 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 20;
}

function usage() {
  console.error(`Averia V0.9 查询 CLI
用法：
  db-query sync
  db-query search-works "<关键词>" [--limit N]
  db-query search-actresses "<关键词>" [--limit N]
  db-query work <work_id>
  db-query actress <actress_id>
  db-query stats`);
}

function printWorkRow(w) {
  const title = w.title_ja || w.title || "(无标题)";
  console.log(
    `  ${String(w.primary_code).padEnd(14)} ${title.slice(0, 40).padEnd(42)} ${w.release_date || "?"}  ${
      w.score ? "★" + w.score : ""
    }`.trimEnd(),
  );
}

function printActressRow(a) {
  const name = a.primary_name || a.name_ja || a.name_en || "(无)";
  console.log(`  ${String(a.id).padEnd(16)} ${name.slice(0, 30).padEnd(32)} ${a.name_ja ? "｜" + a.name_ja.slice(0, 20) : ""}`.trimEnd());
}

function printWorkDetail(w) {
  console.log(`作品 ${w.id} (${w.primary_code})`);
  console.log(`  标题(日): ${w.title_ja || ""}`);
  console.log(`  标题(英): ${w.title || ""}`);
  console.log(`  发行日: ${w.release_date || "?"} ｜ 时长: ${w.duration_min || "?"} 分钟 ｜ 评分: ${w.score ?? "无"}`);
  console.log(`  厂商: ${w.maker_name || "?"} ｜ 厂牌: ${w.label_name || "?"} ｜ 系列: ${w.series_name || "?"}`);
  console.log(`  番号: ${w.codes.map((c) => c.code).join(", ") || "无"}`);
  console.log(`  参演 (${w.cast.length}): ${w.cast.map((c) => c.primary_name).join("、") || "无"}`);
  console.log(`  分类 (${w.genres.length}): ${w.genres.map((g) => g.name).join("、") || "无"}`);
  if (w.directors.length) console.log(`  导演: ${w.directors.map((d) => d.name).join("、")}`);
}

function printActressDetail(a) {
  console.log(`女优 ${a.id}`);
  console.log(`  主名: ${a.primary_name || "?"} ｜ 日文: ${a.name_ja || "-"} ｜ 英文: ${a.name_en || "-"}`);
  if (a.kana) console.log(`  Kana: ${a.kana}`);
  if (a.birth_date) console.log(`  生日: ${a.birth_date}`);
  if (a.height_cm) console.log(`  身高: ${a.height_cm}cm ｜ 罩杯: ${a.cup || "-"}`);
  if (a.aliases.length) console.log(`  别名 (${a.aliases.length}): ${a.aliases.map((x) => x.alias).join("、")}`);
  console.log(`  参演作品 (${a.works.length}):`);
  for (const w of a.works.slice(0, 10)) {
    console.log(`    ${String(w.primary_code).padEnd(14)} ${(w.title_ja || w.title || "").slice(0, 36).padEnd(38)} ${w.release_date || "?"}`);
  }
  if (a.works.length > 10) console.log(`    … 其余 ${a.works.length - 10} 部`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd) {
    usage();
    process.exit(1);
  }

  if (cmd === "sync") {
    const r = syncDatabase();
    console.log(`✓ SQLite 派生库已重建：${r.dbPath}`);
    console.log(`  表 ${r.tables} 个｜行 ${r.totalRows} 行｜索引 ${r.indexCount} 个`);
    console.log(`  全文索引：作品 ${r.worksFts} 条｜女优 ${r.actressesFts} 条`);
    return;
  }

  if (!databaseExists()) {
    console.error("✗ 派生库不存在。请先运行 `pnpm db:sync`（或 `db-query sync`）生成。");
    process.exit(1);
  }

  const db = openDatabase();
  try {
    switch (cmd) {
      case "search-works": {
        const q = args[1];
        if (!q) {
          console.error("✗ 缺少关键词");
          process.exit(1);
        }
        const res = searchWorks(db, q, { limit: parseLimit(args) });
        console.log(`作品搜索「${q}」 策略=${res.strategy} 命中=${res.total}`);
        if (!res.items.length) console.log("  （无结果）");
        else for (const w of res.items) printWorkRow(w);
        break;
      }
      case "search-actresses": {
        const q = args[1];
        if (!q) {
          console.error("✗ 缺少关键词");
          process.exit(1);
        }
        const res = searchActresses(db, q, { limit: parseLimit(args) });
        console.log(`女优搜索「${q}」 策略=${res.strategy} 命中=${res.total}`);
        if (!res.items.length) console.log("  （无结果）");
        else for (const a of res.items) printActressRow(a);
        break;
      }
      case "work": {
        const id = args[1];
        if (!id) {
          console.error("✗ 缺少 work_id");
          process.exit(1);
        }
        const w = getWork(db, id);
        if (!w) {
          console.error(`✗ 未找到作品：${id}`);
          process.exit(1);
        }
        printWorkDetail(w);
        break;
      }
      case "actress": {
        const id = args[1];
        if (!id) {
          console.error("✗ 缺少 actress_id");
          process.exit(1);
        }
        const a = getActress(db, id);
        if (!a) {
          console.error(`✗ 未找到女优：${id}`);
          process.exit(1);
        }
        printActressDetail(a);
        break;
      }
      case "stats": {
        const s = getStats(db);
        console.log(`数据集统计（同步于 ${s.syncedAt}）`);
        const entries = Object.entries(s.counts).sort((a, b) => b[1] - a[1]);
        for (const [name, n] of entries) console.log(`  ${name.padEnd(22)} ${String(n).padStart(6)}`);
        break;
      }
      default:
        usage();
        process.exit(1);
    }
  } finally {
    db.close();
  }
}

main();
