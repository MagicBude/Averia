#!/usr/bin/env node
/**
 * Averia V0.9 — SQLite 派生层同步（CSV → SQLite）
 *
 * 定位（见 ROADMAP V0.9 与 ADR-0001）：
 * SQLite 是规范 CSV 的物化 / 查询层，**不是事实源**。
 * 本脚本每次执行都是**全量重建**（drop & recreate），保证派生库与 CSV 严格一致，
 * 不存在增量漂移。写入方向永远只有 CSV → SQLite，禁止反向写回。
 *
 * 用法：
 *   pnpm db:sync              # 全量重建 data/averia.db
 *   pnpm db:sync -- --check   # 只体检不写库（对比行数与同步时间）
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ROOT, loadCatalog } from "./lib/catalog.mjs";
import { DB_PATH } from "./lib/db.mjs";

/** CSV 里存成文本、但语义是浮点数的列。schema 尚未声明 realFields，先在此显式登记。 */
const REAL_FIELDS = new Set(["score"]);

/** 派生库表名的引号包裹，防止与 SQLite 关键字冲突。 */
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/** 由 schema 推导列类型：整型 / 布尔 / 浮点 / 文本。 */
function columnType(column, schema) {
  if ((schema.integerFields ?? []).includes(column)) return "INTEGER";
  if ((schema.booleanFields ?? []).includes(column)) return "INTEGER";
  if (REAL_FIELDS.has(column)) return "REAL";
  return "TEXT";
}

/** 把 CSV 文本值转成对应 SQLite 类型；空串统一转 NULL，避免空字符串污染查询。 */
function coerceValue(value, type, isBoolean) {
  if (value === "" || value === null || value === undefined) return null;
  if (type === "INTEGER") {
    if (isBoolean) return value === "true" ? 1 : 0;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "REAL") {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  return value;
}

function createTable(db, name, schema) {
  const columns = schema.columns.map((c) => `${quoteIdent(c)} ${columnType(c, schema)}`);
  const pk = (schema.primaryKey ?? []).filter(Boolean);
  // 关系表（work_cast / work_genres / work_directors）是复合主键，单列主键则内联声明
  if (pk.length) columns.push(`PRIMARY KEY (${pk.map(quoteIdent).join(", ")})`);

  db.exec(`DROP TABLE IF EXISTS ${quoteIdent(name)}`);
  db.exec(`CREATE TABLE ${quoteIdent(name)} (\n  ${columns.join(",\n  ")}\n)`);
}

function insertRows(db, name, dataset, schema) {
  if (!dataset.records.length) return 0;
  const booleanFields = new Set(schema.booleanFields ?? []);
  const types = new Map(schema.columns.map((c) => [c, columnType(c, schema)]));
  const columns = schema.columns;
  const sql = `INSERT INTO ${quoteIdent(name)} (${columns.map(quoteIdent).join(", ")}) VALUES (${columns
    .map(() => "?")
    .join(", ")})`;
  const stmt = db.prepare(sql);

  for (const record of dataset.records) {
    stmt.run(...columns.map((c) => coerceValue(record[c], types.get(c), booleanFields.has(c))));
  }
  return dataset.records.length;
}

/**
 * 建索引。来源：idFields（含外键 id）+ foreignKeys + 常用检索列。
 * idFields 里的 id 列多半就是主键或已含在复合主键里，重复建会被 SQLite 忽略成本，
 * 因此只对「非主键首列」的列建索引。
 */
function createIndexes(db, name, schema) {
  const pk = new Set(schema.primaryKey ?? []);
  const candidates = new Set();

  for (const col of Object.keys(schema.idFields ?? {})) candidates.add(col);
  for (const fk of schema.foreignKeys ?? []) candidates.add(fk.field);
  for (const col of ["code", "normalized_code", "primary_code", "primary_name", "name", "name_ja", "name_en", "alias", "source_name", "entity_type", "status"]) {
    if (schema.columns.includes(col)) candidates.add(col);
  }

  let created = 0;
  for (const col of candidates) {
    if (!schema.columns.includes(col)) continue;
    if (pk.has(col) && pk.size === 1) continue; // 单列主键自带索引
    const idxName = `idx_${name}_${col}`;
    db.exec(`CREATE INDEX IF NOT EXISTS ${quoteIdent(idxName)} ON ${quoteIdent(name)} (${quoteIdent(col)})`);
    created += 1;
  }
  return created;
}

/**
 * 作品全文索引。
 * 用 trigram 分词器，因为它能正确切分日文（CJK）——FTS5 默认的 unicode61
 * 会把整段日文当成一个 token，导致子串搜索完全失效。
 * 检索文本 = 主番号 + 全部附加番号 + 标题 + 日文标题 + 简介，
 * 这样用别名番号也能搜到作品。
 */
function buildWorksFts(db, catalog) {
  db.exec(`DROP TABLE IF EXISTS works_fts`);
  db.exec(`CREATE VIRTUAL TABLE works_fts USING fts5(work_id UNINDEXED, search_text, tokenize='trigram')`);

  const codesByWork = new Map();
  for (const row of catalog.work_codes?.records ?? []) {
    const list = codesByWork.get(row.work_id) ?? [];
    if (row.code) list.push(row.code);
    if (row.normalized_code) list.push(row.normalized_code);
    codesByWork.set(row.work_id, list);
  }

  const stmt = db.prepare(`INSERT INTO works_fts (work_id, search_text) VALUES (?, ?)`);
  let n = 0;
  for (const work of catalog.works?.records ?? []) {
    const parts = [
      work.primary_code,
      work.title,
      work.title_ja,
      work.description,
      ...(codesByWork.get(work.id) ?? []),
    ].filter((v) => v && String(v).trim() !== "");
    stmt.run(work.id, parts.join(" "));
    n += 1;
  }
  return n;
}

/**
 * 女优全文索引：主名 + 日文名 + 英文名 + kana，
 * 外加 actress_aliases 与 entity_aliases 里指向她的全部别名，
 * 保证「用任意一种语言的曾用名都能搜到同一个人」。
 */
function buildActressesFts(db, catalog) {
  db.exec(`DROP TABLE IF EXISTS actresses_fts`);
  db.exec(`CREATE VIRTUAL TABLE actresses_fts USING fts5(actress_id UNINDEXED, search_text, tokenize='trigram')`);

  const aliasesByActress = new Map();
  const add = (actressId, value) => {
    if (!actressId || !value) return;
    const list = aliasesByActress.get(actressId) ?? [];
    list.push(String(value));
    aliasesByActress.set(actressId, list);
  };

  for (const row of catalog.actress_aliases?.records ?? []) add(row.actress_id, row.alias);
  for (const row of catalog.entity_aliases?.records ?? []) {
    if (row.entity_type === "actress") add(row.entity_id, row.alias);
  }

  const stmt = db.prepare(`INSERT INTO actresses_fts (actress_id, search_text) VALUES (?, ?)`);
  let n = 0;
  for (const actress of catalog.actresses?.records ?? []) {
    const parts = [
      actress.primary_name,
      actress.name_ja,
      actress.name_en,
      actress.kana,
      ...(aliasesByActress.get(actress.id) ?? []),
    ].filter((v) => v && String(v).trim() !== "");
    stmt.run(actress.id, parts.join(" "));
    n += 1;
  }
  return n;
}

function writeMeta(db, counts, indexCount) {
  db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.exec(`DELETE FROM _meta`);
  const put = db.prepare(`INSERT INTO _meta (key, value) VALUES (?, ?)`);

  put.run("synced_at", new Date().toISOString());
  put.run("sqlite_version", db.prepare(`SELECT sqlite_version() AS v`).get().v);
  put.run("schema_version", "1");
  put.run("dataset_count", String(Object.keys(counts).length));
  put.run("total_rows", String(Object.values(counts).reduce((a, b) => a + b, 0)));
  put.run("index_count", String(indexCount));
  put.run("fts_tokenizer", "trigram");
  for (const [name, n] of Object.entries(counts)) put.run(`rows.${name}`, String(n));
}

/** 全量重建派生库。返回统计信息，供 CLI 与测试断言使用。 */
export function syncDatabase({ dbPath = DB_PATH } = {}) {
  const catalog = loadCatalog();
  const names = Object.keys(catalog).sort();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // 全量重建：先删干净主库与 WAL/SHM 旁生产物，避免残留旧表
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }

  const db = new DatabaseSync(dbPath);
  const counts = {};
  let indexCount = 0;

  try {
    db.exec("BEGIN");
    for (const name of names) {
      const dataset = catalog[name];
      createTable(db, name, dataset.schema);
      counts[name] = insertRows(db, name, dataset, dataset.schema);
      indexCount += createIndexes(db, name, dataset.schema);
    }

    const worksFts = buildWorksFts(db, catalog);
    const actressesFts = buildActressesFts(db, catalog);

    writeMeta(db, counts, indexCount);
    db.exec("COMMIT");

    return {
      dbPath,
      tables: names.length,
      counts,
      totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
      indexCount,
      worksFts,
      actressesFts,
    };
  } catch (error) {
    // 回滚到干净状态，避免留下写了一半的派生库
    try {
      db.exec("ROLLBACK");
    } catch {
      /* 事务可能已终止，忽略 */
    }
    db.close();
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
    throw error;
  } finally {
    if (db.isOpen) db.close();
  }
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");

  if (checkOnly) {
    if (!fs.existsSync(DB_PATH)) {
      console.error(`派生库不存在：${path.relative(ROOT, DB_PATH)}`);
      console.error(`运行 \`pnpm db:sync\` 生成。`);
      process.exit(1);
    }
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const meta = Object.fromEntries(db.prepare(`SELECT key, value FROM _meta`).all().map((r) => [r.key, r.value]));
    db.close();

    const catalog = loadCatalog();
    const expected = Object.fromEntries(
      Object.keys(catalog)
        .sort()
        .map((n) => [n, catalog[n].records.length]),
    );

    console.log(`派生库：${path.relative(ROOT, DB_PATH)}`);
    console.log(`同步时间：${meta.synced_at}`);
    console.log(`SQLite 版本：${meta.sqlite_version}｜FTS 分词器：${meta.fts_tokenizer}`);
    console.log("");
    let drift = 0;
    for (const [name, n] of Object.entries(expected)) {
      const actual = Number(meta[`rows.${name}`] ?? -1);
      const ok = actual === n;
      if (!ok) drift += 1;
      console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(20)} CSV=${String(n).padStart(5)}  DB=${String(actual).padStart(5)}`);
    }
    console.log("");
    if (drift) {
      console.log(`✗ ${drift} 个数据集与 CSV 不一致，请运行 \`pnpm db:sync\` 重新同步。`);
      process.exit(1);
    }
    console.log(`✓ 派生库与 CSV 一致，共 ${meta.total_rows} 行。`);
    return;
  }

  const result = syncDatabase();
  console.log(`✓ SQLite 派生库已重建：${path.relative(ROOT, result.dbPath)}`);
  console.log(`  表 ${result.tables} 个｜行 ${result.totalRows} 行｜索引 ${result.indexCount} 个`);
  console.log(`  全文索引：作品 ${result.worksFts} 条｜女优 ${result.actressesFts} 条（trigram，支持日文子串）`);
  console.log("");
  for (const [name, n] of Object.entries(result.counts)) {
    if (n > 0) console.log(`    ${name.padEnd(20)} ${String(n).padStart(5)}`);
  }
}

// 仅在直接执行时跑 CLI，被 import（测试 / import:apply）调用时不触发。
// 用 fileURLToPath 统一成 OS 原生路径，避免 Windows 下正/反斜杠不一致导致判断失效。
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
