// scripts/ingest-metatube.mjs
//
// Averia 批量灌库编排器（MetaTube 一条线）。
//
// 定位：
//   我们已经有了 metatube adapter（把 MetaTube 的 MovieInfo 转成 Averia canonical），
//   但原来只能「一次一个番号」手动跑 provider:metatube → import:prepare → import:apply。
//   本脚本把这些步骤串起来：读一份种子清单（要灌哪些番号），逐个向【本地/自建】的
//   metatube-server 取数，合并成单个导入批次，一次性 prepare，最后（显式 --apply）落库。
//
// 合规边界（与 AGENTS.md 一致）：
//   - 只调本地/自建 metatube-server 的 REST API，不碰第三方站点、不绕过反爬/验证码；
//   - 默认【不写正式 CSV】：--apply 才写；写入前若有 pending_review 字段冲突则自动阻断，
//     必须人工 resolution:decide 后再 apply（对应「冲突不可静默解决」）；
//   - 网络请求之间按 --delay 限速，尊重上游站点与 server。
//
// 用法见 --help。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import {
  catalogFingerprint,
  importBatchDir,
  parseArgs,
  prepareImport,
  renderImportReport,
  pendingReviewCount,
} from "./import/lib.mjs";
import {
  METATUBE_DEFAULT_BASE,
  fetchMetatubeJson,
  parseMetatubeMovieResponse,
  parseMetatubeActorResponse,
  isLocalBase,
} from "./providers/metatube/lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Averia 批量灌库（MetaTube 一条线）

前置条件：
  本地先起好 metatube-server（Docker 或 Windows 二进制），监听 ${METATUBE_DEFAULT_BASE}。

用法：
  # 1) 准备种子清单（每行一个番号，见 data/seeds/metatube.sample.txt）
  pnpm ingest:metatube -- --seeds var/seeds/metatube.txt
  # 2) 非本地 server 需要走代理
  pnpm ingest:metatube -- --seeds var/seeds/metatube.txt --base http://192.168.1.10:8080 --proxy http://127.0.0.1:7890
  # 3) 离线模式：把每个 seed 当成「本地 JSON 路径」读取，不发网络（调试/复灌缓存）
  pnpm ingest:metatube -- --seeds var/seeds/local-fixtures.txt --file
  # 4) 确认报告无误后，才真正落库（写正式 CSV）
  pnpm ingest:metatube -- --seeds var/seeds/metatube.txt --apply

参数：
  --seeds <文件>    种子清单（.txt 或 .json），默认 var/seeds/metatube.txt
  --base <url>      metatube-server 地址，默认 ${METATUBE_DEFAULT_BASE}
  --token <token>   server 设了 TOKEN 时必填
  --proxy <url>     仅当 base 非本地时生效
  --delay <ms>      两次网络取数之间的间隔，默认 1500（限速）
  --type movie|actor 取数类型，默认 movie
  --batch <名>      导入批次名，默认 metatube-bulk-<日期>
  --file            离线模式：seed 行当作本地 JSON 路径，不发网络
  --apply           确认报告无误后写正式 CSV（默认只 prepare，不写）
  --help            显示本帮助

说明：
  - 所有取数合并为【一个批次】，便于统一 review；冲突会在 apply 前阻断。
  - 批次暂存于 var/imports/<batch>/（已 gitignore），不污染仓库。`);
  process.exit(0);
}

// ---------- 参数 ----------
const seedsFile = args.seeds || path.join(ROOT, "var", "seeds", "metatube.txt");
const base = args.base || METATUBE_DEFAULT_BASE;
const token = args.token || "";
const proxy = args.proxy || "";
const delayMs = args.delay ? Number(args.delay) : 1500;
const type = (args.type || "movie").toLowerCase() === "actor" ? "actor" : "movie";
const apply = Boolean(args.apply);
const fileMode = Boolean(args.file);
const batchId = String(args.batch || `metatube-bulk-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`).replace(
  /[^a-zA-Z0-9._-]+/g,
  "-",
);

if (!fs.existsSync(seedsFile)) {
  console.error(`找不到种子清单：${seedsFile}`);
  process.exit(1);
}

// ---------- 读种子清单 ----------
// 支持两种格式：
//   .txt：每行 "provider:code" 或纯 "code"（默认 provider=fanza）；# 开头为注释
//   .json：[{ "provider": "fanza", "code": "IPZZ-597", "type": "movie" }, ...]
const seeds = readSeeds(seedsFile);
if (!seeds.length) {
  console.error(`种子清单为空：${seedsFile}`);
  process.exit(1);
}
console.log(`读取种子 ${seeds.length} 条（type=${type}${fileMode ? "，离线 file 模式" : `，base=${base}`}）`);

// ---------- 逐个取数 + 解析 ----------
const merged = {
  schema_version: 1,
  source: { name: "metatube-bulk", fetched_at: new Date().toISOString(), language: "ja", role: "supplemental" },
  works: [],
  actresses: [],
};
let ok = 0;
let fail = 0;
for (const seed of seeds) {
  try {
    let canonical;
    if (fileMode) {
      // 离线：seed.code 被当作本地 JSON 文件路径
      const raw = JSON.parse(fs.readFileSync(path.resolve(seed.code), "utf8"));
      const parse = type === "actor" ? parseMetatubeActorResponse : parseMetatubeMovieResponse;
      canonical = parse(raw, new Date().toISOString(), { provider: seed.provider }).canonical;
    } else {
      if (!isLocalBase(base) && !proxy) {
        console.warn(`[warn] base=${base} 非本地但未给 --proxy，可能因系统代理无法直连；建议加 --proxy <url>。`);
      }
      const fetched = await fetchMetatubeJson(base, seed.provider, seed.code, {
        token,
        type,
        timeoutMs: 30000,
        proxy,
      });
      const parse = type === "actor" ? parseMetatubeActorResponse : parseMetatubeMovieResponse;
      canonical = parse(fetched.json, new Date().toISOString(), { provider: seed.provider }).canonical;
    }
    merged.works.push(...canonical.works);
    merged.actresses.push(...canonical.actresses);
    ok += 1;
    console.log(`  ✓ ${seed.provider}:${seed.code}（works=${canonical.works.length}, actresses=${canonical.actresses.length}）`);
  } catch (error) {
    fail += 1;
    console.error(`  ✗ ${seed.provider}:${seed.code} 失败：${error.message}`);
  }
  if (!fileMode && delayMs > 0) await sleep(delayMs);
}
console.log(`\n取数完成：成功 ${ok}，失败 ${fail}；合并得 ${merged.works.length} works / ${merged.actresses.length} actresses`);

// ---------- prepare（合并为单批次）----------
const dir = importBatchDir(batchId);
fs.mkdirSync(dir, { recursive: true });
const stage = prepareImport(merged, { batchId, fingerprint: catalogFingerprint() });
fs.writeFileSync(path.join(dir, "stage.json"), `${JSON.stringify(stage, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(dir, "report.md"), renderImportReport(stage), "utf8");

const pending = pendingReviewCount(stage);
console.log(`\n批次：${batchId}`);
console.log(`暂存目录：${path.relative(ROOT, dir)}`);
console.log(`阻塞错误：${stage.summary.error_count}；待裁决字段冲突：${pending}`);
if (pending > 0) {
  console.log("\n存在字段冲突，apply 会被阻断。冲突明细见 report.md，或运行：");
  console.log(`pnpm resolution:report -- --batch ${batchId}`);
}

// ---------- apply（必须显式）----------
if (apply) {
  if (stage.summary.error_count > 0) {
    console.error("批次存在阻塞错误，拒绝 apply。");
    process.exit(2);
  }
  if (pending > 0) {
    console.error(`批次存在 ${pending} 个待裁决冲突，拒绝 apply；先 resolution:decide 再重试。`);
    process.exit(5);
  }
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "import-apply.mjs"), "--", "--batch", batchId], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exit(result.status ?? 0);
}
console.log("\n未指定 --apply，仅完成 prepare + 报告。确认无误后落库：");
console.log(`pnpm ingest:metatube -- --seeds "${path.relative(ROOT, seedsFile)}" --apply`);

// ---------- 小工具 ----------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSeeds(file) {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    const arr = JSON.parse(text);
    return arr.map((x) => ({ provider: x.provider || "fanza", code: String(x.code), type: x.type || "movie" }));
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const provider = line.slice(0, idx).trim();
        const code = line.slice(idx + 1).trim();
        if (code) return { provider, code };
      }
      return { provider: "fanza", code: line }; // 整行就是番号
    });
}
