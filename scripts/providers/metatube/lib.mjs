// scripts/providers/metatube/lib.mjs
//
// Averia MetaTube Provider（V0.8 新增源）【合规版】
//
// 设计定位：
//   MetaTube 是一个 Go 写的「刮削引擎 + REST API server」，社区已维护 34 个数据源
//   （fanza / javbus / madouqu(中文) / jav321 / mgstage / sod / duga …）。
//   Averia 不自研这 34 个站点的 selector，而是【直连本地起好的 metatube-server】，
//   调它的 REST API 拿 JSON，再转成 Averia 统一导入 canonical。
//   这样「站点改版」的维护成本整个转移给上游社区，Averia 只负责规范/归并/质量。
//
// API（来自 metatube-sdk-go/route/route.go，v1 前缀）：
//   GET /v1/movies/{provider}/{id}   电影信息（需 TOKEN，本地不设则免鉴权）
//   GET /v1/actors/{provider}/{id}   女优信息
//   响应统一包在 { "data": {...}, "error": ... }
//   provider = 数据源名（如 fanza）；id = 该源稳定记录 id（对 JAV 通常是番号）
//
// 合规边界（与 AGENTS.md 一致）：
//   - 只调本地/自建 server，不碰第三方站点、不绕过反爬/验证码；
//   - 原始 JSON 落 raw.json + SHA-256，可审查可复现；
//   - Provider 只产出 canonical，绝不直接写正式 CSV。

import crypto from "node:crypto";

export const METATUBE_PROVIDER_VERSION = 1;
export const METATUBE_DEFAULT_BASE = "http://localhost:8080";

// 已知数据源语言（用于决定 name_ja / name_en，以及 source.language）。
// metatube 以 JAV 日文源为主，故未知源默认按 ja 处理。
const ZH_PROVIDERS = new Set(["madouqu"]);
const EN_PROVIDERS = new Set(["theporndb"]);
const JA_PROVIDERS = new Set([
  "fanza", "dmm", "dmmrental", "javbus", "jav321", "mgstage", "sod", "ideapocket",
  "moodyz", "caribbeancom", "caribbeancompr", "heydouga", "heyzo", "1pondo",
  "10musume", "fc2", "fc2hub", "fc2ppvdb", "tokyo-hot", "duga", "getchu",
  "gcolle", "pcolle", "c0930", "h0930", "h4610", "mywife", "pacopacomama",
  "muramura", "kin8tengoku", "avbase", "av-league", "aventertainments", "dahlia",
  "faleno", "av-league",
]);

// ---------- 小工具 ----------

function clean(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

// 是否含日文（含平假名/片假名/汉字）。注意：汉字范围与中文重叠，
// 因此单独出现时无法精确区分中日，这里仅作「含 CJK」的启发式判断。
function hasJapanese(value) {
  return /[぀-ゟ゠-ヿ一-鿿ｦ-ﾟ]/u.test(clean(value));
}

export function providerLanguage(provider) {
  const p = clean(provider).toLowerCase();
  if (ZH_PROVIDERS.has(p)) return "zh";
  if (EN_PROVIDERS.has(p)) return "en";
  return "ja"; // metatube 以 JAV 源为主
}

export function sourceName(provider) {
  return `metatube-${clean(provider).toLowerCase() || "unknown"}`;
}

function sourceRole(provider) {
  // fanza/dmm 是厂商官方授权聚合，视为参考源；其余为补充源。
  return new Set(["fanza", "dmm"]).has(clean(provider).toLowerCase()) ? "reference" : "supplemental";
}

// 把番号规范成 Averia 形态：IPZZ-597（大写字母 + 短横 + 数字）。
// 兼容各种全/半角短横与多余符号。
function normalizeCode(value) {
  const raw = clean(value).toUpperCase().replace(/[‐‑‒–—―ー－]/g, "-");
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{2,12})(\d{2,7})$/.exec(compact);
  return match ? `${match[1]}-${match[2]}` : raw;
}

// genre 等分类的 slug：带 source 前缀 + sha1 短串，保证跨源唯一且不依赖人工填 slug。
function slug(source, value) {
  return `metatube-${source}-${crypto.createHash("sha1").update(clean(value)).digest("hex").slice(0, 10)}`;
}

// 人名词条字段：根据语言与字符决定写 name_ja 还是 name_en。
// 中文源当前 schema 没有 name_zh，中文名先落 primary_name，等中文层 schema 落地再回填。
function nameFields(name, lang) {
  const n = clean(name);
  if (!n) return {};
  if (hasJapanese(n)) return { name_ja: n };
  if (lang === "zh") return {}; // 中文落到 primary_name，name_zh 待 schema 支持
  if (lang === "en") return { name_en: n };
  return { name_en: n }; // ja provider 但名字是拉丁字母（罗马音）→ 记为英文名
}

// 解析三围字符串，兼容 "B85/W58/H83"（数字前带 B/W/H 字母）与 "85-58-83"。
// 做法：抽取串中前三个 2~3 位整数，分别对应胸/腰/臀。
function parseMeasurements(text) {
  const nums = clean(text).match(/\d{2,3}/g);
  if (!nums || nums.length < 3) return {};
  return { bust: Number(nums[0]), waist: Number(nums[1]), hip: Number(nums[2]) };
}

// 从可能被 {data:...} 包裹的响应里取出实体对象。
function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

// ---------- 解析：电影 ----------

export function parseMetatubeMovieResponse(payload, fetchedAt = new Date().toISOString(), options = {}) {
  const movie = unwrap(payload);
  if (!movie || typeof movie !== "object") {
    throw new Error("MetaTube 响应缺少 movie 数据（期望 {data:{...MovieInfo}}）。");
  }
  if (movie.error) throw new Error(`MetaTube 返回错误：${JSON.stringify(movie.error)}`);

  const provider = clean(movie.provider || options.provider);
  if (!provider) throw new Error("MetaTube movie 缺少 provider，无法生成 source.name。");
  const lang = providerLanguage(provider);
  const srcName = sourceName(provider);
  const id = clean(movie.id);
  const number = clean(movie.number) || normalizeCode(id);
  if (!number) throw new Error("MetaTube movie 缺少 number/id，无法生成 canonical。");

  const title = clean(movie.title) || number;
  const actressNames = unique(movie.actors ?? []);
  const makers = unique(movie.maker ? [movie.maker] : []);
  const directors = unique(movie.director ? [movie.director] : []);
  const categories = unique(movie.genres ?? []);

  const actresses = actressNames.map((nm) => ({
    fetched_at: fetchedAt,
    primary_name: nm,
    ...nameFields(nm, lang),
    status: "unknown",
  }));

  const sourceNotes = [
    `通过 MetaTube server 获取；上游 provider=${provider}`,
    `MetaTube 聚合多源，本记录仅代表 ${provider} 一家`,
    lang === "zh"
      ? "中文源（madouqu）；title_zh/name_zh 待 schema 落地后回填"
      : lang === "ja"
        ? "日文源"
        : "英文源",
  ].join("；");

  const work = {
    source_record_id: `${provider}:${id || number}`,
    source_url: clean(movie.homepage),
    fetched_at: fetchedAt,
    code: number,
    title,
    ...(lang === "ja" && hasJapanese(title) ? { title_ja: title } : {}),
    release_date: clean(movie.release_date),
    duration_min: Number.isFinite(Number(movie.runtime)) ? Number(movie.runtime) : "",
    ...(makers[0] ? { maker: { name: makers[0], ...nameFields(makers[0], lang) } } : {}),
    ...(clean(movie.label) ? { label: { name: clean(movie.label), ...nameFields(movie.label, lang) } } : {}),
    ...(clean(movie.series) ? { series: { name: clean(movie.series), ...nameFields(movie.series, lang) } } : {}),
    genres: categories.map((name) => ({ name, ...nameFields(name, lang), slug: slug(provider, name) })),
    directors: directors.map((name, index) => ({ name, ...nameFields(name, lang), position: index + 1 })),
    cast: actressNames.map((name, index) => ({ name, position: index + 1 })),
    cover_url: clean(movie.cover_url || movie.big_cover_url),
    codes: [],
    source_notes: sourceNotes,
  };

  return {
    canonical: {
      schema_version: 1,
      source: { name: srcName, fetched_at: fetchedAt, language: lang, role: sourceRole(provider) },
      actresses,
      works: [work],
    },
    meta: {
      provider_version: METATUBE_PROVIDER_VERSION,
      endpoint: `/v1/movies/${provider}/${encodeURIComponent(id || number)}`,
      upstream_source: provider,
      source_name: srcName,
      source_language: lang,
      source_role: sourceRole(provider),
      movie_id: id,
      movie_number: number,
      title,
      maker: makers[0] || "",
      cover_url_present: Boolean(work.cover_url),
      actor_count: actressNames.length,
      note: "MetaTube 返回的原始 JSON 保留在 raw.json；canonical 只映射 Averia 已有字段，预览图/评分将在后续媒体表建模。",
    },
  };
}

// ---------- 解析：女优 ----------

export function parseMetatubeActorResponse(payload, fetchedAt = new Date().toISOString(), options = {}) {
  const actor = unwrap(payload);
  if (!actor || typeof actor !== "object") {
    throw new Error("MetaTube 响应缺少 actor 数据（期望 {data:{...ActorInfo}}）。");
  }
  if (actor.error) throw new Error(`MetaTube 返回错误：${JSON.stringify(actor.error)}`);

  const provider = clean(actor.provider || options.provider);
  if (!provider) throw new Error("MetaTube actor 缺少 provider。");
  const lang = providerLanguage(provider);
  const srcName = sourceName(provider);
  const id = clean(actor.id);
  const name = clean(actor.name);
  if (!name) throw new Error("MetaTube actor 缺少 name。");

  const aliases = unique(actor.aliases ?? []).map((a) => ({
    value: a,
    type: "alias",
    language: lang === "zh" ? "zh" : hasJapanese(a) ? "ja" : "en",
  }));
  const measurements = parseMeasurements(actor.measurements);

  const actress = {
    source_record_id: `${provider}:${id || name}`,
    source_url: clean(actor.homepage),
    fetched_at: fetchedAt,
    primary_name: name,
    ...nameFields(name, lang),
    status: "unknown",
    ...(clean(actor.birthday) ? { birth_date: clean(actor.birthday) } : {}),
    ...(Number.isFinite(Number(actor.height)) && Number(actor.height)
      ? { height_cm: Number(actor.height) }
      : {}),
    ...(clean(actor.cup_size) ? { cup: clean(actor.cup_size) } : {}),
    ...(measurements.bust ? { bust_cm: measurements.bust } : {}),
    ...(measurements.waist ? { waist_cm: measurements.waist } : {}),
    ...(measurements.hip ? { hip_cm: measurements.hip } : {}),
    ...(clean(actor.blood_type) ? { blood_type: clean(actor.blood_type) } : {}),
    ...(list(actor.images)[0] ? { profile_image_url: clean(list(actor.images)[0]) } : {}),
    ...(aliases.length ? { aliases } : {}),
  };

  return {
    canonical: {
      schema_version: 1,
      source: { name: srcName, fetched_at: fetchedAt, language: lang, role: sourceRole(provider) },
      actresses: [actress],
      works: [],
    },
    meta: {
      provider_version: METATUBE_PROVIDER_VERSION,
      endpoint: `/v1/actors/${provider}/${encodeURIComponent(id || name)}`,
      upstream_source: provider,
      source_name: srcName,
      source_language: lang,
      source_role: sourceRole(provider),
      actor_id: id,
      actor_name: name,
      alias_count: aliases.length,
      note: "MetaTube 女优字段较丰富（三围/血型/生日/别名），Averia actress schema 已支持 bust_cm/waist_cm/hip_cm/cup/blood_type，直接落库。",
    },
  };
}

// ---------- 抓取（直连本地 server） ----------

// 判断 base 是否为本地地址（localhost / 127.0.0.1 / ::1）。
// 本地地址不应走代理，否则会被路由到代理服务器而连不上。
export function isLocalBase(baseUrl) {
  try {
    const host = new URL(baseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

// 直连 metatube-server 的 REST API。返回 { json, url }。
// 只有显式 --proxy 且 base 非本地时，才把代理写进环境变量让 Node 全局 fetch 使用。
export async function fetchMetatubeJson(baseUrl, provider, id, { token = "", type = "movie", timeoutMs = 30000, proxy = "" } = {}) {
  const base = (baseUrl || METATUBE_DEFAULT_BASE).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error(`MetaTube base 必须是 http/https：${base}`);

  const kind = type === "actor" ? "actors" : "movies";
  const path = `/v1/${kind}/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`;
  const url = new URL(path, base).href;

  if (proxy && !isLocalBase(base)) {
    const proxyUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(proxy) ? proxy : `http://${proxy}`;
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    process.env.NODE_USE_ENV_PROXY = "1";
  }

  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`无法连接 MetaTube server（${url}）：${err.message}。请确认 server 已启动且可达。`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      if (j?.error) detail = JSON.stringify(j.error);
    } catch {
      /* 忽略解析失败 */
    }
    throw new Error(`MetaTube server 返回 HTTP ${res.status}${detail ? `：${detail}` : ""}（${url}）`);
  }
  const json = await res.json();
  return { json, url };
}
