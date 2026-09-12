#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ROOT, loadCatalog, normalizeCatalogCode } from "./lib/catalog.mjs";

const DEFAULT_LEGACY_ROOT = "D:\\Github\\jav\\jav-idol-db";
const SOURCE_DOMAINS = new Map([
  ["codeav", "codeav.net"], ["javdatabase", "javdatabase.com"],
  ["minnano", "minnano-av.com"], ["javmenu", "javmenu.com"],
  ["javdb", "javdb.com"],
]);

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("ja");
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function peopleValues(record) {
  const values = Array.isArray(record.actresses) ? record.actresses : record.actress ? [record.actress] : [];
  return [...new Set(values.flatMap((value) => typeof value === "string" ? value.split(/[、,，/&]+/u) : [])
    .map((name) => name.trim()).filter(Boolean))];
}

function relationValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => typeof item === "string" ? item.split(/[、,，/]+/u) : [])
    .map((item) => item.trim()).filter(Boolean);
}

function sourceMatchesUrl(source, url) {
  try {
    const expected = SOURCE_DOMAINS.get(source.toLocaleLowerCase("en-US"));
    const hostname = new URL(url).hostname.toLocaleLowerCase("en-US");
    return !expected || hostname === expected || hostname.endsWith(`.${expected}`);
  } catch { return false; }
}

async function collectProfileFiles(root, relative = "") {
  const directory = path.join(root, relative);
  if (!(await stat(directory)).isDirectory()) return [];
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await collectProfileFiles(root, child));
    else if (entry.name === "profile.json") result.push(child);
  }
  return result;
}

export async function auditLegacyData({ legacyRoot = DEFAULT_LEGACY_ROOT, limit, batchSize = 100, resume = false } = {}) {
  const catalog = loadCatalog();
  const workByCode = new Map();
  for (const work of catalog.works.records) workByCode.set(normalizeCatalogCode(work.primary_code), work);
  for (const code of catalog.work_codes.records) if (!workByCode.has(code.normalized_code)) {
    const work = catalog.works.records.find((item) => item.id === code.work_id);
    if (work) workByCode.set(code.normalized_code, work);
  }
  const actressIdsByName = new Map();
  const addName = (id, value) => {
    const key = normalizeName(value); if (!key) return;
    const ids = actressIdsByName.get(key) ?? new Set(); ids.add(id); actressIdsByName.set(key, ids);
  };
  for (const actress of catalog.actresses.records) for (const value of [actress.primary_name, actress.name_ja, actress.name_en, actress.kana]) addName(actress.id, value);
  for (const alias of catalog.actress_aliases.records) addName(alias.actress_id, alias.alias);
  for (const alias of catalog.entity_aliases.records.filter((row) => row.entity_type === "actress")) addName(alias.entity_id, alias.alias);

  const workDirectory = path.join(legacyRoot, "data", "works");
  const actressDirectory = path.join(legacyRoot, "data", "actresses");
  const allWorkFiles = (await readdir(workDirectory)).filter((name) => name.endsWith(".json")).sort();
  const allProfileFiles = (await collectProfileFiles(actressDirectory)).sort();
  const workFiles = allWorkFiles.slice(0, limit ?? allWorkFiles.length);
  const profileFiles = allProfileFiles.slice(0, limit ?? allProfileFiles.length);
  const fingerprint = createHash("sha256");
  const normalizedCodes = new Map();
  const unknownPeople = new Set();
  const unmapped = Object.fromEntries(["makers", "labels", "series", "directors", "tags"].map((key) => [key, new Set()]));
  const report = {
    mode: "dry-run", inputRoot: legacyRoot, inputFingerprint: "", scannedWorks: workFiles.length,
    scannedActresses: profileFiles.length, importableWorks: 0, importableActresses: 0,
    matchedExistingWorks: 0, matchedExistingActresses: 0, expectedNewWorks: 0, expectedNewActresses: 0,
    duplicateCodes: [], multiActressWorks: 0, missingSource: 0, sourceDomainMismatches: 0,
    missingCriticalFields: [], unmatchedPeople: [], canonicalConflicts: [], actressInternalContradictions: [],
    lockedFieldsProtected: 0, unmappedRelations: {}, expectedSourceRecords: 0, expectedObservations: 0,
    options: { limit: limit ?? null, batchSize, resume }, formalWrites: 0,
  };
  for (const fileName of workFiles) {
    const text = await readFile(path.join(workDirectory, fileName), "utf8"); fingerprint.update(fileName).update(text);
    const record = JSON.parse(text); const code = stringValue(record.code); const title = stringValue(record.title);
    const source = stringValue(record.source); const sourceUrl = stringValue(record.source_url);
    if (!code || !title) report.missingCriticalFields.push(`${fileName}: ${!code ? "code" : "title"}`); else report.importableWorks += 1;
    if (!source && !sourceUrl) report.missingSource += 1; else { report.expectedSourceRecords += 1; if (source && sourceUrl && !sourceMatchesUrl(source, sourceUrl)) report.sourceDomainMismatches += 1; }
    if (code) {
      const normalized = normalizeCatalogCode(code); const files = normalizedCodes.get(normalized) ?? []; files.push(fileName); normalizedCodes.set(normalized, files);
      const existing = workByCode.get(normalized);
      if (existing) {
        if (title) report.matchedExistingWorks += 1;
        if (title && ![existing.title, existing.title_ja].includes(title)) report.canonicalConflicts.push({ file: fileName, workId: existing.id, code });
      } else if (title) report.expectedNewWorks += 1;
    }
    const people = peopleValues(record); if (people.length > 1) report.multiActressWorks += 1;
    for (const name of people) if ((actressIdsByName.get(normalizeName(name))?.size ?? 0) !== 1) unknownPeople.add(name);
    report.expectedObservations += ["title", "code", "date", "duration", "cover", "synopsis", "maker", "label", "series", "director", "tags", "actress", "actresses"].filter((key) => hasValue(record[key])).length;
    for (const value of relationValues(record.maker)) unmapped.makers.add(value);
    for (const value of relationValues(record.label ?? record.labels)) unmapped.labels.add(value);
    for (const value of relationValues(record.series)) unmapped.series.add(value);
    for (const value of relationValues(record.director)) unmapped.directors.add(value);
    for (const value of relationValues(record.tags)) unmapped.tags.add(value);
  }
  for (const fileName of profileFiles) {
    const text = await readFile(path.join(actressDirectory, fileName), "utf8"); fingerprint.update(fileName).update(text);
    const record = JSON.parse(text); const name = stringValue(record.name); const source = stringValue(record.source);
    if (name) { report.importableActresses += 1; const count = actressIdsByName.get(normalizeName(name))?.size ?? 0; if (count === 1) report.matchedExistingActresses += 1; else report.expectedNewActresses += 1; }
    else report.missingCriticalFields.push(`${fileName}: name`);
    if (source) report.expectedSourceRecords += 1; else report.missingSource += 1;
    report.expectedObservations += ["name", "aliases", "reading", "roman_name", "birthdate", "height", "bust", "waist", "hips", "measurements", "cup", "debut_date", "debut_year", "retire_date", "comeback_date", "status", "avatar", "photo_url", "official_site", "blog"].filter((key) => hasValue(record[key])).length;
    const debutYear = stringValue(record.debut_year); const debutDate = stringValue(record.debut_date);
    if (debutYear && debutDate?.match(/^\d{4}/u)?.[0] !== debutYear) report.actressInternalContradictions.push(`${name ?? fileName}: debut_year=${debutYear}, debut_date=${debutDate}`);
  }
  report.inputFingerprint = fingerprint.digest("hex");
  report.duplicateCodes = [...normalizedCodes].filter(([, files]) => files.length > 1).map(([normalizedCode, files]) => ({ normalizedCode, files }));
  report.unmatchedPeople = [...unknownPeople].sort();
  report.unmappedRelations = Object.fromEntries(Object.entries(unmapped).map(([key, values]) => [key, [...values].sort()]));
  return report;
}

function option(args, key) { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : undefined; }
function positiveInteger(args, key) { const value = option(args, key); if (!value) return undefined; const number = Number.parseInt(value, 10); if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${key} 必须是正整数。`); return number; }

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--write")) throw new Error("legacy:audit 永远只读；正式写入必须由独立的 Prepare/Apply 命令实现并再次获得授权。");
  const report = await auditLegacyData({ legacyRoot: option(args, "--root") ?? DEFAULT_LEGACY_ROOT, limit: positiveInteger(args, "--limit"), batchSize: positiveInteger(args, "--batch-size") ?? 100, resume: args.includes("--resume") });
  const output = option(args, "--output");
  if (output) { const target = path.resolve(ROOT, output); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8"); }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
