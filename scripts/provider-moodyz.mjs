import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import { buildMoodyzUrl, fetchMoodyzHtml, parseMoodyzPage } from "./providers/moodyz/lib.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function recordPartFromUrl(value) {
  try {
    const pieces = new URL(value).pathname.split("/").filter(Boolean);
    return safePart(pieces.at(-1) || "record");
  } catch {
    return "record";
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia MOODYZ Official Provider V0.4.6\n\n用法：\n  pnpm provider:moodyz -- --code MDVR-434\n  pnpm provider:moodyz -- --actress-id 855540\n  pnpm provider:moodyz -- --url https://moodyz.com/works/detail/MDVR434\n  pnpm provider:moodyz -- --code MDVR-434 --proxy http://127.0.0.1:7790\n  pnpm provider:moodyz -- --code MDVR-434 --transport curl\n  pnpm provider:moodyz -- --file <本地HTML> --url <原始URL>\n\n说明：\n  - MOODYZ 官方日文站被视为该厂商作品/女优字段的权威来源。\n  - 代理优先级沿用 Averia：--proxy → 环境变量 → Windows 系统代理 → 直连。\n  - 网络传输默认 auto；Windows + 代理下优先系统 curl，其它环境 Node fetch 失败时自动回退 curl。\n  - HTTP 408/429/500/502/503/504 默认自动重试 3 次，并采用指数退避。\n  - 可用 --transport auto|node|curl 手动指定传输方式。\n  - 默认一次只抓一个作品页或女优页，不递归批量抓取。\n  - Provider 只生成 raw.html / canonical.json / meta.json，不修改正式 CSV。\n  - 使用 --file 时不发起网络请求，适合离线调试 Parser。`);
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

  const requestedUrl = buildMoodyzUrl({
    ...args,
    actressId: args.actressId ?? args["actress-id"],
  });
  const fetchedAt = new Date().toISOString();
  let html;
  let finalUrl = requestedUrl;
  let mode = "network";
  let transport = "offline-file";
  let transportFallbackFrom = "";
  let networkAttempts = 1;

  if (args.file) {
    html = fs.readFileSync(path.resolve(args.file), "utf8");
    mode = "file";
  } else {
    const transportMode = String(args.transport ?? "auto").toLowerCase();
    const proxyUrl = networkConfig.httpsProxy || networkConfig.httpProxy || "";
    const preferCurl = transportMode === "auto" && process.platform === "win32" && networkConfig.proxyUsed;
    const fetched = await fetchMoodyzHtml(requestedUrl, {
      timeoutMs: args.timeout ? Number(args.timeout) : undefined,
      proxyUrl,
      transport: transportMode,
      preferCurl,
    });
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    transport = fetched.transport;
    transportFallbackFrom = fetched.fallbackFrom || "";
    networkAttempts = fetched.attempts || 1;
  }

  // 先落原始快照，再进入 Parser。这样真实页面结构发生变化时，
  // 即使解析失败也能保留现场，后续可用 --file 离线复现，而不必重新请求来源站。
  const recordPart = recordPartFromUrl(finalUrl);
  const defaultDir = path.join(ROOT, "var", "providers", "moodyz", `${compactTimestamp(fetchedAt)}-${recordPart}`);
  const outDir = args.out ? path.resolve(args.out) : defaultDir;
  fs.mkdirSync(outDir, { recursive: true });

  const rawPath = path.join(outDir, "raw.html");
  const canonicalPath = path.join(outDir, "canonical.json");
  const metaPath = path.join(outDir, "meta.json");
  const rawSha256 = crypto.createHash("sha256").update(html).digest("hex");
  const baseMeta = {
    fetched_at: fetchedAt,
    fetch_mode: mode,
    requested_url: requestedUrl,
    final_url: finalUrl,
    raw_sha256: rawSha256,
    network_mode: network.mode,
    proxy_used: network.proxyUsed,
    network_transport: transport,
    transport_fallback_from: transportFallbackFrom || undefined,
    network_attempts: networkAttempts,
  };

  fs.writeFileSync(rawPath, html, "utf8");

  let parsed;
  try {
    parsed = parseMoodyzPage(html, finalUrl, fetchedAt);
  } catch (parseError) {
    fs.writeFileSync(metaPath, `${JSON.stringify({
      ...baseMeta,
      provider_version: 7,
      parse_status: "failed",
      parse_error: parseError.message,
    }, null, 2)}\n`, "utf8");
    const rawRel = path.relative(ROOT, rawPath) || ".";
    const metaRel = path.relative(ROOT, metaPath) || ".";
    throw new Error(`${parseError.message}；原始快照已保留：${rawRel}；失败元数据：${metaRel}`);
  }

  fs.writeFileSync(canonicalPath, `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
  fs.writeFileSync(metaPath, `${JSON.stringify({
    ...parsed.meta,
    ...baseMeta,
    parse_status: "success",
  }, null, 2)}\n`, "utf8");

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `moodyz-${safePart(parsed.meta.dvd_id || parsed.meta.source_record_id)}-${fetchedAt.slice(0, 10).replaceAll("-", "")}`;
  console.log(`MOODYZ Official Provider 解析成功：${parsed.meta.page_type === "work" ? "作品" : "女优"}`);
  console.log(`数据语言：日文；来源角色：权威厂商源`);
  console.log(`网络模式：${network.label}${network.displayProxy ? `（${network.displayProxy}）` : ""}`);
  console.log(`网络传输：${transport}${transportFallbackFrom ? `（回退自 ${transportFallbackFrom}）` : ""}`);
  console.log(`网络尝试：${networkAttempts} 次`);
  console.log(`来源：${finalUrl}`);
  console.log(`原始快照：${rel(rawPath)}`);
  console.log(`统一导入 JSON：${rel(canonicalPath)}`);
  console.log(`Provider 元数据：${rel(metaPath)}`);
  console.log(`本批女优：${parsed.canonical.actresses.length}；作品：${parsed.canonical.works.length}`);
  if (parsed.meta.discovered_work_urls?.length) console.log(`发现作品链接：${parsed.meta.discovered_work_urls.length}（仅记录，不自动抓取）`);
  console.log("\n下一步只做 Prepare（不会写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${rel(canonicalPath)}" --batch "${batch}"`);
  console.log(`pnpm import:report -- --batch "${batch}"`);
} catch (error) {
  console.error(`MOODYZ Official Provider 失败：${error.message}`);
  process.exit(1);
}
