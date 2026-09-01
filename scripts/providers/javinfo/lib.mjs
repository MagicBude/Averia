import crypto from "node:crypto";

export const JAVINFO_PROVIDER_VERSION = 1;
export const JAVINFO_API_BASE = "https://api.javinfo.dev";

function clean(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function normalizeCode(value) {
  const raw = clean(value).toUpperCase().replace(/[‐‑‒–—―ー－]/g, "-");
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{2,12})(\d{2,7})$/.exec(compact);
  return match ? `${match[1]}-${match[2]}` : raw;
}

function slug(source, value) {
  return `javinfo-${source}-${crypto.createHash("sha1").update(clean(value)).digest("hex").slice(0, 10)}`;
}

function hasJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(clean(value));
}

function sourceRole(source) {
  return new Set(["fanza", "dmm"]).has(source) ? "reference" : "supplemental";
}

function sourceLanguage(source) {
  // FANZA/DMM 的 JavInfo 标准化结果常同时包含 titleJa 与英文人名/分类。
  if (new Set(["fanza", "dmm"]).has(source)) return "mixed";
  return "en";
}

function apiSourceName(source) {
  return `javinfo-${source || "unknown"}`;
}

function richActressMap(result) {
  const map = new Map();
  for (const item of list(result?.extra?.actressesRich)) {
    const name = clean(item?.name);
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), item);
  }
  return map;
}

export function buildJavinfoMovieUrl({ code, providers = "", includeImages = true } = {}) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error("JavInfo /movie 必须提供番号。请使用 --code，例如 IPZZ-597。");
  const url = new URL("/movie", JAVINFO_API_BASE);
  url.searchParams.set("q", normalized);
  if (clean(providers)) url.searchParams.set("providers", clean(providers));
  if (includeImages) url.searchParams.set("includeImages", "true");
  return url.href;
}

export function parseJavinfoMovieResponse(payload, fetchedAt = new Date().toISOString(), options = {}) {
  if (!payload || typeof payload !== "object") throw new Error("JavInfo 返回内容不是 JSON 对象。");
  const result = payload.result;
  if (!result || typeof result !== "object") throw new Error("JavInfo 响应缺少 result，无法生成 canonical。");

  const upstream = clean(payload.source).toLowerCase() || "unknown";
  const dvdId = normalizeCode(result.dvdId || payload.q || options.code);
  if (!dvdId) throw new Error("JavInfo 响应缺少 dvdId。");

  const requested = normalizeCode(options.code || payload.q || dvdId);
  if (requested && requested !== dvdId) {
    throw new Error(`JavInfo 返回番号“${dvdId}”与请求番号“${requested}”不一致；已停止转换，避免抓错作品。`);
  }

  const titleJa = clean(result.titleJa);
  const titleEn = clean(result.titleEn);
  const title = titleJa || titleEn || dvdId;
  const contentId = clean(result.contentId);
  const rich = richActressMap(result);
  const actressNames = unique(result.actresses ?? []);

  const actresses = actressNames.map((name) => {
    const richItem = rich.get(name.toLowerCase());
    return {
      fetched_at: fetchedAt,
      primary_name: name,
      ...(hasJapanese(name) ? { name_ja: name } : { name_en: name }),
      status: "unknown",
      ...(clean(richItem?.image) ? { profile_image_url: clean(richItem.image) } : {}),
    };
  });

  const makers = unique(result.makers ?? []);
  const categories = unique(result.categories ?? []);
  const directors = unique(result.directors ?? []);
  const sourceName = apiSourceName(upstream);
  const queryUrl = new URL("/movie", JAVINFO_API_BASE);
  queryUrl.searchParams.set("q", dvdId);
  queryUrl.searchParams.set("providers", upstream);

  const codes = [];
  if (contentId && contentId.toUpperCase() !== dvdId.replace(/-/g, "")) {
    codes.push({
      code: contentId,
      type: `${upstream || "javinfo"}-content-id`,
      is_primary: false,
    });
  }

  const sourceNotes = [
    `通过 JavInfo API 获取；上游来源=${upstream}`,
    clean(result.site) ? `site=${clean(result.site)}` : "",
    clean(result.serviceCode) ? `serviceCode=${clean(result.serviceCode)}` : "",
    `JavInfo 标准化人名/分类可能为英文；不视为厂商官方日文字段`,
  ].filter(Boolean).join("；");

  const work = {
    source_record_id: `work:${contentId || dvdId}`,
    source_url: queryUrl.href,
    fetched_at: fetchedAt,
    code: dvdId,
    title,
    ...(titleJa ? { title_ja: titleJa } : {}),
    release_date: clean(result.releaseDate),
    duration_min: Number.isFinite(Number(result.runtimeMins)) ? Number(result.runtimeMins) : "",
    ...(makers[0] ? { maker: { name: makers[0], ...(hasJapanese(makers[0]) ? { name_ja: makers[0] } : {}) } } : {}),
    ...(clean(result.label) ? { label: { name: clean(result.label), ...(hasJapanese(result.label) ? { name_ja: clean(result.label) } : {}) } } : {}),
    ...(clean(result.series) ? { series: { name: clean(result.series), ...(hasJapanese(result.series) ? { name_ja: clean(result.series) } : {}) } } : {}),
    genres: categories.map((name) => ({ name, ...(hasJapanese(name) ? { name_ja: name } : {}), slug: slug(upstream, name) })),
    directors: directors.map((name, index) => ({ name, ...(hasJapanese(name) ? { name_ja: name } : {}), position: index + 1 })),
    cast: actressNames.map((name, index) => ({ name, position: index + 1 })),
    cover_url: clean(result.jacketFullUrl || result.jacketThumbUrl),
    codes,
    source_notes: sourceNotes,
  };

  return {
    canonical: {
      schema_version: 1,
      source: {
        name: sourceName,
        fetched_at: fetchedAt,
        language: sourceLanguage(upstream),
        role: sourceRole(upstream),
      },
      actresses,
      works: [work],
    },
    meta: {
      provider_version: JAVINFO_PROVIDER_VERSION,
      endpoint: "/movie",
      upstream_source: upstream,
      source_name: sourceName,
      source_language: sourceLanguage(upstream),
      source_role: sourceRole(upstream),
      dvd_id: dvdId,
      content_id: contentId,
      site: clean(result.site),
      service_code: clean(result.serviceCode),
      title_en: titleEn,
      gallery_full_count: list(result?.extra?.galleryFull).length,
      gallery_thumb_count: list(result?.extra?.galleryThumb).length,
      sample_url_present: Boolean(clean(result?.extra?.sampleUrl)),
      note: "raw.json 保留 JavInfo 完整响应；当前 canonical 只映射 Averia 已有字段，样图/预览将在后续媒体表中建模。",
    },
  };
}
