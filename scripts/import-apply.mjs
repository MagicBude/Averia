import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCatalog } from "./lib/catalog.mjs";
import { writeCsv } from "./lib/csv.mjs";
import { catalogFingerprint, importBatchDir, parseArgs, pendingReviewCount } from "./import/lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.batch) {
  console.error("用法：pnpm import:apply -- --batch <批次名>");
  process.exit(1);
}
const dir = importBatchDir(args.batch);
const stagePath = path.join(dir, "stage.json");
if (!fs.existsSync(stagePath)) {
  console.error(`找不到批次：${args.batch}`);
  process.exit(1);
}
if (fs.existsSync(path.join(dir, "applied.json"))) {
  console.error(`批次 ${args.batch} 已经应用过。`);
  process.exit(1);
}
const stage = JSON.parse(fs.readFileSync(stagePath, "utf8"));
if ((stage.summary?.error_count ?? 0) > 0) {
  console.error(`批次仍有 ${stage.summary.error_count} 个阻塞错误，拒绝写入正式 CSV。`);
  process.exit(2);
}
const currentFingerprint = catalogFingerprint();
if (currentFingerprint !== stage.catalog_fingerprint) {
  console.error("正式 CSV 在 prepare 之后发生了变化。请重新执行 import:prepare，避免基于过期数据写入。 ");
  process.exit(3);
}

// Phase 4：存在待人工裁决的字段冲突时，阻断整个 Apply（对应 AGENTS “冲突不可静默解决”）。
const pending = pendingReviewCount(stage);
if (pending > 0) {
  console.error(`批次存在 ${pending} 个待人工裁决的字段冲突（pending_review），拒绝写入。`);
  console.error("先运行：pnpm resolution:report -- --batch " + args.batch + "  查看冲突双方值；");
  console.error("再运行：pnpm resolution:decide -- --batch " + args.batch + " --entity-type <类型> --entity-id <ID> --field <字段> --decision adopt|keep");
  process.exit(5);
}

const backupDir = path.join(ROOT, "var", "backups", args.batch);
fs.rmSync(backupDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(backupDir), { recursive: true });
fs.cpSync(path.join(ROOT, "data"), backupDir, { recursive: true });

try {
  const catalog = loadCatalog();
  for (const [datasetName, rows] of Object.entries(stage.append ?? {})) {
    if (!rows?.length) continue;
    const dataset = catalog[datasetName];
    if (!dataset) continue; // 跳过 meta 键（observations / field_resolutions / entity_aliases / entity_updates）
    writeCsv(dataset.filePath, dataset.schema.columns, [...dataset.records, ...rows]);
  }

  // Phase 4：将字段裁决的 auto_fill（及已裁决 adopt）合并进既有实体记录。
  const updates = stage.append?.entity_updates ?? [];
  if (updates.length) {
    const affected = new Set();
    for (const u of updates) {
      const dataset = catalog[u.dataset];
      if (!dataset) throw new Error(`未知数据集：${u.dataset}`);
      const rec = dataset.records.find((row) => row.id === u.id);
      if (!rec) throw new Error(`entity_update 找不到 ${u.dataset} ${u.id}`);
      rec[u.field] = u.value;
      affected.add(u.dataset);
    }
    for (const ds of affected) {
      const dataset = catalog[ds];
      writeCsv(dataset.filePath, dataset.schema.columns, dataset.records);
    }
    console.log(`已合并 ${updates.length} 条字段裁决更新到既有实体。`);
  }

  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-data.mjs")], { cwd: ROOT, encoding: "utf8" });
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr);
  if (check.status !== 0) throw new Error("写入后的数据校验失败。 ");

  fs.writeFileSync(path.join(dir, "applied.json"), `${JSON.stringify({ batch_id: args.batch, applied_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
  console.log(`批次 ${args.batch} 已安全写入正式 CSV。`);
  console.log(`备份目录：${path.relative(ROOT, backupDir)}`);
  console.log("建议继续执行：pnpm data:export && git diff");
} catch (error) {
  fs.rmSync(path.join(ROOT, "data"), { recursive: true, force: true });
  fs.cpSync(backupDir, path.join(ROOT, "data"), { recursive: true });
  console.error(`应用失败，已自动恢复备份：${error.message}`);
  process.exit(4);
}
