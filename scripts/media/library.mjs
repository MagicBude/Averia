import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const extensions = new Set(['.mp4', '.m4v', '.webm', '.mkv', '.avi', '.mov', '.ts']);
export function within(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

/** 媒体路径属于本机运行状态，独立于可公开发布的作品元数据。 */
export function openLibrary(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS media_roots(id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS media_files(
      id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES media_roots(id),
      relative_path TEXT NOT NULL, size INTEGER NOT NULL, modified REAL NOT NULL,
      available INTEGER NOT NULL DEFAULT 1, work_id TEXT,
      UNIQUE(root_id, relative_path));`);
  return db;
}

export async function addRoot(db, directory) {
  if (!path.isAbsolute(directory)) throw new Error('请选择绝对目录路径');
  const resolved = await fs.realpath(directory);
  if (!(await fs.stat(resolved)).isDirectory() || path.parse(resolved).root === resolved) throw new Error('不能将磁盘根目录作为媒体库');
  const existing = db.prepare('SELECT * FROM media_roots WHERE path=?').get(resolved);
  if (existing) return existing;
  const id = randomUUID();
  db.prepare('INSERT INTO media_roots VALUES (?,?)').run(id, resolved);
  return { id, path: resolved };
}

/** 完整遍历成功才更新可用状态；离线磁盘或权限失败不会误删资料。 */
export async function scanRoot(db, id) {
  const root = db.prepare('SELECT * FROM media_roots WHERE id=?').get(id);
  if (!root) throw new Error('媒体目录不存在');
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (!within(root.path, await fs.realpath(full))) throw new Error('目录越界');
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        const info = await fs.stat(full);
        files.push({ relative: path.relative(root.path, full), size: info.size, modified: info.mtimeMs });
      }
    }
  }
  await walk(root.path);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE media_files SET available=0 WHERE root_id=?').run(id);
    const insert = db.prepare(`INSERT INTO media_files(id,root_id,relative_path,size,modified) VALUES(?,?,?,?,?)
      ON CONFLICT(root_id,relative_path) DO UPDATE SET size=excluded.size,modified=excluded.modified,available=1`);
    for (const file of files) insert.run(randomUUID(), id, file.relative, file.size, file.modified);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { scanned: files.length };
}

export async function resolveMedia(db, id) {
  const file = db.prepare(`SELECT f.*, r.path AS root FROM media_files f JOIN media_roots r ON r.id=f.root_id WHERE f.id=?`).get(id);
  if (!file || !file.available) throw new Error('媒体不可用');
  const full = await fs.realpath(path.join(file.root, file.relative_path));
  if (!within(file.root, full)) throw new Error('媒体路径越界');
  return { ...file, full };
}

/** 改名只允许同目录新文件名，预览绑定文件状态，提交使用排他创建避免覆盖。 */
export async function previewRename(db, id, name) {
  const file = await resolveMedia(db, id);
  if (typeof name !== 'string' || !name || /[<>:"/\\|?*\x00-\x1f]/u.test(name) || /[. ]$/u.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) throw new Error('文件名不合法');
  if (path.extname(name).toLowerCase() !== path.extname(file.full).toLowerCase()) throw new Error('改名必须保留扩展名');
  const target = path.join(path.dirname(file.full), name);
  if (target === file.full) throw new Error('新旧文件名相同');
  try { await fs.lstat(target); throw new Error('目标文件已存在'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const info = await fs.stat(file.full);
  return { id, from: file.relative_path, to: path.relative(file.root, target), size: info.size, modified: info.mtimeMs };
}

export async function applyRename(db, plan) {
  const current = await previewRename(db, plan.id, path.basename(plan.to));
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('文件已变化，请重新预览');
  const file = await resolveMedia(db, plan.id);
  const target = path.join(file.root, plan.to);
  // link 在目标已存在时失败；不像 rename，它不会覆盖同名文件。
  await fs.link(file.full, target);
  try {
    await fs.unlink(file.full);
  } catch (error) { await fs.unlink(target); throw error; }
  try {
    db.prepare('UPDATE media_files SET relative_path=? WHERE id=?').run(plan.to, plan.id);
  } catch (error) {
    // 文件操作与 SQLite 不共享事务；保留明确恢复路径，不声称数据库事务能回滚文件系统。
    throw new Error(`文件已改名，但索引更新失败，请重新扫描目录：${error.message}`);
  }
  return { renamed: true };
}

/** 支持浏览器拖动进度；拒绝多区间和非法范围。 */
export function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) throw new Error('无效 Range');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) throw new Error('无效 Range');
  return { start, end };
}
