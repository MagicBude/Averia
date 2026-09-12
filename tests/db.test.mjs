import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncDatabase } from "../scripts/db-sync.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import {
  openDatabase,
  searchWorks,
  searchActresses,
  getWork,
  getActress,
  getStats,
  DB_PATH,
  databaseExists,
} from "../scripts/lib/db.mjs";

// 保证派生库存在且为最新，避免后续断言依赖外部先手跑过 db:sync
test.before(() => {
  if (!databaseExists()) syncDatabase();
});

test("db:sync 全量重建产出 16+ 表且行数与 CSV 一致", () => {
  const r = syncDatabase();
  assert.ok(r.tables >= 16, `表数应 >=16，实得 ${r.tables}`);
  assert.ok(r.totalRows > 1000, `总行数应 >1000，实得 ${r.totalRows}`);
  assert.ok(r.worksFts > 0 && r.actressesFts > 0, "FTS 索引应非空");
  assert.ok(fs.existsSync(DB_PATH), "派生库文件应存在");
});

test("SQLite 派生库启用外键并拒绝悬空关系", () => {
  const db = openDatabase({ readonly: false });
  try {
    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    db.exec("BEGIN");
    assert.throws(
      () => db.prepare("INSERT INTO work_cast (work_id, actress_id, role, position) VALUES (?, ?, ?, ?)").run("work_999999", "actress_999999", null, 1),
      /FOREIGN KEY constraint failed/u,
    );
    db.exec("ROLLBACK");
  } finally { db.close(); }
});

test("SQLite 事务失败可完整回滚", () => {
  const db = openDatabase({ readonly: false });
  const before = db.prepare("SELECT COUNT(*) AS count FROM makers").get().count;
  try {
    db.exec("BEGIN");
    db.prepare("INSERT INTO makers (id, name) VALUES (?, ?)").run("maker_999998", "回滚测试");
    db.exec("ROLLBACK");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM makers").get().count, before);
    assert.equal(db.prepare("SELECT id FROM makers WHERE id = ?").get("maker_999998"), undefined);
  } finally { db.close(); }
});

test("CSV 导入 SQLite 后所有规范列逐字段无损", () => {
  syncDatabase();
  const catalog = loadCatalog();
  const db = openDatabase();
  try {
    for (const [name, dataset] of Object.entries(catalog)) {
      const order = dataset.schema.primaryKey?.length ? ` ORDER BY ${dataset.schema.primaryKey.map((column) => `"${column}"`).join(", ")}` : "";
      const rows = db.prepare(`SELECT * FROM "${name}"${order}`).all();
      const expected = [...dataset.records].sort((left, right) => (dataset.schema.primaryKey ?? []).map((key) => left[key].localeCompare(right[key])).find((value) => value !== 0) ?? 0);
      assert.equal(rows.length, expected.length, `${name} 行数必须一致`);
      const integers = new Set(dataset.schema.integerFields ?? []); const booleans = new Set(dataset.schema.booleanFields ?? []);
      for (const [index, source] of expected.entries()) for (const column of dataset.schema.columns) {
        const value = source[column] === "" ? null : booleans.has(column) ? (source[column] === "true" ? 1 : 0) : integers.has(column) ? Number.parseInt(source[column], 10) : column === "score" ? Number.parseFloat(source[column]) : source[column];
        assert.equal(rows[index][column], value, `${name}[${index}].${column} 不得丢失或改变`);
      }
    }
  } finally { db.close(); }
});

test("作品搜索：番号走 FTS5（SSIS）", () => {
  const db = openDatabase();
  try {
    const res = searchWorks(db, "SSIS");
    assert.equal(res.strategy, "fts5");
    assert.ok(res.total >= 1, "SSIS 至少命中 1 条");
    assert.ok(res.items.length > 0);
  } finally {
    db.close();
  }
});

test("作品搜索：日文子串走 trigram（メイド）", () => {
  const db = openDatabase();
  try {
    const res = searchWorks(db, "メイド");
    assert.equal(res.strategy, "fts5");
    assert.ok(res.total >= 1, "含 メイド 的作品至少 1 条");
  } finally {
    db.close();
  }
});

test("短查询（<3 字符）回退 LIKE", () => {
  const db = openDatabase();
  try {
    const res = searchWorks(db, "SS");
    assert.equal(res.strategy, "like");
    assert.ok(res.total >= 1);
  } finally {
    db.close();
  }
});

test("女优搜索：主名 / 别名 / 日文名可达（MASHIRO）", () => {
  const db = openDatabase();
  try {
    const res = searchActresses(db, "MASHIRO");
    assert.ok(res.total >= 1, "应能通过英文别名搜到女优");
  } finally {
    db.close();
  }
});

test("作品详情聚合 cast / genres / directors / taxonomy", () => {
  const db = openDatabase();
  try {
    const w = getWork(db, "work_000001");
    assert.ok(w, "work_000001 应存在");
    assert.ok(Array.isArray(w.cast));
    assert.ok(Array.isArray(w.genres));
    assert.ok(Array.isArray(w.directors));
    assert.equal(typeof w.maker_name, "string");
    assert.ok(Array.isArray(w.codes));
  } finally {
    db.close();
  }
});

test("女优详情聚合 aliases / works", () => {
  const db = openDatabase();
  try {
    const a = getActress(db, "actress_000001");
    assert.ok(a, "actress_000001 应存在");
    assert.ok(Array.isArray(a.aliases));
    assert.ok(Array.isArray(a.works));
  } finally {
    db.close();
  }
});

test("getStats 返回行数统计与同步时间", () => {
  const db = openDatabase();
  try {
    const s = getStats(db);
    assert.ok(s.counts.works > 0);
    assert.ok(s.counts.actresses > 0);
    assert.ok(s.syncedAt, "应记录同步时间");
  } finally {
    db.close();
  }
});
