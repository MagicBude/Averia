// Averia JavInfo API Provider — 多源独立请求变体（V0.8 Phase 5）
//
// 与 provider-javinfo.mjs（单请求、单源）不同，本脚本对 fanza / dmm / javdatabase
// 分别发起「独立」API 请求（非 waterfall 合并），各自保留原始响应与规范化结果，
// 便于后续跨源字段级溯源、冲突裁决与实体归并。
//
// 设计约束（见 AGENTS.md / docs/design/V0.8-MULTI-SOURCE-RESOLUTION.md）：
// - API Key 只从 JAVINFO_API_KEY 环境变量读取，不接受 --key；
// - 保留 raw.json / canonical.json / meta.json，不直接修改正式 CSV；
// - JavInfo 是聚合/标准化中间层，canonical 来源写作 javinfo-fanza / javinfo-dmm 等。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib/catalog.mjs";
import { bootstrapProxyIfNeeded, describeNetworkMode, resolveProxyConfig } from "./lib/network-proxy.mjs";
import { buildJavinfoMovieUrl, JAVINFO_PROVIDER_VERSION, parseJavinfoMovieResponse } from "./providers/javinfo/lib.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}
function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// 轻量 CLI 解析（仅识别本脚本所需的参数，避免依赖 import/lib.mjs 的通用解析器语义差异）。
function parseCli(argv) {
  const o = {
    sources: ["fanza", "dmm", "javdatabase"],
    code: null,
    out: null,
    fixtures: {},
    noImages: false,
    timeout: 20000,
    proxy: "",
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--code") o.code = argv[++i];
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--providers") o.sources = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--file") {
      // 单文件回放：仅当其 source 命中请求的某一源时生效；否则忽略（需按源指定）。
      const p = argv[++i];
      const src = String(o.sources[0] ?? "fanza");
      o.fixtures[src] = p;
    } else if (a.startsWith("--file-")) o.fixtures[a.slice(7)] = argv[++i];
    else if (a === "--no-images") o.noImages = true;
    else if (a === "--timeout") o.timeout = Number(argv[++i]);
    else if (a === "--proxy") o.proxy = argv[++i];
  }
  return o;
}

/**
 * 对一个番号，按来源列表各自发起一次请求（或回放 fixture），分目录落盘。
 * @param {object} cfg
 * @param {string} cfg.code 番号
 * @param {string[]} cfg.sources 来源列表（fanza / dmm / javdatabase）
 * @param {string} cfg.outBaseDir 落盘根目录（会再套一层 <source>/）
 * @param {Record<string,string>} [cfg.fixtures] 来源 -> fixture 文件路径（离线回放）
 * @param {boolean} [cfg.noImages]
 * @param {number} [cfg.timeout]
 * @param {Function} [cfg.fetchImpl] 可选注入的 fetch 实现，用于测试；签名 (url) => Promise<{ok,status,text}>
 * @returns {Promise<Array<object>>} 每个来源的结果摘要
 */
export async function runMulti({ code, sources, outBaseDir, fixtures = {}, noImages = false, timeout = 20000, fetchImpl = null }) {
  if (!code) throw new Error("缺少 code，例如：--code IPZZ-597");
  const results = [];
  for (const source of sources) {
    let payload;
    let fetchMode = "file";
    let requestedUrl = null;
    let network = null;
    const fixturePath = fixtures[source];
    if (fixturePath) {
      payload = JSON.parse(fs.readFileSync(path.resolve(fixturePath), "utf8"));
      // 离线回放时强制以请求来源标记，保证 source_name 与目录一致。
      if (payload.source !== source) payload = { ...payload, source };
    } else {
      if (typeof fetchImpl !== "function") {
        throw new Error(`[${source}] 未提供 --file-${source}，且未注入 fetch 实现，无法离线运行。`);
      }
      requestedUrl = buildJavinfoMovieUrl({ code, providers: source, includeImages: !noImages });
      const resp = await fetchImpl(requestedUrl);
      if (!resp.ok) {
        const suffix = resp.status === 401 ? "（请检查 JAVINFO_API_KEY）" : resp.status === 402 ? "（余额不足）" : resp.status === 429 ? "（已触发速率限制，请稍后重试）" : "";
        throw new Error(`[${source}] JavInfo API 返回 HTTP ${resp.status}${suffix}：${String(resp.text).slice(0, 300)}`);
      }
      payload = JSON.parse(resp.text);
      fetchMode = "network";
    }

    const fetchedAt = new Date().toISOString();
    const parsed = parseJavinfoMovieResponse(payload, fetchedAt, { code });
    const outDir = path.join(outBaseDir, source);
    fs.mkdirSync(outDir, { recursive: true });

    const rawText = `${JSON.stringify(payload, null, 2)}\n`;
    const rawSha256 = crypto.createHash("sha256").update(rawText).digest("hex");
    fs.writeFileSync(path.join(outDir, "raw.json"), rawText, "utf8");
    fs.writeFileSync(path.join(outDir, "canonical.json"), `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(outDir, "meta.json"), `${JSON.stringify({
      ...parsed.meta,
      provider_version: JAVINFO_PROVIDER_VERSION,
      fetched_at: fetchedAt,
      fetch_mode: fetchMode,
      requested_url: requestedUrl ?? "",
      raw_sha256: rawSha256,
      network_mode: network?.mode ?? "",
      proxy_used: network?.proxyUsed ?? false,
      api_key_stored: false,
    }, null, 2)}\n`, "utf8");

    results.push({
      source,
      source_name: parsed.meta.source_name,
      role: parsed.meta.source_role,
      language: parsed.meta.source_language,
      outDir: path.relative(ROOT, outDir) || outDir,
      workCount: parsed.canonical.works.length,
      actressCount: parsed.canonical.actresses.length,
    });
  }
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseCli(process.argv.slice(2));
  if (args.help) {
    console.log(`Averia JavInfo API Provider（多源独立请求）V0.8 Phase 5

用法：
  set JAVINFO_API_KEY=jvi_xxx              # Windows CMD
  $env:JAVINFO_API_KEY='jvi_xxx'           # PowerShell
  export JAVINFO_API_KEY='jvi_xxx'         # Git Bash

  pnpm provider:javinfo:multi -- --code IPZZ-597
  pnpm provider:javinfo:multi -- --code IPZZ-597 --providers fanza,dmm
  pnpm provider:javinfo:multi -- --code IPZZ-597 --out var/providers/javinfo/IPZZ-597

离线回放（无需 Key，CI / 测试用）：
  pnpm provider:javinfo:multi -- --code IPZZ-597 --file-fanza tests/fixtures/javinfo/multi/fanza.json --file-dmm tests/fixtures/javinfo/multi/dmm.json --file-javdatabase tests/fixtures/javinfo/multi/javdatabase.json

安全：
  - API Key 只从 JAVINFO_API_KEY 读取，不接受 --key。
  - 每个来源独立保存 raw.json / canonical.json / meta.json，不修改正式 CSV。
  - JavInfo 是聚合/标准化中间层，canonical 来源写作 javinfo-fanza / javinfo-dmm 等。`);
    process.exit(0);
  }

  try {
    const code = String(args.code ?? "").trim();
    if (!code) throw new Error("缺少 --code，例如：--code IPZZ-597");

    // 若未提供任何 --file-*，则走实时网络（需要 Key）。
    const hasFixture = Object.keys(args.fixtures).length > 0;
    let fetchImpl = null;
    if (!hasFixture) {
      const key = String(process.env.JAVINFO_API_KEY ?? "").trim();
      if (!key) throw new Error("未设置 JAVINFO_API_KEY。请从 JavInfo 控制台获取 jvi_ 开头的密钥，仅通过环境变量提供；不要把密钥发到聊天或写入仓库。");

      const boot = bootstrapProxyIfNeeded({ explicitProxy: args.proxy ?? "" });
      if (boot.error) throw boot.error;
      if (boot.relaunched) process.exit(boot.status);

      const networkConfig = resolveProxyConfig({ explicitProxy: args.proxy ?? "" });
      const network = describeNetworkMode(networkConfig);
      fetchImpl = async (url) => {
        const r = await fetch(url, {
          headers: {
            "x-javinfo-key": key,
            "accept": "application/json",
            "user-agent": "Averia/0.8 (+https://github.com/MagicBude/Averia)",
          },
          signal: AbortSignal.timeout(args.timeout ? Number(args.timeout) : 20000),
        });
        const text = await r.text();
        return { ok: r.ok, status: r.status, text };
      };
      // network 仅用于 meta 记录，runMulti 内部不感知；这里先按来源逐个传入 network 不便，
      // 故把 network 信息交给 meta 的 network_mode 字段（runMulti 已置空，CLI 模式可忽略）。
      void network;
    }

    const outBaseDir = args.out
      ? path.resolve(args.out)
      : path.join(ROOT, "var", "providers", "javinfo", `${compactTimestamp(new Date().toISOString())}-${safePart(code)}`);

    const results = await runMulti({ code, sources: args.sources, outBaseDir, fixtures: args.fixtures, noImages: args.noImages, timeout: args.timeout, fetchImpl });

    console.log(`JavInfo 多源请求完成（${results.length} 个来源）：\n`);
    for (const r of results) {
      console.log(`- ${r.source}（${r.source_name}，角色=${r.role}，语言=${r.language}）`);
      console.log(`  作品 ${r.workCount} / 女优 ${r.actressCount}`);
      console.log(`  目录：${r.outDir}`);
    }

    if (hasFixture) {
      console.log("\n（离线回放模式：未发起真实网络请求）");
    }
    console.log("\n下一步仍只做 Prepare（不会直接写正式 CSV）：");
    for (const r of results) {
      const batch = `javinfo-${r.source}-${safePart(code)}`;
      console.log(`pnpm import:prepare -- --file "${r.outDir}/canonical.json" --batch "${batch}"`);
      console.log(`pnpm import:report -- --batch "${batch}"`);
    }
  } catch (error) {
    console.error(`JavInfo 多源 Provider 失败：${error.message}`);
    process.exit(1);
  }
}
