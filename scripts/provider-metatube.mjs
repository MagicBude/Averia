// scripts/provider-metatube.mjs
//
// Averia MetaTube Provider 命令行入口。
// 用法见 --help。只产出 raw.json / canonical.json / meta.json，绝不直接写正式 CSV。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { parseArgs } from "./import/lib.mjs";
import {
  METATUBE_DEFAULT_BASE,
  METATUBE_PROVIDER_VERSION,
  fetchMetatubeJson,
  parseMetatubeMovieResponse,
  parseMetatubeActorResponse,
} from "./providers/metatube/lib.mjs";

function safePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "record";
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeCode(value) {
  const raw = String(value ?? "").toUpperCase().replace(/[‐‑‒–—―ー－]/g, "-");
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{2,12})(\d{2,7})$/.exec(compact);
  return match ? `${match[1]}-${match[2]}` : raw;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia MetaTube Provider V0.8（直连本地 metatube-server）

前置条件：
  先在本地起好 metatube-server：
    docker run -d -p 8080:8080 ghcr.io/metatube-community/metatube-server:latest
  或下载 Windows 二进制解压双击：
    https://github.com/metatube-community/metatube-server-releases

用法：
  pnpm provider:metatube -- --provider fanza --code IPZZ-597
  pnpm provider:metatube -- --provider madouqu --code ...
  pnpm provider:metatube -- --provider fanza --id ipzz-00597 --type actor
  pnpm provider:metatube -- --provider fanza --code IPZZ-597 --base http://192.168.1.10:8080 --token SECRET
  pnpm provider:metatube -- --file <本地JSON> --provider fanza --id ipzz-597

参数：
  --provider <名>   数据源名（fanza/javbus/madouqu/jav321/mgstage/sod/duga…），默认 fanza
  --code <番号>     作品/女优番号（用于拼 id；也可直接 --id 给原始 id）
  --id <id>         该源稳定记录 id（优先于 --code）
  --type movie|actor 请求类型，默认 movie
  --base <url>      metatube-server 地址，默认 ${METATUBE_DEFAULT_BASE}
  --token <token>   server 设了 TOKEN 时必填
  --proxy <url>     仅在 base 非本地时生效（本地 localhost 不走代理）
  --file <json>     离线模式：直接读本地 JSON，不发起网络请求（适合调试 Parser）
  --out <dir>       输出目录，默认 var/providers/metatube/<时间戳>-<记录>
  --timeout <ms>    请求超时，默认 30000
  --help            显示本帮助

说明：
  - 原始 JSON 落 raw.json 并计算 SHA-256 写入 meta.json，可审查可复现。
  - Provider 只生成 canonical，不修改正式 CSV。后续走 import:prepare → import:apply。`);
  process.exit(0);
}

try {
  const base = args.base || METATUBE_DEFAULT_BASE;
  const provider = cleanArg(args.provider) || "fanza";
  const type = (args.type || "movie").toLowerCase() === "actor" ? "actor" : "movie";
  const id = cleanArg(args.id) || normalizeCode(args.code);
  if (!id) throw new Error("必须提供 --code 或 --id。");

  const fetchedAt = new Date().toISOString();
  let rawJson;
  let finalUrl = "";
  let mode = "network";

  if (args.file) {
    rawJson = JSON.parse(fs.readFileSync(path.resolve(args.file), "utf8"));
    mode = "file";
  } else {
    const fetched = await fetchMetatubeJson(base, provider, id, {
      token: cleanArg(args.token) || "",
      type,
      timeoutMs: args.timeout ? Number(args.timeout) : 30000,
      proxy: cleanArg(args.proxy) || "",
    });
    rawJson = fetched.json;
    finalUrl = fetched.url;
  }

  const parse = type === "actor" ? parseMetatubeActorResponse : parseMetatubeMovieResponse;
  const parsed = parse(rawJson, fetchedAt, { provider });
  const recordPart = safePart(parsed.meta.movie_number || parsed.meta.actor_name || parsed.meta.movie_id || id);

  const defaultDir = path.join(ROOT, "var", "providers", "metatube", `${compactTimestamp(fetchedAt)}-${recordPart}`);
  const outDir = args.out ? path.resolve(args.out) : defaultDir;
  fs.mkdirSync(outDir, { recursive: true });

  const rawPath = path.join(outDir, "raw.json");
  const canonicalPath = path.join(outDir, "canonical.json");
  const metaPath = path.join(outDir, "meta.json");

  fs.writeFileSync(rawPath, `${JSON.stringify(rawJson, null, 2)}\n`, "utf8");
  fs.writeFileSync(canonicalPath, `${JSON.stringify(parsed.canonical, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        ...parsed.meta,
        fetched_at: fetchedAt,
        fetch_mode: mode,
        requested_base: base,
        requested_url: finalUrl,
        raw_sha256: crypto.createHash("sha256").update(JSON.stringify(rawJson)).digest("hex"),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const rel = (file) => path.relative(ROOT, file) || ".";
  const batch = `metatube-${provider}-${safePart(parsed.meta.movie_number || parsed.meta.actor_name || id)}-${fetchedAt.slice(0, 10).replaceAll("-", "")}`;
  console.log(`MetaTube Provider 解析成功：${type === "actor" ? "女优" : "作品"}（provider=${provider}）`);
  console.log(`来源：${mode === "file" ? args.file : finalUrl}`);
  console.log(`原始快照：${rel(rawPath)}`);
  console.log(`统一导入 JSON：${rel(canonicalPath)}`);
  console.log(`Provider 元数据：${rel(metaPath)}`);
  console.log(`本批女优：${parsed.canonical.actresses.length}；作品：${parsed.canonical.works.length}`);
  console.log("\n下一步只做 Prepare（不会写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${rel(canonicalPath)}" --batch "${batch}"`);
  console.log(`pnpm import:report -- --batch "${batch}"`);
} catch (error) {
  console.error(`MetaTube Provider 失败：${error.message}`);
  process.exit(1);
}

function cleanArg(value) {
  return String(value ?? "").trim();
}
