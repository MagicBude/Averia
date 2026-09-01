import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";
import { buildJavinfoMovieUrl, JAVINFO_PROVIDER_VERSION, parseJavinfoMovieResponse } from "./providers/javinfo/lib.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}
function compactTimestamp(iso) { return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia JavInfo API Provider V0.7.0\n\n用法：\n  set JAVINFO_API_KEY=jvi_xxx              # Windows CMD\n  $env:JAVINFO_API_KEY='jvi_xxx'           # PowerShell\n  export JAVINFO_API_KEY='jvi_xxx'         # Git Bash\n\n  pnpm provider:javinfo -- --code IPZZ-597\n  pnpm provider:javinfo -- --code IPZZ-597 --providers fanza\n  pnpm provider:javinfo -- --file <本地响应JSON> --code IPZZ-597\n\n安全：\n  - API Key 只从 JAVINFO_API_KEY 环境变量读取，不接受 --key，避免进入 shell history / process args。\n  - Provider 保存 raw.json / canonical.json / meta.json，不直接修改正式 CSV。\n  - JavInfo 是聚合/标准化中间层，canonical 来源写作 javinfo-fanza / javinfo-dmm 等，不伪装成直接官方抓取。\n  - FANZA/DMM 经 JavInfo 返回的人名、分类常为英文，因此来源角色为 reference，不覆盖厂商官方 authoritative 日文字段。`);
  process.exit(0);
}

try {
  const code = String(args.code ?? "").trim();
  if (!code) throw new Error("缺少 --code，例如：--code IPZZ-597");

  let payload;
  let fetchMode = "network";
  let requestedUrl = buildJavinfoMovieUrl({ code, providers: args.providers ?? "", includeImages: args["no-images"] ? false : true });
  let network = { mode: "offline-file", label: "离线文件", proxyUsed: false, displayProxy: "" };

  if (args.file) {
    payload = JSON.parse(fs.readFileSync(path.resolve(args.file), "utf8"));
    fetchMode = "file";
  } else {
    const key = String(process.env.JAVINFO_API_KEY ?? "").trim();
    if (!key) throw new Error("未设置 JAVINFO_API_KEY。请从 JavInfo 控制台获取 jvi_ 开头的密钥，并只通过环境变量提供；不要把密钥发到聊天或写入仓库。");

    const boot = bootstrapProxyIfNeeded({ explicitProxy: args.proxy ?? "" });
    if (boot.error) throw boot.error;
    if (boot.relaunched) process.exit(boot.status);

    const networkConfig = resolveProxyConfig({ explicitProxy: args.proxy ?? "" });
    network = describeNetworkMode(networkConfig);
    const response = await fetch(requestedUrl, {
      headers: {
        "x-javinfo-key": key,
        "accept": "application/json",
        "user-agent": "Averia/0.7 (+https://github.com/MagicBude/Averia)",
      },
      signal: AbortSignal.timeout(args.timeout ? Number(args.timeout) : 20000),
    });
    const text = await response.text();
    if (!response.ok) {
      const suffix = response.status === 401 ? "（请检查 JAVINFO_API_KEY）" : response.status === 402 ? "（余额不足）" : response.status === 429 ? "（已触发速率限制，请稍后重试）" : "";
      throw new Error(`JavInfo API 返回 HTTP ${response.status}${suffix}：${text.slice(0, 300)}`);
    }
    payload = JSON.parse(text);
  }

  const fetchedAt = new Date().toISOString();
  const parsed = parseJavinfoMovieResponse(payload, fetchedAt, { code });
  const defaultDir = path.join(ROOT, "var", "providers", "javinfo", `${compactTimestamp(fetchedAt)}-${safePart(parsed.meta.dvd_id)}`);
  const outDir = args.out ? path.resolve(args.out) : defaultDir;
  fs.mkdirSync(outDir, { recursive: true });

  const rawPath = path.join(outDir, "raw.json");
  const canonicalPath = path.join(outDir, "canonical.json");
  const metaPath = path.join(outDir, "meta.json");
  const rawText = `${JSON.stringify(payload, null, 2)}\n`;
  const rawSha256 = crypto.createHash("sha256").update(rawText).digest("hex");
  fs.writeFileSync(rawPath, rawText, "utf8");
  fs.writeFileSync(canonicalPath, `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
  fs.writeFileSync(metaPath, `${JSON.stringify({
    ...parsed.meta,
    fetched_at: fetchedAt,
    fetch_mode: fetchMode,
    requested_url: requestedUrl,
    raw_sha256: rawSha256,
    network_mode: network.mode,
    proxy_used: network.proxyUsed,
    api_key_stored: false,
  }, null, 2)}\n`, "utf8");

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `javinfo-${safePart(parsed.meta.dvd_id)}-${fetchedAt.slice(0,10).replaceAll("-","")}`;
  console.log("JavInfo API Provider 解析成功：作品");
  console.log(`上游来源：${parsed.meta.upstream_source}；Averia 来源：${parsed.meta.source_name}；角色：${parsed.meta.source_role}`);
  console.log(`网络模式：${network.label}${network.displayProxy ? `（${network.displayProxy}）` : ""}`);
  console.log(`番号：${parsed.meta.dvd_id}${parsed.meta.content_id ? `；Content ID：${parsed.meta.content_id}` : ""}`);
  console.log(`原始 JSON：${rel(rawPath)}`);
  console.log(`统一导入 JSON：${rel(canonicalPath)}`);
  console.log(`Provider 元数据：${rel(metaPath)}`);
  console.log(`本批女优：${parsed.canonical.actresses.length}；作品：${parsed.canonical.works.length}`);
  console.log("\n下一步仍然只做 Prepare（不会直接写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${rel(canonicalPath)}" --batch "${batch}"`);
  console.log(`pnpm import:report -- --batch "${batch}"`);
} catch (error) {
  console.error(`JavInfo API Provider 失败：${error.message}`);
  process.exit(1);
}
