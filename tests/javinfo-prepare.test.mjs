import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJavinfoMovieResponse } from "../scripts/providers/javinfo/lib.mjs";
import { prepareImport, catalogFingerprint, pendingReviewCount } from "../scripts/import/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, "fixtures", "javinfo", "ipzz-597.json");

// V0.8 Phase 6 离线回归：用真实 JavInfo 响应（IPZZ-597 / 桃乃木かな / Kana Momonogi）
// 走完整 prepareImport，验证「跨语言归并不建重 + 冲突人工裁决阻断」机制。
test("JavInfo IPZZ-597 canonical 触发 V0.8 三表与冲突阻断", () => {
  const payload = JSON.parse(fs.readFileSync(FIX, "utf8"));
  const { canonical } = parseJavinfoMovieResponse(payload, new Date().toISOString(), { code: "IPZZ-597" });
  const stage = prepareImport(canonical, { batchId: "test-ipzz597", fingerprint: catalogFingerprint() });
  const a = stage.append;

  assert.ok((a.observations ?? []).length > 0, "应产生字段级 observations");
  assert.ok((a.field_resolutions ?? []).length > 0, "应产生 field_resolutions");

  // IPZZ-597 与桃乃木かな已存在于 catalog（metatube 批量灌库带入），不应重复新建实体。
  assert.equal((a.works ?? []).length, 0, "作品不应重复新建");
  assert.equal((a.actresses ?? []).length, 0, "女优不应重复新建");

  // 日文 primary_name 与 JavInfo 英文主名冲突 → pending_review 阻断自动覆盖。
  const pending = (a.field_resolutions ?? []).filter((r) => r.status === "pending_review");
  assert.ok(pending.length > 0, "应存在 pending_review 冲突裁决");
  assert.ok(pending.some((r) => r.field === "primary_name"), "primary_name 冲突应被 pending_review 阻断");
  assert.equal(pendingReviewCount(stage), pending.length);
});
