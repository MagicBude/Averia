import fs from "node:fs";
import path from "node:path";
import { coerceForExport, loadCatalog, ROOT } from "./lib/catalog.mjs";

const catalog = loadCatalog();
const outDir = path.join(ROOT, "exports", "json");
fs.mkdirSync(outDir, { recursive: true });

const combined = { schemaVersion: 1, datasets: {} };

for (const [name, dataset] of Object.entries(catalog)) {
  const records = dataset.records.map((record) => coerceForExport(record, dataset.schema));
  combined.datasets[name] = records;

  fs.writeFileSync(
    path.join(outDir, `${name}.json`),
    `${JSON.stringify({ schemaVersion: 1, data: records }, null, 2)}\n`,
    "utf8",
  );
}

fs.writeFileSync(
  path.join(outDir, "averia.json"),
  `${JSON.stringify(combined, null, 2)}\n`,
  "utf8",
);

console.log(`已在 exports/json/ 生成 ${Object.keys(catalog).length + 1} 个 JSON 导出文件。`);
