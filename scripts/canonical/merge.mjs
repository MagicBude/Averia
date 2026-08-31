import fs from "node:fs";
import path from "node:path";
import { normalizeCatalogCode } from "../lib/catalog.mjs";
import { normalizeName, stableJson } from "../import/lib.mjs";

export const CANONICAL_MERGE_VERSION = 1;

function isBlank(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function normalizeStatus(value) {
  const text = String(value ?? "").trim();
  return text === "unknown" ? "" : text;
}

function sameValue(a, b) {
  return stableJson(a) === stableJson(b);
}

function latestIso(values) {
  return values.filter(Boolean).map(String).sort().at(-1) ?? "";
}

function entityKey(kind, record, fallbackIndex) {
  if (record?.source_record_id) return `source:${record.source_record_id}`;
  if (kind === "work") {
    const code = normalizeCatalogCode(record?.code ?? record?.primary_code ?? "");
    if (code) return `code:${code}`;
  }
  return `unmerged:${fallbackIndex}`;
}

function arrayItemKey(pathName, item, index) {
  if (typeof item === "string") return `string:${item.normalize("NFKC").trim()}`;
  if (!item || typeof item !== "object") return `index:${index}:${stableJson(item)}`;
  if (pathName.endsWith(".aliases")) {
    return `alias:${normalizeName(item.value ?? item.alias ?? "")}:${item.type ?? ""}:${item.language ?? ""}`;
  }
  if (pathName.endsWith(".genres")) {
    return item.slug ? `slug:${item.slug}` : `genre:${normalizeName(item.name_ja ?? item.name ?? "")}`;
  }
  if (pathName.endsWith(".directors")) {
    return `director:${normalizeName(item.name_ja ?? item.name ?? "")}:${item.position ?? ""}`;
  }
  if (pathName.endsWith(".cast")) {
    return item.source_record_id ? `source:${item.source_record_id}` : `cast:${normalizeName(item.name ?? "")}:${item.position ?? ""}`;
  }
  if (pathName.endsWith(".codes")) {
    return `code:${normalizeCatalogCode(item.code ?? "")}:${item.type ?? ""}`;
  }
  if (item.source_record_id) return `source:${item.source_record_id}`;
  return `json:${stableJson(item)}`;
}

function mergeArrays(left, right, pathName, conflicts) {
  const result = [];
  const indexByKey = new Map();
  for (const item of [...left, ...right]) {
    const key = arrayItemKey(pathName, item, result.length);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, result.length);
      result.push(structuredClone(item));
      continue;
    }
    const index = indexByKey.get(key);
    result[index] = mergeValues(result[index], item, `${pathName}[${key}]`, conflicts);
  }
  return result;
}

function mergeObjects(left, right, pathName, conflicts) {
  const result = structuredClone(left ?? {});
  for (const [key, incoming] of Object.entries(right ?? {})) {
    result[key] = mergeValues(result[key], incoming, pathName ? `${pathName}.${key}` : key, conflicts);
  }
  return result;
}

function mergeValues(current, incoming, pathName, conflicts) {
  if (pathName.endsWith(".fetched_at") || pathName === "source.fetched_at") {
    return latestIso([current, incoming]);
  }
  if (pathName.endsWith(".status")) {
    const a = normalizeStatus(current);
    const b = normalizeStatus(incoming);
    if (!a) return incoming ?? current;
    if (!b) return current;
  }
  if (isBlank(current)) return structuredClone(incoming);
  if (isBlank(incoming)) return structuredClone(current);
  if (sameValue(current, incoming)) return structuredClone(current);
  if (Array.isArray(current) && Array.isArray(incoming)) return mergeArrays(current, incoming, pathName, conflicts);
  if (current && incoming && typeof current === "object" && typeof incoming === "object" && !Array.isArray(current) && !Array.isArray(incoming)) {
    return mergeObjects(current, incoming, pathName, conflicts);
  }
  conflicts.push({ path: pathName, current, incoming });
  return structuredClone(current);
}

function validateDocument(document, index) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error(`输入 ${index + 1} 不是 JSON 对象。`);
  if (document.schema_version !== 1) throw new Error(`输入 ${index + 1} 的 schema_version 必须为 1。`);
  if (!document.source?.name) throw new Error(`输入 ${index + 1} 缺少 source.name。`);
  if (document.actresses != null && !Array.isArray(document.actresses)) throw new Error(`输入 ${index + 1} 的 actresses 必须是数组。`);
  if (document.works != null && !Array.isArray(document.works)) throw new Error(`输入 ${index + 1} 的 works 必须是数组。`);
}

function mergeEntityCollection(kind, documents, conflicts) {
  const map = new Map();
  let fallbackIndex = 0;
  for (const document of documents) {
    const collectionName = kind === "actress" ? "actresses" : "works";
    for (const record of document[collectionName] ?? []) {
      const key = entityKey(kind, record, fallbackIndex++);
      if (!map.has(key)) {
        map.set(key, structuredClone(record));
      } else {
        map.set(key, mergeValues(map.get(key), record, `${kind}[${key}]`, conflicts));
      }
    }
  }
  return [...map.values()];
}

export function mergeCanonicalDocuments(documents, options = {}) {
  if (!Array.isArray(documents) || documents.length < 2) throw new Error("Canonical Merge 至少需要 2 个输入文件。");
  documents.forEach(validateDocument);

  const sourceNames = [...new Set(documents.map((document) => document.source.name))];
  if (sourceNames.length !== 1) {
    throw new Error(`V0.5.0 只允许合并同一来源的 canonical；当前来源：${sourceNames.join(", ")}`);
  }

  const conflicts = [];
  let source = {};
  for (const document of documents) source = mergeValues(source, document.source, "source", conflicts);
  const actresses = mergeEntityCollection("actress", documents, conflicts);
  const works = mergeEntityCollection("work", documents, conflicts);

  if (conflicts.length) {
    const details = conflicts.map((item) => `- ${item.path}: ${JSON.stringify(item.current)} <> ${JSON.stringify(item.incoming)}`).join("\n");
    const error = new Error(`Canonical Merge 发现 ${conflicts.length} 个非空字段冲突，已阻止输出：\n${details}`);
    error.code = "AVERIA_CANONICAL_CONFLICT";
    error.conflicts = conflicts;
    throw error;
  }

  return {
    schema_version: 1,
    source,
    actresses,
    works,
    merge: {
      version: CANONICAL_MERGE_VERSION,
      strategy: "same-source-stable-id",
      input_count: documents.length,
      merged_at: options.now ?? new Date().toISOString(),
    },
  };
}

export function loadCanonicalFile(filePath) {
  const fullPath = path.resolve(filePath);
  return { fullPath, document: JSON.parse(fs.readFileSync(fullPath, "utf8")) };
}
