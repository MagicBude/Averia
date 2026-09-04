import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../scripts/lib/catalog.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/resolve-link.mjs", import.meta.url));

// 本测试只走 --dry-run 与守卫路径，绝不写入正式 CSV。
function run(argv) {
  try {
    return { code: 0, stdout: execFileSync(process.execPath, [scriptPath, ...argv], { encoding: "utf8" }), stderr: "" };
  } catch (error) {
    return { code: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("resolve:link --help 输出用法说明", () => {
  const result = run(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /--alias/);
  assert.match(result.stdout, /--entity/);
  assert.match(result.stdout, /--type/);
});

test("resolve:link 拒绝未知的别名类型", () => {
  const result = run(["--alias", "X", "--entity", "maker_000001", "--type", "bogus"]);
  assert.equal(result.code, 1);
});

test("resolve:link 拒绝不存在的实体", () => {
  const result = run(["--alias", "X", "--entity", "maker_999999", "--type", "en"]);
  assert.equal(result.code, 1);
});

test("resolve:link 缺少必填参数时输出用法并失败", () => {
  const result = run(["--alias", "X"]);
  assert.equal(result.code, 1);
  assert.match(result.stdout + result.stderr, /--entity/);
});

test("resolve:link --dry-run 只预览，不写入正式 CSV", () => {
  const before = loadCatalog().entity_aliases.records.length;
  // 不假设目录为空：取真实目录中第一个厂商实体
  const maker = loadCatalog().makers.records[0];
  assert.ok(maker, "正式目录应至少有一个厂商实体");

  const result = run(["--alias", "Dry Run Maker", "--entity", maker.id, "--type", "en", "--dry-run"]);
  assert.equal(result.code, 0, `dry-run 应成功：${result.stderr}`);
  assert.match(result.stdout, /Dry Run Maker/);

  const after = loadCatalog().entity_aliases.records.length;
  assert.equal(after, before, "--dry-run 不得写入正式 CSV");
});
