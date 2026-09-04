// scripts/resolution.mjs
//
// V0.8 Phase 4 字段冲突裁决 CLI。
//   node scripts/resolution.mjs report  --batch <id>
//   node scripts/resolution.mjs decide  --batch <id> --entity-type work --entity-id work_00000X --field release_date --decision adopt|keep
//
// 不写正式 CSV：仅修改 var/imports/<batch>/stage.json 中的 field_resolutions 状态，
// 把 pending_review 翻转为 manual，并（adopt 时）追加 entity_update，使 import:apply 可以放行。

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/catalog.mjs";
import { importBatchDir, parseArgs, pendingReviewCount, applyResolutionDecision } from "./import/lib.mjs";

const argv = process.argv.slice(2);
const sub = argv[0];
const args = parseArgs(argv.slice(1));
const batch = args.batch;

if (!batch) {
  console.error("用法：node scripts/resolution.mjs <report|decide> --batch <批次名> [--entity-type <类型> --entity-id <ID> --field <字段> --decision adopt|keep]");
  process.exit(1);
}

const dir = importBatchDir(batch);
const stagePath = path.join(dir, "stage.json");
if (!fs.existsSync(stagePath)) {
  console.error(`找不到批次：${batch}（期望 ${stagePath}）`);
  process.exit(1);
}

const readStage = () => JSON.parse(fs.readFileSync(stagePath, "utf8"));

function cmdReport() {
  const stage = readStage();
  const pending = (stage.append?.field_resolutions ?? []).filter((r) => r.status === "pending_review");
  const auto = (stage.append?.field_resolutions ?? []).filter((r) => r.status === "auto");
  console.log(`批次 ${batch} 字段裁决：`);
  console.log(`- 自动补全（auto_fill）：${auto.length}`);
  console.log(`- 待人工裁决（pending_review）：${pending.length}`);
  if (!pending.length) {
    console.log("无待裁决冲突。");
    return;
  }
  console.log("\n待裁决冲突（运行 decide 处理后才能 import:apply）：");
  for (const r of pending) {
    console.log(`- ${r.entity_type} ${r.entity_id}.${r.field}`);
    console.log(`    ${r.notes}`);
  }
}

function cmdDecide() {
  const entityType = args["entity-type"];
  const entityId = args["entity-id"];
  const field = args.field;
  const decision = args.decision;
  if (!entityType || !entityId || !field || !decision) {
    console.error("decide 需要：--entity-type <类型> --entity-id <ID> --field <字段> --decision adopt|keep");
    process.exit(1);
  }
  if (decision !== "adopt" && decision !== "keep") {
    console.error("--decision 只能是 adopt 或 keep");
    process.exit(1);
  }
  const stage = readStage();
  if (pendingReviewCount(stage) === 0) {
    console.error("批次没有待裁决冲突。");
    process.exit(1);
  }
  const nextStage = applyResolutionDecision(stage, { entityType, entityId, field, decision });
  const backupPath = path.join(dir, "stage.resolution-backup.json");
  fs.copyFileSync(stagePath, backupPath);
  fs.writeFileSync(stagePath, `${JSON.stringify(nextStage, null, 2)}\n`, "utf8");
  console.log(`已裁决 ${entityType} ${entityId}.${field} → ${decision}（pending_review 剩余 ${pendingReviewCount(nextStage)}）。`);
  if (decision === "adopt") console.log("已追加 entity_update，import:apply 将写入该来源值。");
  console.log(`原 stage.json 备份于 ${path.relative(ROOT, backupPath)}。`);
}

if (sub === "report") cmdReport();
else if (sub === "decide") cmdDecide();
else {
  console.error(`未知子命令：${sub}（可用 report / decide）`);
  process.exit(1);
}
