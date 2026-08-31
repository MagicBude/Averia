import fs from "node:fs";
import path from "node:path";
import { readCsv } from "./csv.mjs";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const SCHEMA_DIR = path.join(ROOT, "schemas");

export function loadSchemas() {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith(".schema.json"))
    .sort()
    .map((name) => {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), "utf8"));
      return [path.basename(name, ".schema.json"), schema];
    });
}

export function loadCatalog() {
  const datasets = {};

  for (const [name, schema] of loadSchemas()) {
    const filePath = path.join(ROOT, schema.file);
    const csv = readCsv(filePath);
    datasets[name] = { ...csv, schema, filePath };
  }

  return datasets;
}

export function normalizeCatalogCode(value) {
  return value.trim().toUpperCase().replace(/[\s._-]+/g, "");
}

export function coerceForExport(record, schema) {
  const booleanFields = new Set(schema.booleanFields ?? []);
  const integerFields = new Set(schema.integerFields ?? []);

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value === "") return [key, null];
      if (booleanFields.has(key)) return [key, value === "true"];
      if (integerFields.has(key)) return [key, Number.parseInt(value, 10)];
      return [key, value];
    }),
  );
}
