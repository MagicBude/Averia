import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { ROOT } from './lib/catalog.mjs';
import { openLibrary, addRoot, scanRoot, resolveMedia, byteRange, previewRename, applyRename } from './media/library.mjs';

fs.mkdirSync(path.join(ROOT, 'var', 'media'), { recursive: true });
const db = openLibrary(path.join(ROOT, 'var', 'media', 'library.db'));
const token = randomUUID();
const port = Number(process.env.PORT || 4180);
const origin = `http://127.0.0.1:${port}`;
const mime = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
const json = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
let scanning = false;
const plans = new Map();

http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) return json(res, { error: '仅允许本机地址' }, 403);
    const url = new URL(req.url, origin);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.method === 'POST') {
      if (req.headers.origin !== origin || req.headers['x-averia-token'] !== token) return json(res, { error: '请求验证失败' }, 403);
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 16384) throw new Error('请求过大'); }
      const input = JSON.parse(body || '{}');
      if (url.pathname === '/api/roots') return json(res, await addRoot(db, input.path));
      if (url.pathname === '/api/rename/preview') {
        const plan = await previewRename(db, input.id, input.name);
        const planId = randomUUID();
        if (plans.size >= 100) plans.clear();
        plans.set(planId, { plan, expires: Date.now() + 300000 });
        return json(res, { planId, ...plan });
      }
      if (url.pathname === '/api/rename/apply') {
        const saved = plans.get(input.planId);
        plans.delete(input.planId);
        if (!saved || saved.expires < Date.now()) throw new Error('预览已过期，请重新预览');
        if (scanning) throw new Error('请等待扫描完成后重新预览');
        return json(res, await applyRename(db, saved.plan));
      }
      if (url.pathname === '/api/scan') {
        if (scanning) return json(res, { error: '已有扫描正在运行' }, 409);
        scanning = true;
        try { return json(res, await scanRoot(db, input.id)); } finally { scanning = false; }
      }
      return json(res, { error: '操作不存在' }, 404);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, { error: '方法不支持' }, 405);
    if (url.pathname === '/api/library') return json(res, {
      token, roots: db.prepare('SELECT * FROM media_roots ORDER BY path').all(),
      files: db.prepare('SELECT * FROM media_files ORDER BY relative_path,id').all(),
    });
    if (url.pathname.startsWith('/stream/')) {
      const file = await resolveMedia(db, url.pathname.slice(8));
      const handle = await fsp.open(file.full, 'r');
      try {
        const info = await handle.stat();
        if (!info.isFile()) throw new Error('媒体不是文件');
        let range;
        try { range = byteRange(req.headers.range, info.size); } catch {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        const headers = { 'Content-Type': mime[path.extname(file.full).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': range ? range.end - range.start + 1 : info.size };
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
        res.writeHead(range ? 206 : 200, headers);
        if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
        await pipeline(handle.createReadStream({ ...range, autoClose: false }), res);
      } finally { await handle.close(); }
      return;
    }
    const assets = { '/': ['media.html', 'text/html'], '/media.js': ['media.js', 'text/javascript'], '/media.css': ['media.css', 'text/css'] };
    const asset = assets[url.pathname];
    if (!asset) return json(res, { error: '页面不存在' }, 404);
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(await fsp.readFile(path.join(ROOT, 'web', asset[0])));
  } catch (error) {
    if (!res.headersSent) json(res, { error: error.message }, 400); else res.destroy();
  }
}).listen(port, '127.0.0.1', () => console.log(`Averia 本地媒体库：${origin}`));
