import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openLibrary, addRoot, scanRoot, resolveMedia, byteRange, within, previewRename, applyRename } from '../scripts/media/library.mjs';

test('媒体扫描幂等、保留离线记录且不修改文件', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'averia-media-'));
  const db = openLibrary();
  try {
    await fs.writeFile(path.join(directory, 'sample.mp4'), 'fixture');
    const root = await addRoot(db, directory);
    await scanRoot(db, root.id);
    const initial = db.prepare('SELECT * FROM media_files').get();
    await scanRoot(db, root.id);
    assert.equal(db.prepare('SELECT count(*) AS n FROM media_files').get().n, 1);
    assert.equal(db.prepare('SELECT id FROM media_files').get().id, initial.id);
    assert.equal(await fs.readFile((await resolveMedia(db, initial.id)).full, 'utf8'), 'fixture');
    await fs.unlink(path.join(directory, 'sample.mp4'));
    await scanRoot(db, root.id);
    assert.equal(db.prepare('SELECT available FROM media_files').get().available, 0);
  } finally { db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('播放范围和路径边界', () => {
  assert.deepEqual(byteRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=8-', 10), { start: 8, end: 9 });
  for (const value of ['bytes=10-', 'bytes=-0', 'bytes=4-2', 'bytes=0-1,3-4']) assert.throws(() => byteRange(value, 10));
  assert.equal(within(path.resolve('media'), path.resolve('media-other', 'a.mp4')), false);
  assert.equal(within(path.resolve('media'), path.resolve('media', '..', 'a.mp4')), false);
});

test('改名预览零写入、拒绝覆盖和过期状态，成功保留文件 ID', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'averia-rename-'));
  const db = openLibrary();
  try {
    await fs.writeFile(path.join(directory, 'old.mp4'), 'fixture');
    const root = await addRoot(db, directory); await scanRoot(db, root.id);
    const file = db.prepare('SELECT * FROM media_files').get();
    const plan = await previewRename(db, file.id, 'new.mp4');
    assert.equal(await fs.readFile(path.join(directory, 'old.mp4'), 'utf8'), 'fixture');
    await fs.writeFile(path.join(directory, 'new.mp4'), 'protected');
    await assert.rejects(applyRename(db, plan));
    assert.equal(await fs.readFile(path.join(directory, 'new.mp4'), 'utf8'), 'protected');
    await fs.unlink(path.join(directory, 'new.mp4'));
    await fs.appendFile(path.join(directory, 'old.mp4'), 'changed');
    await assert.rejects(applyRename(db, plan), /文件已变化/);
    const fresh = await previewRename(db, file.id, 'new.mp4'); await applyRename(db, fresh);
    assert.equal(db.prepare('SELECT id FROM media_files').get().id, file.id);
    assert.equal(await fs.readFile((await resolveMedia(db, file.id)).full, 'utf8'), 'fixturechanged');
    await assert.rejects(previewRename(db, file.id, '../escape.mp4'));
  } finally { db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
