import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditLegacyData } from "../scripts/legacy-audit.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "averia-legacy-audit-"));
  fs.mkdirSync(path.join(root, "data", "works"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "actresses", "sample"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "works", "IPZZ-597.json"), JSON.stringify({ code: "ipzz_597", title: "冲突标题", actresses: ["桃乃木かな", "新人物"], source: "javdatabase", source_url: "https://www.javdatabase.com/movies/ipzz-597/", tags: ["Sample"] }));
  fs.writeFileSync(path.join(root, "data", "works", "MISSING.json"), JSON.stringify({ code: "MISSING-1", source: "javdb", source_url: "https://javdb.com/v/example" }));
  fs.writeFileSync(path.join(root, "data", "actresses", "sample", "profile.json"), JSON.stringify({ name: "新人物", source: "minnano", debut_year: "2020", debut_date: "2021-01-01" }));
  return root;
}

test("legacy audit 全程只读并报告匹配、缺字段、多女优与人物矛盾", async (t) => {
  const root = fixtureRoot(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = fs.readdirSync(path.join(root, "data", "works"));
  const report = await auditLegacyData({ legacyRoot: root });
  assert.equal(report.mode, "dry-run"); assert.equal(report.formalWrites, 0);
  assert.equal(report.scannedWorks, 2); assert.equal(report.importableWorks, 1);
  assert.equal(report.matchedExistingWorks, 1); assert.equal(report.expectedNewWorks, 0);
  assert.equal(report.multiActressWorks, 1); assert.equal(report.canonicalConflicts.length, 1);
  assert.equal(report.actressInternalContradictions.length, 1);
  assert.deepEqual(fs.readdirSync(path.join(root, "data", "works")), before);
});

test("legacy audit 的 limit 与指纹是确定性的", async (t) => {
  const root = fixtureRoot(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = await auditLegacyData({ legacyRoot: root, limit: 1 });
  const second = await auditLegacyData({ legacyRoot: root, limit: 1 });
  assert.equal(first.scannedWorks, 1); assert.equal(first.scannedActresses, 1);
  assert.equal(first.inputFingerprint, second.inputFingerprint);
});
