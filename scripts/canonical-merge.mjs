#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { mergeCanonicalDocuments, loadCanonicalFile } from "./canonical/merge.mjs";

function parseCli(argv) {
  const files = [];
  let out = "";
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") continue;
    if (token === "--file") {
      const value = argv[++i];
      if (!value) throw new Error("--file 后必须提供 canonical.json 路径。");
      files.push(value);
      continue;
    }
    if (token === "--out") {
      out = argv[++i] ?? "";
      if (!out) throw new Error("--out 后必须提供输出路径。");
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { help: true, files, out };
    }
    throw new Error(`未知参数：${token}`);
  }
  return { help: false, files, out };
}

function safeSourceName(name) {
  return String(name ?? "canonical").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "canonical";
}

function defaultOut(sourceName) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace(/Z$/, "Z");
  return path.join("var", "canonical", "merged", `${stamp}-${safeSourceName(sourceName)}.json`);
}

function printHelp() {
  console.log(`Averia Canonical Merge\n\n用法：\n  pnpm canonical:merge -- --file <作品 canonical.json> --file <女优 canonical.json> [--out <输出路径>]\n\n规则：\n  - 当前只合并同一 source.name 的 canonical\n  - 同一 source_record_id 会合并为一个实体\n  - 空字段可以由更完整记录补全\n  - 两个非空值冲突时直接失败，不静默覆盖\n  - 输入文件不会被修改，也不会写正式 CSV\n`);
}

try {
  const args = parseCli(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.files.length < 2) throw new Error("请至少提供两个 --file canonical.json。 ");
  const inputs = args.files.map(loadCanonicalFile);
  const merged = mergeCanonicalDocuments(inputs.map((item) => item.document));
  const outPath = path.resolve(args.out || defaultOut(merged.source.name));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log("Averia Canonical Merge 成功。");
  console.log(`来源：${merged.source.name}`);
  console.log(`输入：${inputs.length} 个 canonical`);
  console.log(`合并后女优：${merged.actresses.length}；作品：${merged.works.length}`);
  console.log(`输出：${path.relative(process.cwd(), outPath) || outPath}`);
  console.log("\n下一步只做 Prepare（不会写正式 CSV）：");
  console.log(`pnpm import:prepare -- --file "${path.relative(process.cwd(), outPath) || outPath}" --batch "<批次ID>"`);
  console.log("pnpm import:report -- --batch \"<批次ID>\"");
} catch (error) {
  console.error(`Canonical Merge 失败：${error.message}`);
  process.exit(1);
}
