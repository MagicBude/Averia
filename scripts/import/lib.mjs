import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCatalog, normalizeCatalogCode } from "../lib/catalog.mjs";

export const IMPORT_STAGE_VERSION = 1;

export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, "");
}

export function normalizeTaxonomyName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function recordHash(record) {
  return sha256(stableJson(record));
}

export function catalogFingerprint() {
  const catalog = loadCatalog();
  const parts = Object.entries(catalog)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, dataset]) => `${name}:${sha256(fs.readFileSync(dataset.filePath))}`);
  return sha256(parts.join("\n"));
}

export function nextIdFactory(catalog) {
  const maxByPrefix = new Map();
  for (const dataset of Object.values(catalog)) {
    for (const record of dataset.records) {
      for (const value of Object.values(record)) {
        const match = /^(actress|alias|work|code|maker|label|series|genre|director|source|obs|res|ea)_(\d{6})$/.exec(value);
        if (!match) continue;
        maxByPrefix.set(match[1], Math.max(maxByPrefix.get(match[1]) ?? 0, Number(match[2])));
      }
    }
  }
  return (prefix) => {
    const next = (maxByPrefix.get(prefix) ?? 0) + 1;
    maxByPrefix.set(prefix, next);
    return `${prefix}_${String(next).padStart(6, "0")}`;
  };
}

function namesForActress(record) {
  return [record.primary_name, record.name_ja, record.name_en, record.kana].filter(Boolean);
}

function buildActressNameIndex(catalog) {
  const index = new Map();
  const add = (name, id) => {
    const key = normalizeName(name);
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(id);
  };
  for (const record of catalog.actresses.records) {
    for (const name of namesForActress(record)) add(name, record.id);
  }
  for (const record of catalog.actress_aliases.records) add(record.alias, record.actress_id);
  return index;
}

function buildSourceIndex(catalog) {
  const index = new Map();
  for (const row of catalog.source_records.records) {
    if (!row.source_name || !row.source_record_id) continue;
    index.set(`${row.entity_type}\u0000${row.source_name}\u0000${row.source_record_id}`, row.entity_id);
  }
  return index;
}

function buildCodeIndex(catalog) {
  const index = new Map();
  const add = (code, id) => {
    const key = normalizeCatalogCode(code);
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(id);
  };
  for (const row of catalog.works.records) add(row.primary_code, row.id);
  for (const row of catalog.work_codes.records) add(row.normalized_code || row.code, row.work_id);
  return index;
}

function buildSimpleNameIndex(records) {
  const index = new Map();
  for (const row of records) {
    for (const candidate of [row.name, row.name_ja]) {
      const key = normalizeTaxonomyName(candidate);
      if (!key) continue;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(row);
    }
  }
  return index;
}

function emptyAppend() {
  return {
    actresses: [], actress_aliases: [], works: [], work_codes: [], work_cast: [], work_genres: [], work_directors: [],
    makers: [], labels: [], series: [], genres: [], directors: [], source_records: [],
    observations: [], field_resolutions: [], entity_aliases: [],
  };
}

const FIELD_LANGUAGE = {
  primary_name: "ja", name_ja: "ja", kana: "ja", name_en: "en", title_ja: "ja",
};
const langForField = (field) => FIELD_LANGUAGE[field] ?? "";
const ACTRESS_OBSERVABLE_FIELDS = [
  "primary_name", "name_ja", "name_en", "kana",
  "birth_date", "debut_date", "retirement_date",
  "height_cm", "bust_cm", "waist_cm", "hip_cm", "cup", "blood_type", "birthplace", "status",
  "profile_image_url", "description",
];
const WORK_OBSERVABLE_FIELDS = ["title", "title_ja", "release_date", "duration_min", "description", "cover_url"];

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function compactRecord(columns, values) {
  return Object.fromEntries(columns.map((column) => [column, values[column] == null ? "" : String(values[column])]));
}

function ensureImportShape(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) errors.push("导入文件根节点必须是 JSON 对象。 ");
  if (document?.schema_version !== 1) errors.push("schema_version 当前必须为 1。 ");
  if (!document?.source?.name || typeof document.source.name !== "string") errors.push("source.name 为必填字符串。 ");
  if (document?.actresses != null && !Array.isArray(document.actresses)) errors.push("actresses 必须是数组。 ");
  if (document?.works != null && !Array.isArray(document.works)) errors.push("works 必须是数组。 ");
  if (errors.length) throw new Error(errors.join("\n"));
}

function uniqueSingle(set) {
  if (!set || set.size !== 1) return null;
  return [...set][0];
}

export function loadImportDocument(filePath) {
  const fullPath = path.resolve(filePath);
  const document = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  ensureImportShape(document);
  return { document, fullPath };
}

export function prepareImport(document, options = {}) {
  ensureImportShape(document);
  const catalog = options.catalog ?? loadCatalog();
  const nextId = nextIdFactory(catalog);
  const append = emptyAppend();
  const issues = [];
  const matches = [];
  const proposals = [];
  const sourceIndex = buildSourceIndex(catalog);
  const nameIndex = buildActressNameIndex(catalog);
  const codeIndex = buildCodeIndex(catalog);
  const makerIndex = buildSimpleNameIndex(catalog.makers.records);
  const labelIndex = buildSimpleNameIndex(catalog.labels.records);
  const seriesIndex = buildSimpleNameIndex(catalog.series.records);
  const genreIndex = buildSimpleNameIndex(catalog.genres.records);
  const directorIndex = buildSimpleNameIndex(catalog.directors.records);
  const batchActressBySource = new Map();
  const batchActressByName = new Map();
  const batchWorkBySource = new Map();
  const sourceName = document.source.name.trim();
  const fetchedAt = document.source.fetched_at || utcNow();
  const createdAt = options.now ?? utcNow();

  const addIssue = (severity, type, message, context = {}) => issues.push({ severity, type, message, ...context });
  const findSource = (type, sourceRecordId) => sourceRecordId ? sourceIndex.get(`${type}\u0000${sourceName}\u0000${sourceRecordId}`) : null;

  const newSource = (entityType, entityId, input) => {
    if (!input.source_record_id && !input.source_url) return "";
    if (input.source_record_id && findSource(entityType, input.source_record_id)) return "";
    const id = nextId("source");
    append.source_records.push(compactRecord(catalog.source_records.schema.columns, {
      id,
      entity_type: entityType,
      entity_id: entityId,
      source_name: sourceName,
      source_record_id: input.source_record_id ?? "",
      source_url: input.source_url ?? "",
      fetched_at: input.fetched_at ?? fetchedAt,
      raw_hash: recordHash(input),
      notes: input.source_notes ?? "",
    }));
    if (input.source_record_id) {
      sourceIndex.set(`${entityType}\u0000${sourceName}\u0000${input.source_record_id}`, entityId);
    }
    return id;
  };

  // 字段级观察：记录“某来源对某个实体的某个字段观察到了什么值”。
  // append-only 溯源日志，不参与去重或覆盖判断。
  const recordObservation = (entityType, entityId, field, observedValue, observedLanguage, sourceRecordId, notes) => {
    if (observedValue == null || String(observedValue) === "") return;
    append.observations.push(compactRecord(catalog.observations.schema.columns, {
      id: nextId("obs"),
      entity_type: entityType,
      entity_id: entityId,
      source_name: sourceName,
      source_record_id: sourceRecordId ?? "",
      field,
      observed_value: String(observedValue),
      observed_language: observedLanguage ?? "",
      observed_at: fetchedAt,
      raw_hash: "",
      notes: notes ?? "",
    }));
  };

  const resolveSimpleEntity = (kind, input, parent = {}) => {
    if (!input) return "";
    const obj = typeof input === "string" ? { name: input } : input;
    if (!obj.name) return "";
    const index = kind === "maker" ? makerIndex
      : kind === "label" ? labelIndex
      : kind === "series" ? seriesIndex
      : kind === "director" ? directorIndex
      : genreIndex;
    const key = normalizeTaxonomyName(obj.name);
    let candidates = index.get(key) ?? [];
    if (kind === "label" && parent.maker_id) candidates = candidates.filter((row) => !row.maker_id || row.maker_id === parent.maker_id);
    if (kind === "series") candidates = candidates.filter((row) => (!parent.maker_id || !row.maker_id || row.maker_id === parent.maker_id) && (!parent.label_id || !row.label_id || row.label_id === parent.label_id));
    const ids = [...new Set(candidates.map((row) => row.id))];
    if (ids.length === 1) return ids[0];
    if (ids.length > 1) {
      addIssue("error", "ambiguous-taxonomy", `${kind} 名称“${obj.name}”匹配到多个正式实体。`, { value: obj.name });
      return "";
    }

    const prefix = kind;
    const id = nextId(prefix);
    const datasetName = {
      maker: "makers",
      label: "labels",
      series: "series",
      genre: "genres",
      director: "directors",
    }[kind];
    const schema = catalog[datasetName].schema;
    const values = {
      id,
      name: obj.name,
      name_ja: obj.name_ja ?? "",
      website_url: obj.website_url ?? "",
      description: obj.description ?? "",
      created_at: createdAt,
      updated_at: createdAt,
    };
    if (kind === "maker") {
      // no-op
    } else if (kind === "label") {
      values.maker_id = parent.maker_id ?? "";
    } else if (kind === "series") {
      values.maker_id = parent.maker_id ?? "";
      values.label_id = parent.label_id ?? "";
    } else if (kind === "genre") {
      values.slug = obj.slug ?? "";
    } else if (kind === "director") {
      // 导演实体当前只使用通用名称/官网/说明字段。
    }
    const row = compactRecord(schema.columns, values);
    append[datasetName].push(row);
    recordObservation(kind, id, "name", obj.name, obj.name_ja ? "ja" : "en", obj.source_record_id ?? "");
    if (obj.name_ja) recordObservation(kind, id, "name_ja", obj.name_ja, "ja", obj.source_record_id ?? "");
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
    return id;
  };

  for (const [position, input] of (document.actresses ?? []).entries()) {
    if (!input || typeof input !== "object") {
      addIssue("error", "invalid-actress", `actresses[${position}] 必须是对象。`);
      continue;
    }
    const sourceRecordId = input.source_record_id ?? "";
    let id = sourceRecordId ? batchActressBySource.get(sourceRecordId) : null;
    let matchReason = id ? "same-batch-source-record" : "";
    if (!id) {
      id = findSource("actress", sourceRecordId);
      if (id) matchReason = "source-record";
    }

    if (!id) {
      const candidateIds = new Set();
      for (const candidateName of [input.primary_name, input.name_ja, input.name_en, input.kana, ...(input.aliases ?? []).map((a) => typeof a === "string" ? a : a?.value)]) {
        const key = normalizeName(candidateName);
        for (const candidateId of nameIndex.get(key) ?? []) candidateIds.add(candidateId);
      }
      if (candidateIds.size === 1) {
        id = uniqueSingle(candidateIds);
        matchReason = "exact-name-or-alias";
      } else if (candidateIds.size > 1) {
        addIssue("error", "ambiguous-actress", `女优“${input.primary_name || input.name_ja || sourceRecordId || position}”精确匹配到多个实体，禁止自动合并。`, { index: position, candidates: [...candidateIds] });
        continue;
      }
    }

    if (!id) {
      if (!input.primary_name) {
        addIssue("error", "missing-actress-name", `actresses[${position}] 为新实体时必须提供 primary_name。`, { index: position });
        continue;
      }
      id = nextId("actress");
      append.actresses.push(compactRecord(catalog.actresses.schema.columns, {
        id,
        primary_name: input.primary_name,
        name_ja: input.name_ja ?? "",
        name_en: input.name_en ?? "",
        kana: input.kana ?? "",
        birth_date: input.birth_date ?? "",
        debut_date: input.debut_date ?? "",
        retirement_date: input.retirement_date ?? "",
        height_cm: input.height_cm ?? "",
        bust_cm: input.bust_cm ?? "",
        waist_cm: input.waist_cm ?? "",
        hip_cm: input.hip_cm ?? "",
        cup: input.cup ?? "",
        blood_type: input.blood_type ?? "",
        birthplace: input.birthplace ?? "",
        status: input.status ?? "",
        profile_image_url: input.profile_image_url ?? "",
        description: input.description ?? "",
        created_at: createdAt,
        updated_at: createdAt,
      }));
      newSource("actress", id, input);
      const aliasValues = input.aliases ?? [];
      for (const aliasInput of aliasValues) {
        const alias = typeof aliasInput === "string" ? aliasInput : aliasInput?.value;
        if (!alias || normalizeName(alias) === normalizeName(input.primary_name)) continue;
        append.actress_aliases.push(compactRecord(catalog.actress_aliases.schema.columns, {
          id: nextId("alias"),
          actress_id: id,
          alias,
          alias_type: typeof aliasInput === "string" ? "alternate" : aliasInput.type ?? "alternate",
          language: typeof aliasInput === "string" ? "" : aliasInput.language ?? "",
          is_primary: "false",
          source_id: "",
          created_at: createdAt,
        }));
        const aliasKey = normalizeName(alias);
        if (aliasKey) batchActressByName.set(aliasKey, id);
      }
      for (const name of [input.primary_name, input.name_ja, input.name_en, input.kana]) {
        const key = normalizeName(name);
        if (key) batchActressByName.set(key, id);
      }
      for (const field of ACTRESS_OBSERVABLE_FIELDS) {
        if (input[field] != null && String(input[field]) !== "") recordObservation("actress", id, field, input[field], langForField(field), sourceRecordId);
      }
    } else {
      matches.push({ entity_type: "actress", entity_id: id, source_record_id: sourceRecordId, reason: matchReason });
      newSource("actress", id, input);
      const existing = catalog.actresses.records.find((row) => row.id === id);
      if (existing) {
        for (const field of ["name_ja","name_en","kana","birth_date","debut_date","retirement_date","height_cm","bust_cm","waist_cm","hip_cm","cup","blood_type","birthplace","status","profile_image_url","description"]) {
          if (!existing[field] && input[field] != null && String(input[field]) !== "") proposals.push({ entity_type: "actress", entity_id: id, field, current: "", proposed: String(input[field]), action: "review-only" });
        }
        for (const field of ACTRESS_OBSERVABLE_FIELDS) {
          if (input[field] != null && String(input[field]) !== "") recordObservation("actress", id, field, input[field], langForField(field), sourceRecordId);
        }
      }
    }
    if (sourceRecordId) batchActressBySource.set(sourceRecordId, id);
  }

  const resolveCastActress = (castInput) => {
    if (castInput.source_record_id) {
      const id = batchActressBySource.get(castInput.source_record_id) || findSource("actress", castInput.source_record_id);
      if (id) return id;
    }
    if (castInput.name) {
      const key = normalizeName(castInput.name);
      if (batchActressByName.has(key)) return batchActressByName.get(key);
      const ids = nameIndex.get(key);
      if (ids?.size === 1) return [...ids][0];
      if (ids?.size > 1) return { ambiguous: [...ids] };
    }
    return null;
  };

  for (const [position, input] of (document.works ?? []).entries()) {
    if (!input || typeof input !== "object") {
      addIssue("error", "invalid-work", `works[${position}] 必须是对象。`);
      continue;
    }
    const code = input.code ?? input.primary_code ?? "";
    if (!code) {
      addIssue("error", "missing-work-code", `works[${position}] 缺少 code。`, { index: position });
      continue;
    }
    const sourceRecordId = input.source_record_id ?? "";
    let id = sourceRecordId ? batchWorkBySource.get(sourceRecordId) : null;
    let matchReason = id ? "same-batch-source-record" : "";
    if (!id) {
      id = findSource("work", sourceRecordId);
      if (id) matchReason = "source-record";
    }
    if (!id) {
      const candidates = codeIndex.get(normalizeCatalogCode(code));
      if (candidates?.size === 1) {
        id = [...candidates][0];
        matchReason = "normalized-code";
      } else if (candidates?.size > 1) {
        addIssue("error", "ambiguous-work-code", `番号“${code}”匹配到多个作品，禁止自动合并。`, { index: position, candidates: [...candidates] });
        continue;
      }
    }

    let isNew = false;
    if (!id) {
      if (!input.title) {
        addIssue("error", "missing-work-title", `works[${position}] 为新作品时必须提供 title。`, { index: position });
        continue;
      }
      isNew = true;
      id = nextId("work");
      const makerId = resolveSimpleEntity("maker", input.maker);
      const labelId = resolveSimpleEntity("label", input.label, { maker_id: makerId });
      const seriesId = resolveSimpleEntity("series", input.series, { maker_id: makerId, label_id: labelId });
      append.works.push(compactRecord(catalog.works.schema.columns, {
        id,
        primary_code: code,
        title: input.title,
        title_ja: input.title_ja ?? "",
        release_date: input.release_date ?? "",
        duration_min: input.duration_min ?? "",
        maker_id: makerId,
        label_id: labelId,
        series_id: seriesId,
        description: input.description ?? "",
        cover_url: input.cover_url ?? "",
        created_at: createdAt,
        updated_at: createdAt,
      }));
      const sourceId = newSource("work", id, input);
      append.work_codes.push(compactRecord(catalog.work_codes.schema.columns, {
        id: nextId("code"), work_id: id, code, normalized_code: normalizeCatalogCode(code), code_type: "catalog", is_primary: "true", source_id: sourceId,
      }));
      for (const extraCodeInput of input.codes ?? []) {
        const extra = typeof extraCodeInput === "string" ? { code: extraCodeInput } : extraCodeInput ?? {};
        const extraCode = String(extra.code ?? "").trim();
        const normalizedExtra = normalizeCatalogCode(extraCode);
        if (!extraCode || !normalizedExtra || normalizedExtra === normalizeCatalogCode(code)) continue;
        const owners = codeIndex.get(normalizedExtra);
        if (owners?.size && !owners.has(id)) {
          addIssue("error", "duplicate-alternate-work-code", `作品“${code}”的附加番号“${extraCode}”已经属于其他作品。`, { work_code: code, alternate_code: extraCode, candidates: [...owners] });
          continue;
        }
        append.work_codes.push(compactRecord(catalog.work_codes.schema.columns, {
          id: nextId("code"),
          work_id: id,
          code: extraCode,
          normalized_code: normalizedExtra,
          code_type: extra.type ?? "alternate",
          is_primary: String(extra.is_primary ?? false),
          source_id: sourceId,
        }));
        if (!codeIndex.has(normalizedExtra)) codeIndex.set(normalizedExtra, new Set());
        codeIndex.get(normalizedExtra).add(id);
      }
      for (const genreInput of input.genres ?? []) {
        const genreId = resolveSimpleEntity("genre", genreInput);
        if (genreId) append.work_genres.push(compactRecord(catalog.work_genres.schema.columns, { work_id: id, genre_id: genreId }));
      }
      for (const [directorPosition, directorInputRaw] of (input.directors ?? []).entries()) {
        const directorInput = typeof directorInputRaw === "string" ? { name: directorInputRaw } : directorInputRaw;
        const directorId = resolveSimpleEntity("director", directorInput);
        if (directorId) append.work_directors.push(compactRecord(catalog.work_directors.schema.columns, {
          work_id: id,
          director_id: directorId,
          position: directorInput?.position ?? directorPosition + 1,
        }));
      }
      for (const [castPosition, castInputRaw] of (input.cast ?? []).entries()) {
        const castInput = typeof castInputRaw === "string" ? { name: castInputRaw } : castInputRaw;
        const resolved = resolveCastActress(castInput ?? {});
        if (resolved && typeof resolved === "object" && resolved.ambiguous) {
          addIssue("error", "ambiguous-cast", `作品“${code}”的参演者“${castInput?.name ?? castInput?.source_record_id ?? castPosition}”匹配到多个女优。`, { work_code: code, candidates: resolved.ambiguous });
          continue;
        }
        if (!resolved) {
          addIssue("error", "unresolved-cast", `作品“${code}”存在无法解析的参演者“${castInput?.name ?? castInput?.source_record_id ?? castPosition}”。`, { work_code: code, cast: castInput });
          continue;
        }
        append.work_cast.push(compactRecord(catalog.work_cast.schema.columns, {
          work_id: id,
          actress_id: resolved,
          role: castInput?.role ?? "actress",
          position: castInput?.position ?? castPosition + 1,
        }));
      }
    } else {
      matches.push({ entity_type: "work", entity_id: id, source_record_id: sourceRecordId, reason: matchReason });
      newSource("work", id, input);
      const existing = catalog.works.records.find((row) => row.id === id);
      if (existing) {
        for (const [field, incomingField] of [["title","title"],["title_ja","title_ja"],["release_date","release_date"],["duration_min","duration_min"],["description","description"],["cover_url","cover_url"]]) {
          if (!existing[field] && input[incomingField] != null && String(input[incomingField]) !== "") proposals.push({ entity_type: "work", entity_id: id, field, current: "", proposed: String(input[incomingField]), action: "review-only" });
        }
        for (const field of WORK_OBSERVABLE_FIELDS) {
          if (input[field] != null && String(input[field]) !== "") recordObservation("work", id, field, input[field], langForField(field), sourceRecordId);
        }
      }
    }
    if (sourceRecordId) batchWorkBySource.set(sourceRecordId, id);
    if (isNew) {
      codeIndex.set(normalizeCatalogCode(code), new Set([id]));
      for (const field of WORK_OBSERVABLE_FIELDS) {
        if (input[field] != null && String(input[field]) !== "") recordObservation("work", id, field, input[field], langForField(field), sourceRecordId);
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const appendCounts = Object.fromEntries(Object.entries(append).map(([key, rows]) => [key, rows.length]));
  return {
    stage_version: IMPORT_STAGE_VERSION,
    batch_id: options.batchId ?? "",
    prepared_at: createdAt,
    source: document.source,
    catalog_fingerprint: options.fingerprint ?? catalogFingerprint(),
    summary: { error_count: errorCount, match_count: matches.length, proposal_count: proposals.length, append_counts: appendCounts },
    issues,
    matches,
    proposals,
    append,
  };
}

export function renderImportReport(stage) {
  const lines = [];
  lines.push(`# Averia 导入批次报告：${stage.batch_id || "未命名"}`, "");
  lines.push(`- 来源：${stage.source?.name ?? ""}`);
  lines.push(`- 准备时间：${stage.prepared_at}`);
  lines.push(`- 错误：${stage.summary.error_count}`);
  lines.push(`- 已匹配正式实体：${stage.summary.match_count}`);
  lines.push(`- 仅供人工审核的字段补全建议：${stage.summary.proposal_count}`, "");
  lines.push("## 待追加记录", "", "| 数据集 | 数量 |", "| --- | ---: |");
  for (const [dataset, count] of Object.entries(stage.summary.append_counts)) lines.push(`| ${dataset} | ${count} |`);
  lines.push("");
  lines.push("## 问题", "");
  if (!stage.issues.length) lines.push("没有阻塞问题。", "");
  for (const issue of stage.issues) lines.push(`- **${issue.severity} / ${issue.type}**：${issue.message}`);
  lines.push("", "## 已匹配实体", "");
  if (!stage.matches.length) lines.push("无。", "");
  for (const match of stage.matches) lines.push(`- ${match.entity_type} → ${match.entity_id}（${match.reason}）`);
  lines.push("", "## 字段补全建议（不会自动写入）", "");
  if (!stage.proposals.length) lines.push("无。", "");
  for (const proposal of stage.proposals) lines.push(`- ${proposal.entity_type} ${proposal.entity_id}.${proposal.field}: \`${proposal.proposed}\``);
  lines.push("", "## 数据观察（字段级溯源，append-only）", "");
  if (!stage.append.observations.length) lines.push("无。", "");
  for (const obs of stage.append.observations) lines.push(`- ${obs.entity_type} ${obs.entity_id}.${obs.field} ← \`${obs.observed_value}\`（${(obs.source_name ?? "")}${obs.observed_language ? ` / ${obs.observed_language}` : ""}）`);
  lines.push("", "> V0.2 默认只自动追加确定的新实体、关系和来源映射；对已有实体的字段更新只生成建议，不自动覆盖。", "");
  return lines.join("\n");
}

export function importBatchDir(batchId) {
  return path.join(ROOT, "var", "imports", batchId);
}
