// scripts/web-serve.mjs
//
// 零依赖静态文件服务器，仅用于本地预览 web/ 目录。
// 用法：node scripts/web-serve.mjs  （默认 4173，可用 PORT=8080 覆盖）
//
// 注意：web/ 下的页面也可直接双击 index.html 用 file:// 打开，
// 因为数据通过 <script src="data/data.js"> 挂载，不受 fetch 的 CORS 限制。

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "..", "web");
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(WEB_DIR, path.normalize(urlPath));
    if (!filePath.startsWith(WEB_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Averia web → http://localhost:${PORT}`));
