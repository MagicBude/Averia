import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCatalogCode } from '../lib/catalog.mjs';

const execFileAsync = promisify(execFile);

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
      available INTEGER NOT NULL DEFAULT 1, work_id TEXT, match_method TEXT,
      UNIQUE(root_id, relative_path));
    CREATE TABLE IF NOT EXISTS playback_state(
      media_file_id TEXT PRIMARY KEY REFERENCES media_files(id) ON DELETE CASCADE,
      position_seconds REAL NOT NULL DEFAULT 0, duration_seconds REAL,
      completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);`);
  const mediaColumns = new Set(db.prepare('PRAGMA table_info(media_files)').all().map((column) => column.name));
  if (!mediaColumns.has('match_method')) db.exec('ALTER TABLE media_files ADD COLUMN match_method TEXT');
  return db;
}

export function buildWorkCodeIndex(catalog) {
  const idsByCode = new Map();
  const add = (code, workId) => {
    const normalized = normalizeCatalogCode(code ?? '');
    if (!normalized) return;
    const ids = idsByCode.get(normalized) ?? new Set(); ids.add(workId); idsByCode.set(normalized, ids);
  };
  for (const work of catalog.works.records) add(work.primary_code, work.id);
  for (const code of catalog.work_codes.records) add(code.code || code.normalized_code, code.work_id);
  return new Map([...idsByCode].filter(([, ids]) => ids.size === 1).map(([code, ids]) => [code, [...ids][0]]));
}

export function matchWorkFromFilename(filename, codeIndex) {
  const stem = path.basename(filename, path.extname(filename));
  const candidates = stem.match(/[A-Za-z]{2,12}[\s._-]*\d{2,7}|\d{4,8}[._-]\d{1,4}/gu) ?? [];
  const matches = new Set(candidates.map(normalizeCatalogCode).map((code) => codeIndex.get(code)).filter(Boolean));
  return matches.size === 1 ? [...matches][0] : null;
}

export async function pickDirectory({ platform = process.platform, scriptPath, run = execFileAsync } = {}) {
  if (platform !== 'win32') throw new Error('当前原生目录选择器仅支持 Windows');
  if (!path.isAbsolute(scriptPath ?? '')) throw new Error('目录选择器脚本路径无效');
  try {
    const { stdout } = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024,
    });
    const selected = stdout.trim();
    return selected || null;
  } catch (error) {
    throw new Error('无法打开 Windows 目录选择器，请确认 Windows PowerShell 可用。', { cause: error });
  }
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
export async function scanRoot(db, id, { codeIndex = new Map() } = {}) {
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
    const autoLink = db.prepare(`UPDATE media_files SET work_id=?, match_method='exact_filename_code'
      WHERE root_id=? AND relative_path=? AND (work_id IS NULL OR match_method='exact_filename_code')`);
    const clearAutoLink = db.prepare(`UPDATE media_files SET work_id=NULL, match_method=NULL
      WHERE root_id=? AND relative_path=? AND match_method='exact_filename_code'`);
    for (const file of files) {
      const workId = matchWorkFromFilename(file.relative, codeIndex);
      if (workId) autoLink.run(workId, id, file.relative);
      else clearAutoLink.run(id, file.relative);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { scanned: files.length };
}

export function savePlayback(db, id, position, duration) {
  const file = db.prepare('SELECT id FROM media_files WHERE id=?').get(id);
  if (!file) throw new Error('媒体不存在');
  if (!Number.isFinite(position) || position < 0 || !Number.isFinite(duration) || duration <= 0 || position > duration + 2) throw new Error('播放进度无效');
  const completed = position / duration >= 0.9 ? 1 : 0;
  const savedPosition = completed ? 0 : position;
  db.prepare(`INSERT INTO playback_state(media_file_id,position_seconds,duration_seconds,completed,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(media_file_id) DO UPDATE SET position_seconds=excluded.position_seconds,duration_seconds=excluded.duration_seconds,completed=excluded.completed,updated_at=excluded.updated_at`)
    .run(id, savedPosition, duration, completed, new Date().toISOString());
  return { positionSeconds: savedPosition, durationSeconds: duration, completed: Boolean(completed) };
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
