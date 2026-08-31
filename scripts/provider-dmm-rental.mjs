import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";
import {
  DMM_RENTAL_PROVIDER_VERSION,
  buildDmmRentalUrl,
  extractDmmCid,
  fetchDmmRentalHtml,
  parseDmmRentalWork,
} from "./providers/dmm-rental/lib.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia DMM Rental Provider V0.6.0\n\n用法：\n  pnpm provider:dmm-rental -- --cid 4ipzz698\n  pnpm provider:dmm-rental -- --cid 4ipzz698 --code IPZZ-698\n  pnpm provider:dmm-rental -- --url "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=4ipzz698/"\n  pnpm provider:dmm-rental -- --file <本地HTML> --url <原始URL> --code IPZZ-698\n\n说明：\n  - 当前只支持公开的 FANZA/DMM 宅配单品 Rental 作品详情页。\n  - 来源角色为 reference：日文广覆盖参考源，不覆盖厂商官方 authoritative 数据。\n  - DMM 页面的「貸出開始日」是租赁开始日，不会误写到作品 release_date；会保留在来源备注与 Provider 元数据。\n  - DMM 品番如 4ipzz698 会尝试保守推导为 IPZZ-698；无法安全推导时必须使用 --code。\n  - 默认一次只抓一个详情页，不递归、不批量扫描、不绕过年龄确认/验证码/登录或付费访问控制。\n  - Provider 只生成 raw.html / canonical.json / meta.json，不直接修改正式 CSV。\n  - 支持 --proxy、--transport auto|node|curl、--timeout，与其它 Provider 共用自动代理与网络重试。`);
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

  const requestedUrl = buildDmmRentalUrl({ url: args.url ?? "", cid: args.cid ?? "" });
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
    const fetched = await fetchDmmRentalHtml(requestedUrl, {
      timeoutMs: args.timeout ? Number(args.timeout) : undefined,
      proxyUrl,
      transport: transportMode,
      preferCurl,
      onRetry: (event) => {
        const wait = event.delayMs > 0 ? `，${event.delayMs}ms 后重试` : "，立即重试";
        if (event.kind === "http") console.warn(`网络重试：第 ${event.attempt}/${event.maxAttempts} 次返回 HTTP ${event.status}${wait}。`);
        else console.warn(`网络重试：第 ${event.attempt}/${event.maxAttempts} 次发生 ${event.code}${wait}。`);
      },
    });
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    transport = fetched.transport;
    transportFallbackFrom = fetched.fallbackFrom || "";
    networkAttempts = fetched.attempts || 1;
  }

  const cid = extractDmmCid(finalUrl) || String(args.cid ?? "").trim() || "record";
  const defaultDir = path.join(ROOT, "var", "providers", "dmm-rental", `${compactTimestamp(fetchedAt)}-${safePart(cid)}`);
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
    parsed = parseDmmRentalWork(html, finalUrl, fetchedAt, { code: args.code ?? "" });
  } catch (parseError) {
    fs.writeFileSync(metaPath, `${JSON.stringify({
      ...baseMeta,
      provider_version: DMM_RENTAL_PROVIDER_VERSION,
      parse_status: "failed",
      parse_error: parseError.message,
    }, null, 2)}\n`, "utf8");
    throw new Error(`${parseError.message}；原始快照已保留：${path.relative(ROOT, rawPath)}；失败元数据：${path.relative(ROOT, metaPath)}`);
  }

  fs.writeFileSync(canonicalPath, `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
  fs.writeFileSync(metaPath, `${JSON.stringify({ ...parsed.meta, ...baseMeta, parse_status: "success" }, null, 2)}\n`, "utf8");

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `dmm-rental-${safePart(parsed.meta.catalog_code || parsed.meta.dmm_cid)}-${fetchedAt.slice(0, 10).replaceAll("-", "")}`;
  console.log("DMM Rental Provider 解析成功：作品");
  console.log("数据语言：日文；来源角色：参考源（厂商官方数据优先）");
  console.log(`网络模式：${network.label}${network.displayProxy ? `（${network.displayProxy}）` : ""}`);
  console.log(`网络传输：${transport}${transportFallbackFrom ? `（回退自 ${transportFallbackFrom}）` : ""}`);
  console.log(`网络尝试：${networkAttempts} 次`);
  console.log(`DMM CID：${parsed.meta.dmm_cid}`);
  console.log(`主番号：${parsed.meta.catalog_code}（${parsed.meta.catalog_code_source}）`);
  if (parsed.meta.rental_start_date) console.log(`貸出開始日：${parsed.meta.rental_start_date}（仅作为来源观察值，不写 release_date）`);
  console.log(`来源：${finalUrl}`);
  console.log(`原始快照：${rel(rawPath)}`);
  console.log(`统一导入 JSON：${rel(canonicalPath)}`);
  console.log(`Provider 元数据：${rel(metaPath)}`);
  console.log(`本批女优：${parsed.canonical.actresses.length}；作品：${parsed.canonical.works.length}`);
  console.log("\n下一步只做 Prepare（不会写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${rel(canonicalPath)}" --batch "${batch}"`);
  console.log(`pnpm import:report -- --batch "${batch}"`);
} catch (error) {
  console.error(`DMM Rental Provider 失败：${error.message}`);
  process.exit(1);
}
