import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { importBatchDir, parseArgs, renderImportReport } from "./import/lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.batch) {
  console.error("用法：pnpm import:report -- --batch <批次名>");
  process.exit(1);
}
const dir = importBatchDir(args.batch);
const stagePath = path.join(dir, "stage.json");
if (!fs.existsSync(stagePath)) {
  console.error(`找不到批次：${args.batch}`);
  process.exit(1);
}
const stage = JSON.parse(fs.readFileSync(stagePath, "utf8"));
const report = renderImportReport(stage);
fs.writeFileSync(path.join(dir, "report.md"), report, "utf8");
console.log(report);
console.log(`\n报告路径：${path.relative(ROOT, path.join(dir, "report.md"))}`);
