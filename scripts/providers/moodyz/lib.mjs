import crypto from "node:crypto";
import { fetchTextWithFallback } from "../../lib/http-transport.mjs";

export const MOODYZ_SOURCE = "moodyz-official";
export const MOODYZ_PROVIDER_VERSION = 7;
const ALLOWED_HOSTS = new Set(["moodyz.com", "www.moodyz.com"]);
const BASE_URL = "https://moodyz.com/";

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["#39", "'"], ["nbsp", " "],
    ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["middot", "·"], ["yen", "¥"],
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

function parseAttributes(value) {
  const attrs = {};
  for (const match of String(value ?? "").matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function encodeLinkToken(link) {
  return ` __AVERIA_LINK_${Buffer.from(JSON.stringify(link), "utf8").toString("base64url")}__ `;
}

function decodeLinkToken(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { href: "", text: "" };
  }
}

function tokenRegex() {
  return /__AVERIA_LINK_([A-Za-z0-9_-]+)__/g;
}

export function htmlToAnnotatedText(html) {
  let value = String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");

  value = value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, rawAttrs, inner) => {
    const attrs = parseAttributes(rawAttrs);
    return encodeLinkToken({ href: attrs.href ?? "", text: stripTags(inner) });
  });

  value = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|section|article|dt|dd|ul|ol|table)>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

export function plainAnnotatedText(value) {
  return String(value ?? "")
    .replace(tokenRegex(), (_full, payload) => decodeLinkToken(payload).text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function linksFromText(value, baseUrl = "") {
  const links = [];
  for (const match of String(value ?? "").matchAll(tokenRegex())) {
    const decoded = decodeLinkToken(match[1]);
    let href = decoded.href ?? "";
    if (href && baseUrl) {
      try { href = new URL(href, baseUrl).href; } catch { /* keep original */ }
    }
    links.push({ href, text: String(decoded.text ?? "").trim() });
  }
  return links;
}

function indexOfExact(text, marker, from = 0) {
  return String(text).indexOf(String(marker), from);
}

export function sectionBetween(text, startMarker, endMarker) {
  const start = indexOfExact(text, startMarker);
  if (start < 0) return "";
  const contentStart = start + startMarker.length;
  const end = endMarker ? indexOfExact(text, endMarker, contentStart) : -1;
  return text.slice(contentStart, end >= 0 ? end : undefined).trim();
}

function firstMetaContent(html, targetName) {
  for (const match of String(html ?? "").matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key === targetName.toLowerCase() && attrs.content) return attrs.content.trim();
  }
  return "";
}


function absoluteImageUrl(value, baseUrl) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { return new URL(raw, baseUrl).href; } catch { return ""; }
}

function imageCandidates(html, baseUrl) {
  const candidates = [];
  for (const match of String(html ?? "").matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    for (const key of ["src", "data-src", "data-original", "data-lazy-src"]) {
      const url = absoluteImageUrl(attrs[key], baseUrl);
      if (url) candidates.push({ url, source: `img:${key}` });
    }
    const srcset = attrs.srcset || attrs["data-srcset"] || "";
    if (srcset) {
      for (const item of srcset.split(",")) {
        const url = absoluteImageUrl(item.trim().split(/\s+/)[0], baseUrl);
        if (url) candidates.push({ url, source: "img:srcset" });
      }
    }
  }

  const ogImage = absoluteImageUrl(firstMetaContent(html, "og:image"), baseUrl);
  if (ogImage) candidates.push({ url: ogImage, source: "og:image" });
  return candidates;
}

function imageScore(url, kind) {
  const value = String(url ?? "").toLowerCase();
  let score = 0;
  if (/\.(?:jpe?g|webp|png)(?:$|\?)/i.test(value)) score += 10;
  if (value.includes("/site_design/") || value.includes("logo_image") || /(?:^|[\/_-])logo(?:[\/_-]|\.)/.test(value)) score -= 200;
  if (kind === "work") {
    if (value.includes("/content/")) score += 150;
    if (value.includes("/works/")) score += 60;
  } else if (kind === "actress") {
    if (value.includes("/actress_main/")) score += 180;
    if (value.includes("/actress/")) score += 80;
  }
  return score;
}

export function selectMoodyzImage(html, baseUrl, kind) {
  const candidates = imageCandidates(html, baseUrl);
  const ranked = candidates
    .map((item, index) => ({ ...item, score: imageScore(item.url, kind), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];
  if (!best || best.score <= 0) return { url: "", source: "" };
  return { url: best.url, source: best.source };
}

function headingCandidates(html) {
  const result = [];
  for (const match of String(html ?? "").matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripTags(match[2]);
    if (text) result.push({ level: Number(match[1]), text });
  }
  return result;
}

function documentTitle(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html ?? ""));
  return match ? stripTags(match[1]) : "";
}

function cleanSiteTitle(value) {
  return String(value ?? "")
    .replace(/\s*[|｜]\s*人気知名度NO\.1！[\s\S]*$/i, "")
    .replace(/\s*[|｜]\s*MOODYZ(?:\s*\([^)]*\))?.*$/i, "")
    .trim();
}

function pagePrimaryHeading(html, excluded = []) {
  const excludedSet = new Set(excluded.map((value) => String(value).trim()));
  const headings = headingCandidates(html);
  const h1 = headings.find((item) => item.level === 1 && !excludedSet.has(item.text));
  if (h1) return { text: h1.text, source: "h1" };
  const h2 = headings.find((item) => item.level === 2 && !excludedSet.has(item.text));
  if (h2) return { text: h2.text, source: "h2" };
  const ogTitle = cleanSiteTitle(firstMetaContent(html, "og:title"));
  if (ogTitle && !excludedSet.has(ogTitle)) return { text: ogTitle, source: "og:title" };
  const title = cleanSiteTitle(documentTitle(html));
  if (title && !excludedSet.has(title)) return { text: title, source: "title" };
  return { text: "", source: "" };
}

function clean(value) {
  return plainAnnotatedText(value).replace(/^[-–—:\s]+|[-–—:\s]+$/g, "").trim();
}

function sectionValue(text, startMarker, endMarker) {
  return clean(sectionBetween(text, startMarker, endMarker));
}

function fullDateOrBlank(value) {
  const text = clean(value);
  let match = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(text);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  match = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  return "";
}

function intOrBlank(value) {
  const match = /\d+/.exec(clean(value));
  return match ? Number.parseInt(match[0], 10) : "";
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function slugFromPath(url, marker) {
  try {
    const pieces = new URL(url).pathname.split("/").filter(Boolean);
    const i = pieces.indexOf(marker);
    return i >= 0 ? pieces[i + 1] ?? "" : "";
  } catch {
    return "";
  }
}

function normalizeOfficialCode(value) {
  const raw = clean(value).replace(/^DVD\s*/i, "").trim().toUpperCase();
  const match = /^([A-Z]+)[-_ ]?(\d+)$/.exec(raw);
  return match ? `${match[1]}-${match[2]}` : raw;
}

function genreSlug(name, href) {
  if (href) {
    try {
      const pieces = new URL(href).pathname.split("/").filter(Boolean);
      const i = pieces.findIndex((part) => part === "genre" || part === "genres");
      if (i >= 0 && pieces[i + 1]) return `moodyz-${pieces[i + 1]}`;
    } catch { /* fall through */ }
  }
  return `moodyz-${crypto.createHash("sha1").update(String(name ?? "")).digest("hex").slice(0, 10)}`;
}

function linksInSection(text, startMarker, endMarker, baseUrl, predicate = () => true) {
  return linksFromText(sectionBetween(text, startMarker, endMarker), baseUrl).filter((link) => link.text && predicate(link));
}

function normalizeHostUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("MOODYZ Provider 只允许 HTTPS URL。");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`不允许访问的主机：${url.hostname}`);
  url.hash = "";
  return url.href;
}

export function normalizeMoodyzUrl(input) {
  return normalizeHostUrl(input);
}

export function classifyMoodyzUrl(input) {
  const url = new URL(normalizeMoodyzUrl(input));
  if (/^\/works\/detail\/[^/]+\/?$/i.test(url.pathname)) return "work";
  if (/^\/actress\/detail\/[^/]+\/?$/i.test(url.pathname)) return "actress";
  throw new Error("当前 V0.4 只支持 MOODYZ 的 /works/detail/<id> 和 /actress/detail/<id> 单页。");
}

export function buildMoodyzUrl({ url, code, actressId } = {}) {
  if (url) return normalizeMoodyzUrl(url);
  if (code) {
    const compact = String(code).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
    if (!compact) throw new Error("--code 不能为空。");
    return `${BASE_URL}works/detail/${compact}`;
  }
  if (actressId) {
    const id = String(actressId).trim();
    if (!/^\d+$/.test(id)) throw new Error("--actress-id 必须是 MOODYZ 女优页中的数字 ID。");
    return `${BASE_URL}actress/detail/${id}`;
  }
  throw new Error("请提供 --url、--code 或 --actress-id。");
}

export function parseMoodyzWork(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const url = normalizeMoodyzUrl(sourceUrl);
  const text = htmlToAnnotatedText(html);
  const titleInfo = pagePrimaryHeading(html, ["RECOMMEND", "おすすめ作品", "プロフィール", "WORKS"]);
  const title = titleInfo.text.trim();
  if (!title) throw new Error("无法从 MOODYZ 作品页解析日文标题：未找到有效标题元素或页面元数据。");

  // 页面顶部导航也含“発売日 / シリーズ / レーベル / ジャンル”等文字，
  // 所以不能简单取整页第一次出现的位置。这里按作品详情字段的固定顺序，
  // 从标题之后依次定位元数据区，避免误读导航栏。
  const titlePos = text.indexOf(title);
  const detailStart = titlePos >= 0 ? titlePos + title.length : 0;
  const actressPos = text.indexOf("女優", detailStart);
  const releasePos = actressPos >= 0 ? text.indexOf("発売日", actressPos + 2) : -1;
  const seriesPos = releasePos >= 0 ? text.indexOf("シリーズ", releasePos + 3) : -1;
  const labelPos = seriesPos >= 0 ? text.indexOf("レーベル", seriesPos + 4) : -1;
  const genrePos = labelPos >= 0 ? text.indexOf("ジャンル", labelPos + 4) : -1;
  const directorPos = genrePos >= 0 ? text.indexOf("監督", genrePos + 4) : -1;
  const codePos = directorPos >= 0 ? text.indexOf("品番", directorPos + 2) : -1;
  const durationPos = codePos >= 0 ? text.indexOf("収録時間", codePos + 2) : -1;
  const pricePos = durationPos >= 0 ? text.indexOf("価格", durationPos + 4) : -1;
  if ([actressPos, releasePos, seriesPos, labelPos, genrePos, directorPos, codePos, durationPos].some((pos) => pos < 0)) {
    throw new Error("MOODYZ 作品详情字段结构与当前 Parser 不一致，已停止生成 canonical 数据。");
  }

  const between = (startPos, marker, endPos) => text.slice(startPos + marker.length, endPos >= 0 ? endPos : undefined).trim();
  const actressSection = between(actressPos, "女優", releasePos);
  const releaseSection = between(releasePos, "発売日", seriesPos);
  const seriesSection = between(seriesPos, "シリーズ", labelPos);
  const labelSection = between(labelPos, "レーベル", genrePos);
  const genreSection = between(genrePos, "ジャンル", directorPos);
  const directorSection = between(directorPos, "監督", codePos);
  const codeSection = between(codePos, "品番", durationPos);
  const durationSection = between(durationPos, "収録時間", pricePos);

  const code = normalizeOfficialCode(codeSection);
  if (!code) throw new Error("无法从 MOODYZ 作品页解析品番。");
  const releaseDate = fullDateOrBlank(releaseSection);
  const director = clean(directorSection);
  const duration = intOrBlank(durationSection);

  const seriesName = clean(seriesSection);
  const labelLinks = linksFromText(labelSection, url).filter((link) => link.text);
  const labelName = clean(labelLinks[0]?.text || labelSection);
  const genreLinks = linksFromText(genreSection, url).filter((link) => link.text);
  const genres = uniqueStrings(genreLinks.map((link) => link.text)).map((name) => {
    const link = genreLinks.find((item) => item.text === name);
    return { name, name_ja: name, slug: genreSlug(name, link?.href) };
  });

  const actressLinks = linksFromText(actressSection, url).filter((link) => {
    try { return link.text && /^\/actress\/detail\/[^/]+\/?$/i.test(new URL(link.href).pathname); } catch { return false; }
  });
  const actresses = [];
  const cast = [];
  for (const [position, link] of actressLinks.entries()) {
    const actressId = slugFromPath(link.href, "detail");
    const sourceRecordId = actressId ? `actress:${actressId}` : "";
    actresses.push({
      source_record_id: sourceRecordId,
      source_url: link.href,
      fetched_at: fetchedAt,
      primary_name: link.text,
      name_ja: link.text,
      status: "unknown",
    });
    cast.push({ source_record_id: sourceRecordId, name: link.text, position: position + 1 });
  }

  const workId = slugFromPath(url, "detail") || code.replace(/[^A-Z0-9]/g, "");
  const cover = selectMoodyzImage(html, url, "work");
  const work = {
    source_record_id: `work:${workId}`,
    source_url: url,
    fetched_at: fetchedAt,
    code,
    title,
    title_ja: title,
    release_date: releaseDate,
    duration_min: duration,
    maker: { name: "MOODYZ", name_ja: "MOODYZ", website_url: BASE_URL },
    label: labelName ? { name: labelName, name_ja: labelName } : undefined,
    series: seriesName ? { name: seriesName, name_ja: seriesName } : undefined,
    genres,
    directors: director ? [{ name: director, name_ja: director, position: 1 }] : [],
    cast,
    cover_url: cover.url,
    source_notes: "",
  };

  return {
    canonical: {
      schema_version: 1,
      source: { name: MOODYZ_SOURCE, fetched_at: fetchedAt, language: "ja", role: "authoritative" },
      actresses,
      works: [work],
    },
    meta: {
      provider_version: MOODYZ_PROVIDER_VERSION,
      page_type: "work",
      source_url: url,
      source_record_id: work.source_record_id,
      dvd_id: code,
      director,
      title_source: titleInfo.source,
      cover_source: cover.source,
      source_language: "ja",
      source_role: "authoritative",
    },
  };
}

export function parseMoodyzActress(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const url = normalizeMoodyzUrl(sourceUrl);
  const text = htmlToAnnotatedText(html);
  const nameInfo = pagePrimaryHeading(html, ["プロフィール", "WORKS", "商品一覧"]);
  const nameJa = nameInfo.text.trim();
  if (!nameJa) throw new Error("无法从 MOODYZ 女优页解析姓名：未找到有效标题元素或页面元数据。");

  const actressId = slugFromPath(url, "detail");
  if (!actressId) throw new Error("无法从 MOODYZ 女优页解析来源 ID。");

  let nameEn = "";
  const profilePos = text.indexOf("プロフィール");
  if (profilePos >= 0) {
    const before = plainAnnotatedText(text.slice(0, profilePos));
    const namePos = before.lastIndexOf(nameJa);
    if (namePos >= 0) {
      const candidate = before.slice(namePos + nameJa.length).trim();
      const roman = /([A-Z][A-Z\s.'-]{2,})$/.exec(candidate);
      if (roman) nameEn = roman[1].replace(/\s+/g, " ").trim();
    }
  }

  const height = intOrBlank(sectionValue(text, "身長", "3サイズ"));
  const measurements = sectionValue(text, "3サイズ", "趣味");
  let bust = "", waist = "", hip = "", cup = "";
  const m = /B\s*(\d+)\s*cm(?:\s*\(([A-Z]+)\))?[\s\S]*?W\s*(\d+)\s*cm[\s\S]*?H\s*(\d+)\s*cm/i.exec(measurements);
  if (m) {
    bust = Number.parseInt(m[1], 10);
    cup = (m[2] ?? "").toUpperCase();
    waist = Number.parseInt(m[3], 10);
    hip = Number.parseInt(m[4], 10);
  }

  const profileImage = selectMoodyzImage(html, url, "actress");
  const actress = {
    source_record_id: `actress:${actressId}`,
    source_url: url,
    fetched_at: fetchedAt,
    primary_name: nameJa,
    name_ja: nameJa,
    name_en: nameEn,
    height_cm: height,
    bust_cm: bust,
    waist_cm: waist,
    hip_cm: hip,
    cup,
    status: "unknown",
    profile_image_url: profileImage.url,
    aliases: nameEn ? [{ value: nameEn, type: "romanized", language: "en" }] : [],
  };

  const worksStart = text.indexOf("WORKS");
  const worksText = worksStart >= 0 ? text.slice(worksStart) : "";
  const discoveredWorks = uniqueStrings(linksFromText(worksText, url)
    .filter((link) => {
      try { return /^\/works\/detail\/[^/]+\/?$/i.test(new URL(link.href).pathname); } catch { return false; }
    })
    .map((link) => link.href));

  return {
    canonical: {
      schema_version: 1,
      source: { name: MOODYZ_SOURCE, fetched_at: fetchedAt, language: "ja", role: "authoritative" },
      actresses: [actress],
      works: [],
    },
    meta: {
      provider_version: MOODYZ_PROVIDER_VERSION,
      page_type: "actress",
      source_url: url,
      source_record_id: actress.source_record_id,
      discovered_work_urls: discoveredWorks,
      title_source: nameInfo.source,
      profile_image_source: profileImage.source,
      source_language: "ja",
      source_role: "authoritative",
    },
  };
}

export function parseMoodyzPage(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const type = classifyMoodyzUrl(sourceUrl);
  return type === "work" ? parseMoodyzWork(html, sourceUrl, fetchedAt) : parseMoodyzActress(html, sourceUrl, fetchedAt);
}

export async function fetchMoodyzHtml(sourceUrl, options = {}) {
  const url = normalizeMoodyzUrl(sourceUrl);
  const timeoutMs = Number(options.timeoutMs ?? 20000);
  const headers = {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "accept-language": "ja-JP,ja;q=0.9,en;q=0.5",
    "user-agent": options.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Averia/0.4.7",
  };

  let fetched;
  try {
    fetched = await fetchTextWithFallback(url, {
      timeoutMs,
      headers,
      userAgent: headers["user-agent"],
      proxyUrl: options.proxyUrl ?? "",
      transport: options.transport ?? "auto",
      preferCurl: Boolean(options.preferCurl),
      fetchImpl: options.fetchImpl,
      nodeImpl: options.nodeImpl,
      curlImpl: options.curlImpl,
      spawn: options.spawn,
      platform: options.platform,
      tmpRoot: options.tmpRoot,
      maxAttempts: options.maxAttempts ?? 3,
      retryDelayMs: options.retryDelayMs ?? 750,
      sleepImpl: options.sleepImpl,
      onRetry: options.onRetry,
    });
  } catch (error) {
    throw new Error(`MOODYZ 网络请求失败：${error.message}；Provider 未写入正式数据。`);
  }

  const finalUrl = normalizeMoodyzUrl(fetched.finalUrl || url);
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`MOODYZ 请求失败：HTTP ${fetched.status}（已尝试 ${fetched.attempts ?? 1} 次）`);
  const contentType = fetched.contentType ?? "";
  if (contentType && !contentType.toLowerCase().includes("text/html")) throw new Error(`返回内容不是 HTML：${contentType}`);
  return {
    html: fetched.text,
    finalUrl,
    status: fetched.status,
    contentType,
    transport: fetched.transport,
    fallbackFrom: fetched.fallbackFrom ?? "",
    attempts: fetched.attempts ?? 1,
  };
}
