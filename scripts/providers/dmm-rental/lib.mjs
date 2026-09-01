import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetchTextWithFallback } from "../../lib/http-transport.mjs";

export const DMM_RENTAL_SOURCE = "dmm-rental";
export const DMM_RENTAL_PROVIDER_VERSION = 3;
const ALLOWED_HOSTS = new Set(["www.dmm.co.jp", "dmm.co.jp"]);
const BASE_URL = "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=";

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
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return { href: "", text: "" }; }
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

function plainAnnotatedText(value) {
  return String(value ?? "")
    .replace(tokenRegex(), (_full, payload) => decodeLinkToken(payload).text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function linksFromText(value, baseUrl = "") {
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

function firstMetaContent(html, targetName) {
  for (const match of String(html ?? "").matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key === targetName.toLowerCase() && attrs.content) return attrs.content.trim();
  }
  return "";
}

function documentTitle(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html ?? ""));
  return match ? stripTags(match[1]) : "";
}

function headingCandidates(html) {
  const result = [];
  for (const match of String(html ?? "").matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripTags(match[2]);
    if (text) result.push({ level: Number(match[1]), text });
  }
  return result;
}

function cleanDmmTitle(value) {
  return String(value ?? "")
    .replace(/\s*[|｜-]\s*(?:FANZA|DMM\.com)[\s\S]*$/i, "")
    .replace(/^FANZA\s*/i, "")
    .trim();
}

function pageTitle(html) {
  const excluded = new Set(["単品レンタル", "レンタルトップ", "商品詳細", "FANZA", "DMM.com"]);
  const headings = headingCandidates(html);
  for (const level of [1, 2, 3]) {
    const candidate = headings.find((item) => item.level === level && !excluded.has(item.text) && item.text.length >= 4);
    if (candidate) return { text: candidate.text, source: `h${level}` };
  }
  const og = cleanDmmTitle(firstMetaContent(html, "og:title"));
  if (og && !excluded.has(og)) return { text: og, source: "og:title" };
  const title = cleanDmmTitle(documentTitle(html));
  return title && !excluded.has(title) ? { text: title, source: "title" } : { text: "", source: "" };
}

const FIELD_LABELS = ["貸出開始日", "収録時間", "出演者", "監督", "シリーズ", "メーカー", "レーベル", "ジャンル", "品番", "平均評価"];

function fieldSection(text, label) {
  const start = text.indexOf(label);
  if (start < 0) return "";
  let contentStart = start + label.length;
  while (/[:：\s]/.test(text[contentStart] ?? "")) contentStart += 1;
  let end = text.length;
  for (const other of FIELD_LABELS) {
    if (other === label) continue;
    const pos = text.indexOf(other, contentStart);
    if (pos >= 0 && pos < end) end = pos;
  }
  return text.slice(contentStart, end).trim();
}

function clean(value) {
  return plainAnnotatedText(value).replace(/^[-–—:：\s]+|[-–—:：\s]+$/g, "").trim();
}

function fullDateOrBlank(value) {
  const text = clean(value);
  let match = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(text);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  match = /\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/.exec(text);
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

function splitPlainNames(value) {
  return uniqueStrings(clean(value).split(/[、,，／/]+|\s{2,}/).map((item) => item.trim()).filter(Boolean));
}

function absoluteUrl(value, baseUrl) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { return new URL(raw, baseUrl).href; } catch { return ""; }
}

function imageCandidates(html, baseUrl) {
  const result = [];
  for (const match of String(html ?? "").matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    for (const key of ["src", "data-src", "data-original", "data-lazy-src"]) {
      const url = absoluteUrl(attrs[key], baseUrl);
      if (url) result.push({ url, source: `img:${key}` });
    }
  }
  const og = absoluteUrl(firstMetaContent(html, "og:image"), baseUrl);
  if (og) result.push({ url: og, source: "og:image" });
  return result;
}

function coverScore(url, cid) {
  const lower = String(url ?? "").toLowerCase();
  const cidCore = String(cid ?? "").toLowerCase().replace(/^\d+(?=[a-z])/, "");
  let score = 0;
  if (/\.(?:jpe?g|webp|png)(?:$|\?)/i.test(lower)) score += 10;
  if (lower.includes("pics.dmm.co.jp")) score += 120;
  if (cidCore && lower.includes(cidCore)) score += 120;
  if (/(?:pl|ps)\.(?:jpe?g|webp)(?:$|\?)/i.test(lower)) score += 70;
  if (/logo|banner|icon|bnr|sprite/i.test(lower)) score -= 250;
  if (/sample|cap\d|jp-\d/i.test(lower)) score -= 40;
  return score;
}

export function selectDmmRentalCover(html, baseUrl, cid) {
  const ranked = imageCandidates(html, baseUrl)
    .map((item, index) => ({ ...item, score: coverScore(item.url, cid), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];
  if (!best || best.score <= 0) return { url: "", source: "" };
  return { url: best.url, source: best.source };
}

export function extractDmmCid(input) {
  try {
    const url = new URL(input);
    const match = /(?:^|\/)cid=([^/]+)/i.exec(url.pathname);
    return decodeURIComponent(match?.[1] ?? "").trim();
  } catch {
    return "";
  }
}

export function deriveCatalogCodeFromDmmCid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const stripped = raw.replace(/^\d+(?=[a-z])/, "");
  const match = /^([a-z]{2,10})0*(\d{1,7})$/.exec(stripped);
  if (!match) return "";
  const number = String(Number.parseInt(match[2], 10));
  if (!number || number === "NaN") return "";
  return `${match[1].toUpperCase()}-${number}`;
}

function normalizeCatalogOverride(value) {
  const raw = String(value ?? "").normalize("NFKC").trim().toUpperCase();
  const match = /^([A-Z]{2,10})[-_ ]?(\d{1,7})$/.exec(raw);
  return match ? `${match[1]}-${Number.parseInt(match[2], 10)}` : raw;
}

function idFromLink(href, kind) {
  const raw = String(href ?? "");
  const patterns = kind === "actress"
    ? [/article=actress\/id=(\d+)/i, /actress(?:_id)?=(\d+)/i, /\/actress\/[^/]*?(\d{3,})/i]
    : [];
  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (match) return match[1];
  }
  return "";
}

function entitiesFromField(section, baseUrl, kind) {
  const links = linksFromText(section, baseUrl).filter((link) => link.text);
  if (links.length) {
    return links.map((link) => ({ name: link.text, href: link.href, id: idFromLink(link.href, kind) }));
  }
  return splitPlainNames(section).map((name) => ({ name, href: "", id: "" }));
}

function singleEntity(section, baseUrl) {
  const entities = entitiesFromField(section, baseUrl, "generic");
  return entities[0] ?? { name: "", href: "", id: "" };
}

function looksLikeAgeGate(html) {
  const text = stripTags(html);
  return /年齢認証|18歳未満|18歳以上ですか|成人向け/.test(text) && !/貸出開始日|収録時間|品番/.test(text);
}

export function isDmmAgeGate(html) {
  return looksLikeAgeGate(html);
}

function normalizedComparableDetailUrl(input) {
  const normalized = normalizeDmmRentalUrl(input);
  const url = new URL(normalized);
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

export function extractDmmAgeDeclarationUrl(html, requestedUrl) {
  const requested = normalizeDmmRentalUrl(requestedUrl);
  const expected = normalizedComparableDetailUrl(requested);

  for (const match of String(html ?? "").matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const href = String(attrs.href ?? "").trim();
    if (!href || !/\/age_check\/=\/declared=yes\//i.test(href)) continue;

    let url;
    try { url = new URL(href, "https://www.dmm.co.jp/"); } catch { continue; }
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) continue;
    if (!/^\/age_check\/=\/declared=yes\/?$/i.test(url.pathname)) continue;

    const rurl = url.searchParams.get("rurl") ?? "";
    if (!rurl) continue;
    try {
      if (normalizedComparableDetailUrl(rurl) !== expected) continue;
    } catch {
      continue;
    }
    return url.href;
  }
  return "";
}

function normalizeHostUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("DMM Rental Provider 只允许 HTTPS URL。");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`不允许访问的主机：${url.hostname}`);
  if (!/^\/rental\/ppr\/-\/detail\/=\/cid=[^/]+\/?$/i.test(url.pathname)) {
    throw new Error("DMM Rental Provider 当前只支持公开的单品宅配 Rental 详情页。");
  }
  url.hash = "";
  return url.href;
}

export function normalizeDmmRentalUrl(input) {
  return normalizeHostUrl(input);
}

export function buildDmmRentalUrl({ url = "", cid = "" } = {}) {
  if (url) return normalizeDmmRentalUrl(url);
  const rawCid = String(cid ?? "").trim();
  if (!/^[a-z0-9_-]+$/i.test(rawCid)) throw new Error("请提供有效的 --cid，或使用 --url 指定 DMM Rental 详情页。");
  return normalizeDmmRentalUrl(`${BASE_URL}${encodeURIComponent(rawCid)}/`);
}

export async function fetchDmmRentalHtml(url, options = {}) {
  const requestedUrl = normalizeDmmRentalUrl(url);
  const requestOptions = {
    ...options,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ja-JP,ja;q=0.9,en;q=0.5",
      "user-agent": options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36 Averia/0.6.2",
      ...(options.headers ?? {}),
    },
  };
  const fetched = await fetchTextWithFallback(requestedUrl, requestOptions);
  if (fetched.status >= 400) throw new Error(`DMM Rental 请求失败：HTTP ${fetched.status}`);
  if (!looksLikeAgeGate(fetched.text)) {
    return {
      ...fetched,
      html: fetched.text,
      ageGateDetected: false,
      ageGateDeclared: false,
      ageGateHtml: "",
    };
  }

  const declarationUrl = extractDmmAgeDeclarationUrl(fetched.text, requestedUrl);
  if (!declarationUrl) {
    return {
      ...fetched,
      html: fetched.text,
      ageGateDetected: true,
      ageGateDeclared: false,
      ageGateRequired: true,
      ageGateHtml: fetched.text,
      ageDeclarationUrl: "",
    };
  }

  // 不替用户自动声明年龄。只有调用方明确传入 adultConfirmed=true 时，
  // 才访问 DMM 自己提供的 declared=yes URL，并用临时 Cookie Jar 跟随重定向。
  if (!options.adultConfirmed) {
    return {
      ...fetched,
      html: fetched.text,
      ageGateDetected: true,
      ageGateDeclared: false,
      ageGateRequired: true,
      ageGateHtml: fetched.text,
      ageDeclarationUrl: declarationUrl,
    };
  }

  if (String(options.transport ?? "auto").toLowerCase() === "node") {
    const error = new Error("DMM 年龄确认会话需要 Cookie；显式 --transport node 不支持该流程，请使用 auto / curl，或在浏览器保存详情页后用 --file。");
    error.code = "DMM_AGE_GATE_REQUIRES_COOKIE_SESSION";
    throw error;
  }

  const sessionDir = fs.mkdtempSync(path.join(options.tmpRoot ?? os.tmpdir(), "averia-dmm-age-"));
  const cookieJar = path.join(sessionDir, "cookies.txt");
  try {
    // DMM 的 declared=yes 端点在真实环境中可能返回 Location: http://www.dmm.co.jp/...。
    // Averia 不允许为了跟随该跳转而放开明文 HTTP：这里只接收声明响应并保存
    // Set-Cookie，不跟随 Location；随后主动以 HTTPS 重新请求原始详情页。
    const declared = await fetchTextWithFallback(declarationUrl, {
      ...requestOptions,
      transport: "curl",
      preferCurl: true,
      cookieJar,
      followRedirects: false,
    });
    if (declared.status >= 400) throw new Error(`DMM 年龄声明请求失败：HTTP ${declared.status}`);

    const detail = await fetchTextWithFallback(requestedUrl, {
      ...requestOptions,
      transport: "curl",
      preferCurl: true,
      cookieJar,
      followRedirects: true,
    });
    if (detail.status >= 400) throw new Error(`DMM 年龄确认后详情页请求失败：HTTP ${detail.status}`);

    const stillAgeGate = looksLikeAgeGate(detail.text);
    const finalMatchesRequested = (() => {
      try { return normalizedComparableDetailUrl(detail.finalUrl) === normalizedComparableDetailUrl(requestedUrl); } catch { return false; }
    })();
    if (stillAgeGate || !finalMatchesRequested) {
      const error = new Error("DMM 年龄确认完成后仍未返回目标 Rental 详情页；Averia 不继续尝试其它绕过方式，请改用浏览器保存公开详情页后通过 --file 解析。");
      error.code = "DMM_AGE_GATE_NOT_RESOLVED";
      throw error;
    }

    return {
      ...detail,
      html: detail.text,
      attempts: Number(fetched.attempts ?? 1) + Number(declared.attempts ?? 1) + Number(detail.attempts ?? 1),
      ageGateDetected: true,
      ageGateDeclared: true,
      ageGateRequired: false,
      ageGateHtml: fetched.text,
      ageDeclarationUrl: declarationUrl,
      fallbackFrom: detail.fallbackFrom || declared.fallbackFrom || fetched.fallbackFrom || "",
    };
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export function parseDmmRentalWork(html, sourceUrl, fetchedAt = new Date().toISOString(), options = {}) {
  const normalizedUrl = normalizeDmmRentalUrl(sourceUrl);
  if (looksLikeAgeGate(html)) {
    throw new Error("DMM 返回了年龄确认/访问页，而不是作品详情页；Averia 不自动绕过访问控制，可在浏览器打开详情页后保存 HTML，再用 --file 离线解析。");
  }

  const cidFromUrl = extractDmmCid(normalizedUrl);
  const annotated = htmlToAnnotatedText(html);
  const titleInfo = pageTitle(html);
  if (!titleInfo.text) throw new Error("无法从 DMM Rental 详情页解析日文标题。");

  const pageCid = clean(fieldSection(annotated, "品番"));
  const cid = pageCid || cidFromUrl;
  const explicitCode = normalizeCatalogOverride(options.code ?? "");
  const derivedCode = deriveCatalogCodeFromDmmCid(cid);
  const code = explicitCode || derivedCode;
  if (!code) {
    throw new Error(`无法从 DMM 品番“${cid}”安全推导标准番号；请使用 --code 显式指定主番号。`);
  }

  const rentalStartDate = fullDateOrBlank(fieldSection(annotated, "貸出開始日"));
  const durationMin = intOrBlank(fieldSection(annotated, "収録時間"));
  const actressEntities = entitiesFromField(fieldSection(annotated, "出演者"), normalizedUrl, "actress");
  const directorEntities = entitiesFromField(fieldSection(annotated, "監督"), normalizedUrl, "director");
  const seriesEntity = singleEntity(fieldSection(annotated, "シリーズ"), normalizedUrl);
  const makerEntity = singleEntity(fieldSection(annotated, "メーカー"), normalizedUrl);
  const labelEntity = singleEntity(fieldSection(annotated, "レーベル"), normalizedUrl);
  const genreEntities = entitiesFromField(fieldSection(annotated, "ジャンル"), normalizedUrl, "genre");
  const cover = selectDmmRentalCover(html, normalizedUrl, cid);

  const actresses = actressEntities.filter((item) => item.name).map((item) => ({
    ...(item.id ? { source_record_id: `actress:${item.id}` } : {}),
    ...(item.href ? { source_url: item.href } : {}),
    fetched_at: fetchedAt,
    primary_name: item.name,
    name_ja: item.name,
    status: "unknown",
  }));

  const sourceNotes = [
    rentalStartDate ? `DMM Rental 貸出開始日=${rentalStartDate}` : "",
    explicitCode ? `主番号由命令行 --code 指定；DMM 品番=${cid}` : `主番号由 DMM 品番保守推导；DMM 品番=${cid}`,
  ].filter(Boolean).join("；");

  const work = {
    source_record_id: `work:${cid || cidFromUrl}`,
    source_url: normalizedUrl,
    fetched_at: fetchedAt,
    code,
    title: titleInfo.text,
    title_ja: titleInfo.text,
    release_date: "",
    duration_min: durationMin,
    ...(makerEntity.name ? { maker: { name: makerEntity.name, name_ja: makerEntity.name } } : {}),
    ...(labelEntity.name ? { label: { name: labelEntity.name, name_ja: labelEntity.name } } : {}),
    ...(seriesEntity.name ? { series: { name: seriesEntity.name, name_ja: seriesEntity.name } } : {}),
    genres: genreEntities.filter((item) => item.name).map((item) => ({
      name: item.name,
      name_ja: item.name,
      slug: `dmm-rental-${crypto.createHash("sha1").update(item.name).digest("hex").slice(0, 10)}`,
    })),
    directors: directorEntities.filter((item) => item.name).map((item, index) => ({ name: item.name, name_ja: item.name, position: index + 1 })),
    cast: actressEntities.filter((item) => item.name).map((item, index) => ({
      ...(item.id ? { source_record_id: `actress:${item.id}` } : {}),
      name: item.name,
      position: index + 1,
    })),
    cover_url: cover.url,
    codes: cid ? [{ code: cid, type: "dmm-content-id", is_primary: false }] : [],
    source_notes: sourceNotes,
  };

  return {
    canonical: {
      schema_version: 1,
      source: {
        name: DMM_RENTAL_SOURCE,
        fetched_at: fetchedAt,
        language: "ja",
        role: "reference",
      },
      actresses,
      works: [work],
    },
    meta: {
      provider_version: DMM_RENTAL_PROVIDER_VERSION,
      page_type: "work",
      source_name: DMM_RENTAL_SOURCE,
      source_language: "ja",
      source_role: "reference",
      source_record_id: work.source_record_id,
      dmm_cid: cid,
      catalog_code: code,
      catalog_code_source: explicitCode ? "cli" : "derived-from-dmm-cid",
      rental_start_date: rentalStartDate,
      title_source: titleInfo.source,
      cover_source: cover.source,
    },
  };
}
