import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { catalogFingerprint, importBatchDir, loadImportDocument, parseArgs, prepareImport, renderImportReport } from "./import/lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("用法：pnpm import:prepare -- --file <导入JSON> [--batch <批次名>]");
  process.exit(1);
}

const { document, fullPath } = loadImportDocument(args.file);
const defaultBatch = `${document.source.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
const batchId = String(args.batch || defaultBatch).replace(/[^a-zA-Z0-9._-]+/g, "-");
const dir = importBatchDir(batchId);
if (fs.existsSync(path.join(dir, "applied.json"))) {
  console.error(`批次 ${batchId} 已经应用过，不能覆盖。`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
const stage = prepareImport(document, { batchId, fingerprint: catalogFingerprint() });
fs.writeFileSync(path.join(dir, "input.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(dir, "stage.json"), `${JSON.stringify(stage, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(dir, "report.md"), renderImportReport(stage), "utf8");

console.log(`已准备导入批次：${batchId}`);
console.log(`输入文件：${path.relative(ROOT, fullPath)}`);
console.log(`暂存目录：${path.relative(ROOT, dir)}`);
console.log(`阻塞错误：${stage.summary.error_count}`);
console.log("下一步：先查看 report.md；确认无误后再执行 import:apply。 ");
if (stage.summary.error_count) process.exitCode = 2;
