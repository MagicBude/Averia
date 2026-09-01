// scripts/provider-javlibrary.mjs
//
// Averia JavLibrary Provider CLI（V0.8 新增源）
// 镜像 scripts/provider-javdatabase.mjs 的行为与合规约束：
//   - 主机白名单 + HTTPS-only（在 lib 内强制）
//   - 不绕过 Cloudflare / 年龄门 / 验证码；被拦截时 fail closed
//   - 只生成 raw.html / canonical.json / meta.json，不修改正式 CSV
//   - 代理端口不写死；meta 只记录网络模式，不存代理 URL / 凭据
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import {
  buildJavlibraryUrl,
  fetchJavlibraryHtml,
  fetchJavlibraryWorkById,
  parseJavlibraryWork,
} from "./providers/javlibrary/lib.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia JavLibrary Provider V0.8\n\n用法：\n  pnpm provider:javlibrary -- --code IPZZ-597\n  pnpm provider:javlibrary -- --url https://www.javlibrary.com/ja/?v=javmezzbqu\n  pnpm provider:javlibrary -- --code IPZZ-597 --proxy http://127.0.0.1:7790\n  pnpm provider:javlibrary -- --file <本地HTML> --url <原始URL>\n\n网络代理优先级：\n  1. --proxy 显式代理\n  2. HTTP_PROXY / HTTPS_PROXY 环境变量\n  3. Windows 系统代理自动发现\n  4. 直连\n\n说明：\n  - 代理端口不会写死在代码中。\n  - meta.json 只记录网络模式和是否使用代理，不保存代理 URL/凭据。\n  - 默认只抓取一个页面，不会递归批量抓取。\n  - Provider 只生成 raw.html / canonical.json / meta.json，不修改正式 CSV。\n  - 使用 --file 时不发起网络请求，适合离线调试 Parser。\n  - Averia 不实现 Cloudflare / 年龄门 / 验证码绕过；JavLibrary 返回验证页时直接报错（fail closed）。`);
  process.exit(0);
}

try {
  if (!args.file) {
    const boot = bootstrapProxyIfNeeded({ explicitProxy: args.proxy ?? "" });
    if (boot.error) throw boot.error;
    if (boot.relaunched) process.exit(boot.status);
  }

  const network = args.file
    ? { mode: "offline-file", label: "离线文件", proxyUsed: false, displayProxy: "" }
    : describeNetworkMode(resolveProxyConfig({ explicitProxy: args.proxy ?? "" }));

  const fetchedAt = new Date().toISOString();
  let html;
  let finalUrl;
  let mode;

  if (args.file) {
    html = fs.readFileSync(path.resolve(args.file), "utf8");
    finalUrl = buildJavlibraryUrl({ url: args.url }) || args.url || "";
    mode = "file";
  } else if (args.code) {
    const fetched = await fetchJavlibraryWorkById(args.code, { timeoutMs: args.timeout ? Number(args.timeout) : undefined });
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    mode = "network";
  } else if (args.url) {
    const fetched = await fetchJavlibraryHtml(args.url, { timeoutMs: args.timeout ? Number(args.timeout) : undefined });
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    mode = "network";
  } else {
    throw new Error("请提供 --code、--url 或 --file。用 --help 查看用法。");
  }

  const parsed = parseJavlibraryWork(html, finalUrl, fetchedAt);
  const recordPart = safePart(parsed.meta.dvd_id || parsed.meta.source_record_id);
  const defaultDir = path.join(ROOT, "var", "providers", "javlibrary", `${compactTimestamp(fetchedAt)}-${recordPart}`);
  const outDir = args.out ? path.resolve(args.out) : defaultDir;
  fs.mkdirSync(outDir, { recursive: true });

  const rawPath = path.join(outDir, "raw.html");
  const canonicalPath = path.join(outDir, "canonical.json");
  const metaPath = path.join(outDir, "meta.json");
  fs.writeFileSync(rawPath, html, "utf8");
  fs.writeFileSync(canonicalPath, `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
  fs.writeFileSync(metaPath, `${JSON.stringify({
    ...parsed.meta,
    fetched_at: fetchedAt,
    fetch_mode: mode,
    requested_url: args.url || (args.code ? buildJavlibraryUrl({ code: args.code }) : ""),
    final_url: finalUrl,
    raw_sha256: crypto.createHash("sha256").update(html).digest("hex"),
    network_mode: network.mode,
    proxy_used: network.proxyUsed,
  }, null, 2)}\n`, "utf8");

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `javlibrary-${safePart(parsed.meta.dvd_id || parsed.meta.source_record_id)}-${fetchedAt.slice(0, 10).replaceAll("-", "")}`;
  console.log(`JavLibrary Provider 解析成功：${parsed.meta.page_type === "work" ? "作品" : "女优"}`);
  console.log(`网络模式：${network.label}${network.displayProxy ? `（${network.displayProxy}）` : ""}`);
  console.log(`来源：${finalUrl}`);
  console.log(`原始快照：${rel(rawPath)}`);
  console.log(`统一导入 JSON：${rel(canonicalPath)}`);
  console.log(`Provider 元数据：${rel(metaPath)}`);
  console.log(`本批女优：${parsed.canonical.actresses.length}；作品：${parsed.canonical.works.length}`);
  console.log("\n下一步只做 Prepare（不会写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${rel(canonicalPath)}" --batch "${batch}"`);
  console.log(`pnpm import:report -- --batch "${batch}"`);
} catch (error) {
  console.error(`JavLibrary Provider 失败：${error.message}`);
  process.exit(1);
}
