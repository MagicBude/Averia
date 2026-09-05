import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ROOT } from "./catalog.mjs";

/**
 * Averia V0.9 — SQLite 派生只读层的共享访问入口。
 *
 * 定位（见 ROADMAP V0.9 与 ADR-0001）：
 * SQLite 是规范 CSV 的物化 / 查询层，**不是事实源**。
 * 写入方向永远只有 CSV → SQLite（`pnpm db:sync`），禁止反向写回。
 * V1.0 API 与 V1.1 Web 都通过本模块只读消费。
 */

export const DB_PATH = path.join(ROOT, "data", "averia.db");

/** 打开派生库。默认只读，避免任何下游代码意外改写。 */
export function openDatabase({ readonly = true } = {}) {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `SQLite 派生库不存在：${path.relative(ROOT, DB_PATH)}\n` +
        `它是 CSV 的物化副本，请先运行 \`pnpm db:sync\` 生成。`,
    );
  }
  return new DatabaseSync(DB_PATH, { readOnly: readonly });
}

/** 派生库是否已生成。调用方用它决定要不要先 sync。 */
export function databaseExists() {
  return fs.existsSync(DB_PATH);
}

/**
 * 转义 FTS5 查询串。
 * 用双引号整体包成短语，内部双引号翻倍，避免用户输入里的引号破坏语法。
 */
export function escapeFtsQuery(query) {
  return `"${String(query).replace(/"/g, '""')}"`;
}

/** FTS5 trigram 分词器要求查询至少 3 个字符，短查询必须走 LIKE 兜底。 */
export const FTS_MIN_LENGTH = 3;

function clampLimit(limit, fallback = 20, max = 200) {
  const n = Number.parseInt(limit, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function clampOffset(offset) {
  const n = Number.parseInt(offset, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

/**
 * 作品搜索：优先走 FTS5（支持日文子串 / 番号），短查询回退 LIKE。
 *
 * 返回结构带 `work_id`，调用方再按需 join 取完整字段，
 * 避免搜索列表一次捞回 description 这类大字段。
 */
export function searchWorks(db, query, { limit = 20, offset = 0 } = {}) {
  const q = String(query ?? "").trim();
  if (!q) return { items: [], total: 0, strategy: "empty" };

  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const useFts = q.length >= FTS_MIN_LENGTH;

  let rows;
  let total;
  let strategy;

  if (useFts) {
    // trigram 下 MATCH 走全文索引；COUNT 单独查，避免为总数也捞回正文
    rows = db
      .prepare(
        `SELECT work_id FROM works_fts
         WHERE works_fts MATCH ?
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(escapeFtsQuery(q), lim, off);
    total = db
      .prepare(`SELECT COUNT(*) AS n FROM works_fts WHERE works_fts MATCH ?`)
      .get(escapeFtsQuery(q)).n;
    strategy = "fts5";
  } else {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT id AS work_id FROM works
         WHERE primary_code LIKE ? OR title LIKE ? OR title_ja LIKE ?
         ORDER BY release_date DESC, id
         LIMIT ? OFFSET ?`,
      )
      .all(like, like, like, lim, off);
    total = db
      .prepare(
        `SELECT COUNT(*) AS n FROM works
         WHERE primary_code LIKE ? OR title LIKE ? OR title_ja LIKE ?`,
      )
      .get(like, like, like).n;
    strategy = "like";
  }

  const ids = rows.map((r) => r.work_id);
  if (!ids.length) return { items: [], total, strategy };

  // 用占位符展开 IN，保持顺序与搜索结果一致
  const placeholders = ids.map(() => "?").join(", ");
  const byId = new Map(
    db
      .prepare(`SELECT * FROM works WHERE id IN (${placeholders})`)
      .all(...ids)
      .map((r) => [r.id, r]),
  );

  return {
    items: ids.map((id) => byId.get(id)).filter(Boolean),
    total,
    strategy,
  };
}

/** 女优搜索：主名 + 别名（actress_aliases 与 entity_aliases 都进索引）。 */
export function searchActresses(db, query, { limit = 20, offset = 0 } = {}) {
  const q = String(query ?? "").trim();
  if (!q) return { items: [], total: 0, strategy: "empty" };

  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const useFts = q.length >= FTS_MIN_LENGTH;

  let rows;
  let total;
  let strategy;

  if (useFts) {
    rows = db
      .prepare(
        `SELECT actress_id FROM actresses_fts
         WHERE actresses_fts MATCH ?
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(escapeFtsQuery(q), lim, off);
    total = db
      .prepare(`SELECT COUNT(*) AS n FROM actresses_fts WHERE actresses_fts MATCH ?`)
      .get(escapeFtsQuery(q)).n;
    strategy = "fts5";
  } else {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT id AS actress_id FROM actresses
         WHERE primary_name LIKE ? OR name_ja LIKE ? OR name_en LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
      )
      .all(like, like, like, lim, off);
    total = db
      .prepare(
        `SELECT COUNT(*) AS n FROM actresses
         WHERE primary_name LIKE ? OR name_ja LIKE ? OR name_en LIKE ?`,
      )
      .get(like, like, like).n;
    strategy = "like";
  }

  const ids = rows.map((r) => r.actress_id);
  if (!ids.length) return { items: [], total, strategy };

  const placeholders = ids.map(() => "?").join(", ");
  const byId = new Map(
    db
      .prepare(`SELECT * FROM actresses WHERE id IN (${placeholders})`)
      .all(...ids)
      .map((r) => [r.id, r]),
  );

  return {
    items: ids.map((id) => byId.get(id)).filter(Boolean),
    total,
    strategy,
  };
}

/** 作品详情：主记录 + 番号 + 参演女优 + 分类 + 导演 + 厂商/厂牌/系列名。 */
export function getWork(db, workId) {
  const work = db.prepare(`SELECT * FROM works WHERE id = ?`).get(workId);
  if (!work) return null;

  const codes = db.prepare(`SELECT * FROM work_codes WHERE work_id = ? ORDER BY is_primary DESC, code`).all(workId);

  const cast = db
    .prepare(
      `SELECT wc.*, a.primary_name, a.name_ja, a.name_en
       FROM work_cast wc
       JOIN actresses a ON a.id = wc.actress_id
       WHERE wc.work_id = ?
       ORDER BY wc.position, wc.actress_id`,
    )
    .all(workId);

  const genres = db
    .prepare(
      `SELECT g.id, g.name
       FROM work_genres wg JOIN genres g ON g.id = wg.genre_id
       WHERE wg.work_id = ?
       ORDER BY g.name`,
    )
    .all(workId);

  const directors = db
    .prepare(
      `SELECT d.id, d.name
       FROM work_directors wd JOIN directors d ON d.id = wd.director_id
       WHERE wd.work_id = ?
       ORDER BY d.name`,
    )
    .all(workId);

  const taxonomy = db
    .prepare(
      `SELECT
         (SELECT name FROM makers  WHERE id = works.maker_id)  AS maker_name,
         (SELECT name FROM labels  WHERE id = works.label_id)  AS label_name,
         (SELECT name FROM series  WHERE id = works.series_id) AS series_name
       FROM works WHERE id = ?`,
    )
    .get(workId);

  return { ...work, ...taxonomy, codes, cast, genres, directors };
}

/** 女优详情：主记录 + 别名 + 参演作品（按发行日期倒序）。 */
export function getActress(db, actressId) {
  const actress = db.prepare(`SELECT * FROM actresses WHERE id = ?`).get(actressId);
  if (!actress) return null;

  const aliases = db
    .prepare(`SELECT * FROM actress_aliases WHERE actress_id = ? ORDER BY is_primary DESC, alias`)
    .all(actressId);

  const works = db
    .prepare(
      `SELECT w.id, w.primary_code, w.title, w.title_ja, w.release_date, w.thumb_url, w.score, wc.position
       FROM work_cast wc JOIN works w ON w.id = wc.work_id
       WHERE wc.actress_id = ?
       ORDER BY w.release_date DESC, w.id`,
    )
    .all(actressId);

  return { ...actress, aliases, works };
}

/** 数据集统计，供首页与「数据集统计」页使用。 */
export function getStats(db) {
  const rows = db
    .prepare(`SELECT key, value FROM _meta WHERE key LIKE 'rows.%'`)
    .all();
  const counts = Object.fromEntries(rows.map((r) => [r.key.replace(/^rows\./, ""), Number(r.value)]));
  const syncedAt = db.prepare(`SELECT value FROM _meta WHERE key = 'synced_at'`).get()?.value ?? null;
  return { counts, syncedAt };
}
