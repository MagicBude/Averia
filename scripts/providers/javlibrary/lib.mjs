// scripts/providers/javlibrary/lib.mjs
//
// Averia JavLibrary Provider —— 合规版（V0.8 新增源）
import crypto from "node:crypto";
//
// 设计要点（对照 AGENTS.md 与 V0.8 设计）：
//   1. 复用 OpenAver(core/scrapers/javlibrary.py) 的「HTML → 字段」解析逻辑，
//      但用 Node 内置正则重写（Averia 不引入 DOM 依赖）。
//   2. 网络传输**不**绕过 Cloudflare / 年龄门 / 验证码。JavLibrary 若返回
//      验证页，本 Provider 直接 fail closed（清晰报错、不生成假数据）。
//   3. 主机白名单 + HTTPS-only + 原始快照 SHA-256 + meta.json + 限速由调用方把握。
//   4. 输出 Averia 统一导入 canonical（见 docs/import/IMPORT_FORMAT.md，
//      权威形状参考 scripts/providers/javinfo/lib.mjs）。
//
// 注意：JavLibrary 内容以日文为主（LANG=ja），因此 actress / maker / label /
// genre 等名称按日文处理（name_ja），与 javinfo 的 hasJapanese 约定一致。

export const JAVLIBRARY_SOURCE = "javlibrary";
export const JAVLIBRARY_PROVIDER_VERSION = 1;
const ALLOWED_HOSTS = new Set(["javlibrary.com", "www.javlibrary.com"]);
const BASE_URL = "https://www.javlibrary.com";
const LANG = "ja";

// ──────────────────────────────────────────────────────────────
// HTML 工具（移植自 javdatabase/lib.mjs 的轻量正则解析，无 DOM 依赖）
// ──────────────────────────────────────────────────────────────

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["#39", "'"], ["nbsp", " "],
    ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["middot", "·"],
  ]);
  return String(value ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (full, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named.get(lower) ?? full;
  });
}

function stripTags(value) {
  return decodeHtmlEntities(String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttrs(raw) {
  const attrs = {};
  for (const match of String(raw ?? "").matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasJapanese(value) {
  return /[぀-ヿ一-鿿]/.test(String(value ?? "").trim());
}

function cleanUnknown(value) {
  const text = stripTags(value).trim();
  if (!text || /^(?:\?|unknown|n\/a|none|-)$/i.test(text)) return "";
  return text;
}

function fullDateOrBlank(value) {
  const text = cleanUnknown(value);
  const match = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  return match ? match[1] : text;
}

function intOrBlank(value) {
  const text = cleanUnknown(value);
  const match = /\d+/.exec(text);
  return match ? Number.parseInt(match[0], 10) : "";
}

function slugFromName(name) {
  const ascii = String(name ?? "").normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return `javlibrary-${crypto.createHash("sha1").update(String(name ?? "")).digest("hex").slice(0, 10)}`;
}

// 取某个 video_xxx 信息行所在的 <div id="video_xxx">...</div> 区块。
// JavLibrary 信息行均为单层 <div>（内容是一个 <table>，无嵌套 div），
// 因此非贪婪匹配到第一个 </div> 即为该行闭合，不会越界吞掉后续区块（如 previewthumbs）。
function blockOf(html, rowId) {
  const m = new RegExp(`<div[^>]*id=["']?${escapeRegex(rowId)}["']?[^>]*>([\\s\\S]*?)<\\/div>`, "i").exec(html);
  return m ? m[0] : "";
}

function rowText(block) {
  const m = /<td[^>]*class=["']?[^"']*text[^"']*["']?[^>]*>([\s\S]*?)<\/td>/i.exec(block);
  return m ? cleanUnknown(m[1]) : "";
}

function rowLinks(block) {
  const links = [];
  for (const m of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttrs(m[1]);
    const text = cleanUnknown(m[2]);
    if (text) links.push({ href: attrs.href ?? "", text });
  }
  return links;
}

function postTitle(html) {
  const m = /<h3\b[^>]*class=["']?[^"']*post-title[^"']*["']?[^>]*>([\s\S]*?)<\/h3>/i.exec(html)
    || /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(html);
  return m ? cleanUnknown(m[1]) : "";
}

function jacketSrc(html) {
  const m = /<img\b([^>]*id=["']?video_jacket_img["']?[^>]*)>/i.exec(html);
  if (!m) return "";
  const attrs = parseAttrs(m[1]);
  const src = attrs.src ?? "";
  return src.startsWith("//") ? `https:${src}` : src;
}

function previewThumbHrefs(html) {
  const block = /<div\b[^>]*class=["']?[^"']*previewthumbs[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? "";
  const hrefs = [];
  for (const m of block.matchAll(/<a\b([^>]*)>/gi)) {
    const href = parseAttrs(m[1]).href ?? "";
    if (href) hrefs.push(href.startsWith("//") ? `https:${href}` : href);
  }
  return hrefs;
}

function starIdFromHref(href) {
  let m = /\/star\/([a-z0-9]+)/i.exec(href);
  if (m) return m[1];
  m = /[?&]s=([a-z0-9]+)/i.exec(href);
  return m ? m[1] : "";
}

// ──────────────────────────────────────────────────────────────
// URL 规范化与白名单
// ──────────────────────────────────────────────────────────────

export function normalizeJavlibraryUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("JavLibrary Provider 只允许 HTTPS URL。");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`不允许访问的主机：${url.hostname}`);
  url.hash = "";
  return url.href;
}

export function buildJavlibraryUrl({ url, code } = {}) {
  if (url) return normalizeJavlibraryUrl(url);
  if (code) {
    const trimmed = String(code).trim();
    if (!trimmed) throw new Error("--code 不能为空。");
    return `${BASE_URL}/${LANG}/vl_searchbyid.php?keyword=${encodeURIComponent(trimmed)}`;
  }
  throw new Error("请提供 --url 或 --code。");
}

// ──────────────────────────────────────────────────────────────
// 纯解析：详情页 HTML → Averia canonical
// ──────────────────────────────────────────────────────────────

export function parseJavlibraryWork(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const url = normalizeJavlibraryUrl(sourceUrl);
  const rawNumber = cleanUnknown(rowText(blockOf(html, "video_id"))) || "";
  // 番号标准化：去全角横线、转大写、去非字母数字后插连字符（与 javinfo 同思路）
  const compact = rawNumber.toUpperCase().replace(/[‐‑‒–—―ー－]/g, "-").replace(/[^A-Z0-9]/g, "");
  const codeMatch = /^([A-Z]{2,12})(\d{2,7})$/.exec(compact);
  const code = codeMatch ? `${codeMatch[1]}-${codeMatch[2]}` : rawNumber;

  // 标题：剥除开头的「番号 - 」前缀
  const rawTitle = postTitle(html);
  const stripped = rawTitle.replace(new RegExp(`^${escapeRegex(rawNumber)}\\s*[-—―ー　]*\\s*`, "i"), "").trim();
  const title = stripped || rawTitle || "";

  const dateRaw = rowText(blockOf(html, "video_date"));
  const releaseDate = fullDateOrBlank(dateRaw);
  const duration = intOrBlank(rowText(blockOf(html, "video_length")));

  const directorBlock = blockOf(html, "video_director");
  const directorLinks = rowLinks(directorBlock);
  const directorName = directorLinks[0]?.text || rowText(directorBlock);

  const makerBlock = blockOf(html, "video_maker");
  const makerLinks = rowLinks(makerBlock);
  const makerName = makerLinks[0]?.text || rowText(makerBlock);

  const labelBlock = blockOf(html, "video_label");
  const labelLinks = rowLinks(labelBlock);
  const labelName = labelLinks[0]?.text || rowText(labelBlock);

  const seriesBlock = blockOf(html, "video_series");
  const seriesLinks = rowLinks(seriesBlock);
  const seriesName = seriesLinks[0]?.text || rowText(seriesBlock);

  const genreLinks = rowLinks(blockOf(html, "video_genres"));
  const genres = genreLinks.map((link) => ({
    name: link.text,
    ...(hasJapanese(link.text) ? { name_ja: link.text } : {}),
    slug: slugFromName(link.text),
  }));

  const castLinks = rowLinks(blockOf(html, "video_cast"));
  const actresses = [];
  const cast = [];
  for (const [position, link] of castLinks.entries()) {
    const starId = starIdFromHref(link.href);
    const sourceRecordId = starId ? `actress:${starId}` : undefined;
    const actress = {
      fetched_at: fetchedAt,
      primary_name: link.text,
      ...(hasJapanese(link.text) ? { name_ja: link.text } : { name_en: link.text }),
      status: "unknown",
      ...(sourceRecordId ? { source_record_id: sourceRecordId } : {}),
    };
    actresses.push(actress);
    cast.push({ name: link.text, position: position + 1, ...(sourceRecordId ? { source_record_id: sourceRecordId } : {}) });
  }

  const directors = directorName
    ? [{ name: directorName, ...(hasJapanese(directorName) ? { name_ja: directorName } : {}), position: 1 }]
    : [];

  const coverUrl = jacketSrc(html);
  const sampleImages = previewThumbHrefs(html);

  const work = {
    source_record_id: `work:${code}`,
    source_url: url,
    fetched_at: fetchedAt,
    code,
    title,
    ...(hasJapanese(title) ? { title_ja: title } : {}),
    ...(releaseDate ? { release_date: releaseDate } : {}),
    ...(duration !== "" ? { duration_min: duration } : {}),
    ...(makerName ? { maker: { name: makerName, ...(hasJapanese(makerName) ? { name_ja: makerName } : {}) } } : {}),
    ...(labelName ? { label: { name: labelName, ...(hasJapanese(labelName) ? { name_ja: labelName } : {}) } } : {}),
    ...(seriesName ? { series: { name: seriesName, ...(hasJapanese(seriesName) ? { name_ja: seriesName } : {}) } } : {}),
    genres,
    directors,
    cast,
    ...(coverUrl ? { cover_url: coverUrl } : {}),
    source_notes: [
      "JavLibrary 为英文可达的日文元数据补充源（role=supplemental）",
      "名称按日文原文保留（name_ja）；跨语言归并由 V0.8 entity_aliases / name_en 后续裁决",
      sampleImages.length ? `样本图 ${sampleImages.length} 张（仅记录 URL，Averia 不下载媒体）` : "",
    ].filter(Boolean).join("；"),
  };

  return {
    canonical: {
      schema_version: 1,
      source: { name: JAVLIBRARY_SOURCE, fetched_at: fetchedAt, language: "ja", role: "supplemental" },
      actresses,
      works: [work],
    },
    meta: {
      provider_version: JAVLIBRARY_PROVIDER_VERSION,
      page_type: "work",
      source_url: url,
      source_record_id: work.source_record_id,
      dvd_id: code,
      director: directorName,
      genre_count: genres.length,
      cast_count: cast.length,
      sample_image_count: sampleImages.length,
      note: "Averia 不实现 Cloudflare / 年龄门 / 验证码绕过；被拦截时 Provider 直接报错（fail closed）。",
    },
  };
}

// 从搜索结果页解析出详情页 URL（移植自 OpenAver _extract_detail_url，简化版）
export function resolveDetailUrlFromSearchHtml(html, code, baseLangUrl = `${BASE_URL}/${LANG}`) {
  const block = /<table\b[^>]*class=["']?[^"']*videotext[^"']*["']?[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1]
    ?? html;
  const links = [...block.matchAll(/<a\b([^>]*)>/gi)].map((m) => ({ href: parseAttrs(m[1]).href ?? "", text: cleanUnknown(m[1] ? m[1] : "") }));
  // 搜索结果页链接文本即番号，精确匹配
  const numUpper = code.toUpperCase();
  for (const link of links) {
    const text = cleanUnknown(link.text).toUpperCase();
    if (numUpper && (text.includes(numUpper))) {
      return normalizeHref(link.href, baseLangUrl);
    }
  }
  return "";
}

function normalizeHref(href, baseLangUrl) {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("./")) return `${baseLangUrl.replace(/\/$/, "")}/${href.slice(2)}`;
  if (href.startsWith("/")) return `${BASE_URL}${href}`;
  return `${baseLangUrl.replace(/\/$/, "")}/${href}`;
}

// ──────────────────────────────────────────────────────────────
// 合规网络抓取（无反爬绕过）
// ──────────────────────────────────────────────────────────────

function isCloudflareChallenge(html) {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? titleMatch[1].toLocaleLowerCase("en") : "";
  if (title.includes("just a moment") || title.includes("請稍候") || title.includes("checking your browser")) return true;
  if (html.includes('name="cf-turnstile-response"') || html.includes('id="challenge-form"')) return true;
  return false;
}

export async function fetchJavlibraryHtml(sourceUrl, options = {}) {
  const url = normalizeJavlibraryUrl(sourceUrl);
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja-JP,ja;q=0.9,en;q=0.8",
        "user-agent": options.userAgent ?? "Averia/0.8 metadata-provider (+https://github.com/MagicBude/Averia)",
      },
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.name || "NETWORK";
    throw new Error(`JavLibrary 网络请求失败（${cause}）：请检查当前网络、DNS 或来源站访问状态；Provider 未写入正式数据。`);
  }
  const finalUrl = normalizeJavlibraryUrl(response.url || url);
  if (!response.ok) throw new Error(`JavLibrary 请求失败：HTTP ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLocaleLowerCase("en").includes("text/html")) {
    throw new Error(`JavLibrary 返回内容不是 HTML：${contentType}`);
  }
  const html = await response.text();
  if (isCloudflareChallenge(html)) {
    throw new Error(
      "JavLibrary 返回 Cloudflare 验证页。Averia 不实现反爬 / 验证码绕过；"
      + "请用 --file 提供已保存的详情页 HTML，或待通过验证后由合规方式抓取。Provider 未写入正式数据。",
    );
  }
  return { html, finalUrl, status: response.status, contentType };
}

// 按番号搜索 → 解析详情 URL → 抓取详情页（两步；搜索页同样可能被 CF 拦，届时 fail closed）
export async function fetchJavlibraryWorkById(code, options = {}) {
  const searchUrl = buildJavlibraryUrl({ code });
  const searched = await fetchJavlibraryHtml(searchUrl, options);
  const detailUrl = resolveDetailUrlFromSearchHtml(searched.html, code);
  if (!detailUrl) throw new Error(`JavLibrary 搜索未找到番号 ${code} 的详情页（可能站内确实没有，或搜索页被拦截）。`);
  const detail = await fetchJavlibraryHtml(detailUrl, options);
  return { html: detail.html, finalUrl: detail.finalUrl };
}
