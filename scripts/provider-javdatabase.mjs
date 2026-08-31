import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import { buildJavdatabaseUrl, fetchJavdatabaseHtml, parseJavdatabasePage } from "./providers/javdatabase/lib.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia JAVDatabase Provider V0.3.2\n\n用法：\n  pnpm provider:javdatabase -- --code SDAM-179\n  pnpm provider:javdatabase -- --idol sachi-yamada\n  pnpm provider:javdatabase -- --url https://www.javdatabase.com/movies/sdam-179/\n  pnpm provider:javdatabase -- --code SDAM-179 --proxy http://127.0.0.1:7790\n  pnpm provider:javdatabase -- --file <本地HTML> --url <原始URL>\n\n网络代理优先级：\n  1. --proxy 显式代理\n  2. HTTP_PROXY / HTTPS_PROXY 环境变量\n  3. Windows 系统代理自动发现\n  4. 直连\n\n说明：\n  - 代理端口不会写死在代码中。\n  - meta.json 只记录网络模式和是否使用代理，不保存代理 URL/凭据。\n  - 默认只抓取一个页面，不会递归批量抓取。\n  - Provider 只生成 raw.html / canonical.json / meta.json，不修改正式 CSV。\n  - 使用 --file 时不发起网络请求，适合离线调试 Parser。`);
  process.exit(0);
}

try {
  if (!args.file) {
    const boot = bootstrapProxyIfNeeded({ explicitProxy: args.proxy ?? "" });
    if (boot.error) throw boot.error;
    if (boot.relaunched) process.exit(boot.status);
  }

  const networkConfig = args.file
    ? { mode: "offline-file", proxyUsed: false, httpProxy: "", httpsProxy: "" }
    : resolveProxyConfig({ explicitProxy: args.proxy ?? "" });
  const network = args.file
    ? { mode: "offline-file", label: "离线文件", proxyUsed: false, displayProxy: "" }
    : describeNetworkMode(networkConfig);

  const requestedUrl = buildJavdatabaseUrl(args);
  const fetchedAt = new Date().toISOString();
  let html;
  let finalUrl = requestedUrl;
  let mode = "network";

  if (args.file) {
    html = fs.readFileSync(path.resolve(args.file), "utf8");
    mode = "file";
  } else {
    const fetched = await fetchJavdatabaseHtml(requestedUrl, { timeoutMs: args.timeout ? Number(args.timeout) : undefined });
    html = fetched.html;
    finalUrl = fetched.finalUrl;
  }

  const parsed = parseJavdatabasePage(html, finalUrl, fetchedAt);
  const recordPart = safePart(parsed.meta.dvd_id || parsed.meta.source_record_id);
  const defaultDir = path.join(ROOT, "var", "providers", "javdatabase", `${compactTimestamp(fetchedAt)}-${recordPart}`);
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
    requested_url: requestedUrl,
    final_url: finalUrl,
    raw_sha256: crypto.createHash("sha256").update(html).digest("hex"),
    network_mode: network.mode,
    proxy_used: network.proxyUsed,
  }, null, 2)}\n`, "utf8");

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `javdatabase-${safePart(parsed.meta.dvd_id || parsed.meta.source_record_id)}-${fetchedAt.slice(0, 10).replaceAll("-", "")}`;
  console.log(`JAVDatabase Provider 解析成功：${parsed.meta.page_type === "work" ? "作品" : "女优"}`);
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
  console.error(`JAVDatabase Provider 失败：${error.message}`);
  process.exit(1);
}
