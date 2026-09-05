import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCatalog } from "./lib/catalog.mjs";
import { writeCsv } from "./lib/csv.mjs";
import { catalogFingerprint, importBatchDir, parseArgs, pendingReviewCount } from "./import/lib.mjs";
import { syncDatabase } from "./db-sync.mjs";

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

// 写入前先体检：若正式 CSV 处于非法状态，备份到的也会是坏数据，
// 一旦本次 apply 失败，回滚只会把坏数据恢复回来（曾因此留下 39 部悬空 work_cast 的作品）。
// 所以基线不干净时直接拒绝 apply，先让人把 data/ 修回可校验通过的状态。
const preCheck = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-data.mjs")], { cwd: ROOT, encoding: "utf8" });
if (preCheck.status !== 0) {
  if (preCheck.stdout) process.stdout.write(preCheck.stdout);
  if (preCheck.stderr) process.stderr.write(preCheck.stderr);
  console.error("正式 CSV 在写入前就校验失败，拒绝继续应用：请先把 data/ 修复到可校验通过再重试。");
  process.exit(6);
}

const backupDir = path.join(ROOT, "var", "backups", args.batch);
fs.rmSync(backupDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(backupDir), { recursive: true });
fs.cpSync(path.join(ROOT, "data"), backupDir, { recursive: true });

// 兜底回滚：写入一旦开始，只要进程不是正常收尾（例如输出被 head/管道截断触发 EPIPE、
// 被信号中断等），catch 里的回滚就执行不到，data/ 会停在写了一半的坏状态。
// 这里用 exit 钩子兜住：只要没确认写入成功，退出前一律从备份恢复。
// rmSync/cpSync 是同步的，可以在 exit 钩子里安全执行。
let writesStarted = false;
let committed = false;
process.on("exit", () => {
  if (!writesStarted || committed) return;
  try {
    fs.rmSync(path.join(ROOT, "data"), { recursive: true, force: true });
    fs.cpSync(backupDir, path.join(ROOT, "data"), { recursive: true });
    console.error("\n[安全网] 进程异常退出，已自动从备份恢复 data/。");
  } catch (error) {
    console.error(`\n[安全网] 恢复备份失败：${error.message}`);
  }
});

try {
  const catalog = loadCatalog();
  // 先算出每个数据集的「最终行集」＝既有记录 + 本批追加行，最后统一落盘。
  // 关键：不能在这里就写文件、再让下面的 entity_updates 用 dataset.records 覆写——
  // dataset.records 是本次写入前的旧快照，取它重写会把本批刚追加的行整批抹掉
  // （曾因此清空 34 位新女优，留下 39 条悬空 work_cast，触发校验失败回滚）。
  const finalRows = new Map();
  for (const [datasetName, rows] of Object.entries(stage.append ?? {})) {
    if (!rows?.length) continue;
    const dataset = catalog[datasetName];
    if (!dataset) continue; // 跳过 meta 键（entity_aliases / entity_updates 等非数据集）
    finalRows.set(datasetName, [...dataset.records, ...rows]);
  }

  // Phase 4：将字段裁决的 auto_fill（及已裁决 adopt）合并进最终行集。
  // 更新目标可能既有老实体，也可能是本批刚建的新实体，所以统一在最终行集里定位。
  const updates = stage.append?.entity_updates ?? [];
  if (updates.length) {
    for (const u of updates) {
      const dataset = catalog[u.dataset];
      if (!dataset) throw new Error(`未知数据集：${u.dataset}`);
      const rows = finalRows.get(u.dataset) ?? [...dataset.records];
      const rec = rows.find((row) => row.id === u.id);
      if (!rec) throw new Error(`entity_update 找不到 ${u.dataset} ${u.id}`);
      rec[u.field] = u.value;
      finalRows.set(u.dataset, rows);
    }
    console.log(`已合并 ${updates.length} 条字段裁决更新到既有实体。`);
  }

  writesStarted = true;
  for (const [datasetName, rows] of finalRows) {
    const dataset = catalog[datasetName];
    writeCsv(dataset.filePath, dataset.schema.columns, rows);
  }

  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-data.mjs")], { cwd: ROOT, encoding: "utf8" });
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr);
  if (check.status !== 0) throw new Error("写入后的数据校验失败。 ");

  fs.writeFileSync(path.join(dir, "applied.json"), `${JSON.stringify({ batch_id: args.batch, applied_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
  committed = true; // 走到这里说明校验已通过，解除安全网
  console.log(`批次 ${args.batch} 已安全写入正式 CSV。`);
  console.log(`备份目录：${path.relative(ROOT, backupDir)}`);
  console.log("建议继续执行：pnpm data:export && git diff");

  // V0.9：CSV 是唯一事实源，派生库是其物化副本。apply 成功后自动重建，
  // 保证下次查询无需手动 db:sync。派生库失败不影响 CSV 提交结果，仅告警。
  try {
    const sync = syncDatabase();
    console.log(
      `已自动重建 SQLite 派生库：${sync.tables} 表 / ${sync.totalRows} 行 / 全文索引 作品${sync.worksFts}+女优${sync.actressesFts}。`,
    );
  } catch (syncError) {
    console.error(`\n[警告] 自动重建派生库失败（CSV 已提交，不受影响）：${syncError.message}`);
    console.error("       可手动运行 `pnpm db:sync` 重建。");
  }
} catch (error) {
  fs.rmSync(path.join(ROOT, "data"), { recursive: true, force: true });
  fs.cpSync(backupDir, path.join(ROOT, "data"), { recursive: true });
  console.error(`应用失败，已自动恢复备份：${error.message}`);
  process.exit(4);
}
