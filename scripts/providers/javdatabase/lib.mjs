import crypto from "node:crypto";

export const JAVDATABASE_SOURCE = "javdatabase";
export const JAVDATABASE_PROVIDER_VERSION = 1;
const ALLOWED_HOSTS = new Set(["javdatabase.com", "www.javdatabase.com"]);

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

function parseAttributes(value) {
  const attrs = {};
  for (const match of String(value ?? "").matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function encodeLinkToken(link) {
  const payload = Buffer.from(JSON.stringify(link), "utf8").toString("base64url");
  return ` __AVERIA_LINK_${payload}__ `;
}

function decodeLinkToken(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { href: "", text: "" };
  }
}

export function htmlToAnnotatedText(html) {
  let value = String(html ?? "")
    .replace(/<!--([\s\S]*?)-->/g, " ")
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

function tokenRegex() {
  return /__AVERIA_LINK_([A-Za-z0-9_-]+)__/g;
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

export function plainAnnotatedText(value) {
  return String(value ?? "").replace(tokenRegex(), (_full, payload) => decodeLinkToken(payload).text ?? "").replace(/\s+/g, " ").trim();
}

function indexOfCaseInsensitive(text, marker, from = 0) {
  return text.toLocaleLowerCase("en").indexOf(marker.toLocaleLowerCase("en"), from);
}

export function sectionBetween(text, startMarker, endMarker) {
  const start = indexOfCaseInsensitive(text, startMarker);
  if (start < 0) return "";
  const contentStart = start + startMarker.length;
  const end = endMarker ? indexOfCaseInsensitive(text, endMarker, contentStart) : -1;
  return text.slice(contentStart, end >= 0 ? end : undefined).trim();
}

function valueBetweenMarkers(text, startMarker, endMarker) {
  return plainAnnotatedText(sectionBetween(text, startMarker, endMarker)).replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
}

function firstMetaContent(html, targetName) {
  for (const match of String(html ?? "").matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key === targetName.toLowerCase() && attrs.content) return attrs.content.trim();
  }
  return "";
}

function firstH1(html) {
  const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(String(html ?? ""));
  return match ? stripTags(match[1]) : "";
}

function cleanUnknown(value) {
  const text = plainAnnotatedText(value).trim();
  if (!text || /^(?:\?|unknown|n\/?a|none|-)$/i.test(text)) return "";
  return text;
}

function fullDateOrBlank(value) {
  const text = cleanUnknown(value);
  const match = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  return match ? match[1] : "";
}

function intOrBlank(value) {
  const text = cleanUnknown(value);
  const match = /\d+/.exec(text);
  return match ? Number.parseInt(match[0], 10) : "";
}

function slugFromUrl(url, expectedPrefix) {
  const parsed = new URL(url);
  const pieces = parsed.pathname.split("/").filter(Boolean);
  const prefixIndex = pieces.indexOf(expectedPrefix);
  return prefixIndex >= 0 ? pieces[prefixIndex + 1] ?? "" : "";
}

function normalizeNameKey(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, "");
}

function uniqueAliases(values, primaryName) {
  const seen = new Set([normalizeNameKey(primaryName)]);
  const aliases = [];
  for (const item of values) {
    const value = String(item?.value ?? item ?? "").trim();
    const key = normalizeNameKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(typeof item === "string" ? { value, type: "alternate", language: "" } : { ...item, value });
  }
  return aliases;
}

function genreSlug(name, href) {
  if (href) {
    try {
      const path = new URL(href).pathname.split("/").filter(Boolean);
      const i = path.indexOf("genres");
      if (i >= 0 && path[i + 1]) return path[i + 1];
    } catch { /* fall back */ }
  }
  const ascii = String(name ?? "").normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return `javdatabase-${crypto.createHash("sha1").update(String(name ?? "")).digest("hex").slice(0, 10)}`;
}

function firstLink(section, baseUrl, predicate = () => true) {
  return linksFromText(section, baseUrl).find((link) => link.text && predicate(link)) ?? null;
}

function linksInSection(text, startMarker, endMarker, baseUrl, predicate = () => true) {
  return linksFromText(sectionBetween(text, startMarker, endMarker), baseUrl).filter((link) => link.text && predicate(link));
}

export function normalizeJavdatabaseUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("JAVDatabase Provider 只允许 HTTPS URL。");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`不允许访问的主机：${url.hostname}`);
  url.hash = "";
  return url.href;
}

export function classifyJavdatabaseUrl(input) {
  const url = normalizeJavdatabaseUrl(input);
  const parsed = new URL(url);
  if (/^\/movies\/[^/]+\/?$/i.test(parsed.pathname)) return "work";
  if (/^\/idols\/[^/]+\/?$/i.test(parsed.pathname)) return "actress";
  throw new Error("当前 V0.3 只支持 JAVDatabase 的 /movies/<slug>/ 和 /idols/<slug>/ 单页。");
}

export function buildJavdatabaseUrl({ url, code, idol } = {}) {
  if (url) return normalizeJavdatabaseUrl(url);
  if (code) {
    const slug = String(code).trim().toLocaleLowerCase("en").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("--code 不能为空。");
    return `https://www.javdatabase.com/movies/${slug}/`;
  }
  if (idol) {
    const slug = String(idol).trim().toLocaleLowerCase("en").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("--idol 不能为空。");
    return `https://www.javdatabase.com/idols/${slug}/`;
  }
  throw new Error("请提供 --url、--code 或 --idol。");
}

export function parseJavdatabaseActress(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const url = normalizeJavdatabaseUrl(sourceUrl);
  const text = htmlToAnnotatedText(html);
  const slug = slugFromUrl(url, "idols");
  let heading = firstH1(html).replace(/\s*-\s*JAV Profile\s*$/i, "").trim();
  if (!heading) throw new Error("无法从女优页解析姓名：缺少 H1。");

  const aliases = [];
  const parenthetical = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(heading);
  if (parenthetical) {
    heading = parenthetical[1].trim();
    aliases.push({ value: parenthetical[2].trim(), type: "alternate", language: "en" });
  }

  const dob = valueBetweenMarkers(text, "DOB:", "Debut:");
  const debut = valueBetweenMarkers(text, "Debut:", "Debut Age:");
  const birthplace = valueBetweenMarkers(text, "Birthplace:", "Sign:");
  const blood = valueBetweenMarkers(text, "Blood:", "Measurements:");
  const measurementRaw = valueBetweenMarkers(text, "Measurements:", "Cup:");
  const cup = valueBetweenMarkers(text, "Cup:", "Height:");
  const height = valueBetweenMarkers(text, "Height:", "Shoe Size:");
  let jpSection = sectionBetween(text, "JP:", "Favorite");
  const firstLinkPos = jpSection.indexOf("__AVERIA_LINK_");
  if (firstLinkPos >= 0) jpSection = jpSection.slice(0, firstLinkPos);
  let jp = plainAnnotatedText(jpSection);
  let altRaw = "";
  const altPos = indexOfCaseInsensitive(jp, "Alt:");
  if (altPos >= 0) {
    altRaw = jp.slice(altPos + 4).trim();
    jp = jp.slice(0, altPos).trim();
  }
  jp = jp.replace(/\s+Movies Link.*$/i, "").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
  altRaw = altRaw.replace(/\s+Movies Link.*$/i, "").trim();
  for (const value of altRaw.split(",").map((v) => v.trim()).filter(Boolean)) aliases.push({ value, type: "alternate", language: "" });

  let bust = "", waist = "", hip = "";
  const triple = /(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)/.exec(measurementRaw);
  if (triple) {
    bust = Number.parseInt(triple[1], 10);
    waist = Number.parseInt(triple[2], 10);
    hip = Number.parseInt(triple[3], 10);
  } else {
    const one = /^\s*(\d+)\s*$/.exec(measurementRaw);
    if (one) bust = Number.parseInt(one[1], 10);
  }

  const actress = {
    source_record_id: `actress:${slug}`,
    source_url: url,
    fetched_at: fetchedAt,
    primary_name: heading,
    name_ja: cleanUnknown(jp),
    name_en: heading,
    birth_date: fullDateOrBlank(dob),
    debut_date: fullDateOrBlank(debut),
    height_cm: intOrBlank(height),
    bust_cm: bust,
    waist_cm: waist,
    hip_cm: hip,
    cup: cleanUnknown(cup).replace(/\s*Cup$/i, "").trim(),
    blood_type: cleanUnknown(blood),
    birthplace: cleanUnknown(birthplace),
    status: "unknown",
    profile_image_url: firstMetaContent(html, "og:image"),
    aliases: uniqueAliases(aliases, heading),
  };

  // 只从当前女优自己的作品列表区域发现作品链接。
  // 页面底部的 Recent Comments / Similar 等全站模块也可能包含 /movies/ 链接，
  // 如果扫描整页会把无关作品误当成该女优作品。
  const movieSectionStartCandidates = [
    `${heading} Censored JAV Movies`,
    `${heading} JAV Movies`,
    "Censored JAV Movies",
  ]
    .map((marker) => indexOfCaseInsensitive(text, marker))
    .filter((index) => index >= 0);
  const movieSectionStart = movieSectionStartCandidates.length ? Math.min(...movieSectionStartCandidates) : -1;
  const movieSectionEndCandidates = [
    `${heading} JAV Images`,
    `${heading} Biography`,
    "JAV Images",
    "Biography",
    "Related Idols",
  ]
    .map((marker) => movieSectionStart >= 0 ? indexOfCaseInsensitive(text, marker, movieSectionStart + 1) : -1)
    .filter((index) => index >= 0);
  const movieSectionEnd = movieSectionEndCandidates.length ? Math.min(...movieSectionEndCandidates) : -1;
  const movieSection = movieSectionStart >= 0
    ? text.slice(movieSectionStart, movieSectionEnd >= 0 ? movieSectionEnd : undefined)
    : sectionBetween(text, "Favorite", "Biography");

  const discoveredWorks = linksFromText(movieSection, url)
    .filter((link) => {
      try { return ALLOWED_HOSTS.has(new URL(link.href).hostname.toLowerCase()) && /^\/movies\/[^/]+\/?$/i.test(new URL(link.href).pathname); } catch { return false; }
    })
    .map((link) => link.href)
    .filter((value, index, all) => all.indexOf(value) === index);

  return {
    canonical: { schema_version: 1, source: { name: JAVDATABASE_SOURCE, fetched_at: fetchedAt }, actresses: [actress], works: [] },
    meta: { provider_version: JAVDATABASE_PROVIDER_VERSION, page_type: "actress", source_url: url, source_record_id: actress.source_record_id, discovered_work_urls: discoveredWorks },
  };
}

export function parseJavdatabaseWork(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const url = normalizeJavdatabaseUrl(sourceUrl);
  const text = htmlToAnnotatedText(html);
  const slug = slugFromUrl(url, "movies");
  const code = cleanUnknown(valueBetweenMarkers(text, "DVD ID:", "Content ID:"));
  const title = cleanUnknown(valueBetweenMarkers(text, "Title:", "JAV Series:"));
  if (!code) throw new Error("无法从作品页解析 DVD ID。");
  if (!title) throw new Error("无法从作品页解析标题。");

  const contentId = cleanUnknown(valueBetweenMarkers(text, "Content ID:", "Release Date:"));
  const releaseDate = fullDateOrBlank(valueBetweenMarkers(text, "Release Date:", "Runtime:"));
  const runtime = intOrBlank(valueBetweenMarkers(text, "Runtime:", "Studio:"));
  const studioSection = sectionBetween(text, "Studio:", "Director:");
  const directorSection = sectionBetween(text, "Director:", "Genre(s):");
  const seriesSection = sectionBetween(text, "JAV Series:", "DVD ID:");
  const studioLink = firstLink(studioSection, url);
  const seriesLink = firstLink(seriesSection, url);
  const studioName = cleanUnknown(studioLink?.text || plainAnnotatedText(studioSection));
  const seriesName = cleanUnknown(seriesLink?.text || plainAnnotatedText(seriesSection));
  const directorName = cleanUnknown(plainAnnotatedText(directorSection));

  const genreLinks = linksInSection(text, "Genre(s):", "Idol(s)/Actress(es):", url, (link) => {
    try { return /^\/genres\/[^/]+\/?$/i.test(new URL(link.href).pathname); } catch { return false; }
  });
  const genres = genreLinks.map((link) => ({ name: link.text, slug: genreSlug(link.text, link.href) }));

  const castLinks = linksInSection(text, "Idol(s)/Actress(es):", "Favorite:", url, (link) => {
    try { return /^\/idols\/[^/]+\/?$/i.test(new URL(link.href).pathname); } catch { return false; }
  });
  const actresses = [];
  const cast = [];
  for (const [position, link] of castLinks.entries()) {
    const actressSlug = slugFromUrl(link.href, "idols");
    const sourceRecordId = `actress:${actressSlug}`;
    actresses.push({
      source_record_id: sourceRecordId,
      source_url: link.href,
      fetched_at: fetchedAt,
      primary_name: link.text,
      name_en: link.text,
      status: "unknown",
    });
    cast.push({ source_record_id: sourceRecordId, name: link.text, position: position + 1 });
  }

  const work = {
    source_record_id: `work:${slug}`,
    source_url: url,
    fetched_at: fetchedAt,
    code,
    title,
    release_date: releaseDate,
    duration_min: runtime,
    maker: studioName ? { name: studioName } : undefined,
    series: seriesName ? { name: seriesName } : undefined,
    genres,
    cast,
    cover_url: firstMetaContent(html, "og:image"),
    codes: contentId ? [{ code: contentId, type: "content-id", is_primary: false }] : [],
    source_notes: directorName ? `JAVDatabase Director: ${directorName}` : "",
  };

  return {
    canonical: { schema_version: 1, source: { name: JAVDATABASE_SOURCE, fetched_at: fetchedAt }, actresses, works: [work] },
    meta: { provider_version: JAVDATABASE_PROVIDER_VERSION, page_type: "work", source_url: url, source_record_id: work.source_record_id, dvd_id: code, content_id: contentId, director: directorName },
  };
}

export function parseJavdatabasePage(html, sourceUrl, fetchedAt = new Date().toISOString()) {
  const type = classifyJavdatabaseUrl(sourceUrl);
  return type === "work" ? parseJavdatabaseWork(html, sourceUrl, fetchedAt) : parseJavdatabaseActress(html, sourceUrl, fetchedAt);
}

export async function fetchJavdatabaseHtml(sourceUrl, options = {}) {
  const url = normalizeJavdatabaseUrl(sourceUrl);
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.8",
        "user-agent": options.userAgent ?? "Averia/0.3 metadata-provider (+https://github.com/MagicBude/Averia)",
      },
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.name || "NETWORK";
    throw new Error(`JAVDatabase 网络请求失败（${cause}）：请检查当前网络、DNS 或来源站访问状态；Provider 未写入正式数据。`);
  }
  const finalUrl = normalizeJavdatabaseUrl(response.url || url);
  if (!response.ok) throw new Error(`JAVDatabase 请求失败：HTTP ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("text/html")) throw new Error(`返回内容不是 HTML：${contentType}`);
  return { html: await response.text(), finalUrl, status: response.status, contentType };
}
