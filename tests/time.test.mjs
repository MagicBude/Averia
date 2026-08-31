import test from "node:test";
import assert from "node:assert/strict";
import { isValidUtcTimestamp } from "../scripts/lib/time.mjs";

test("UTC 时间戳同时接受秒级和毫秒级 ISO 8601", () => {
  assert.equal(isValidUtcTimestamp("2026-08-31T14:36:25Z"), true);
  assert.equal(isValidUtcTimestamp("2026-08-31T14:36:25.486Z"), true);
  assert.equal(isValidUtcTimestamp("2026-08-31T14:36:25.4Z"), true);
});

test("UTC 时间戳拒绝偏移时区、非法日期和过长小数秒", () => {
  assert.equal(isValidUtcTimestamp("2026-08-31T22:36:25+08:00"), false);
  assert.equal(isValidUtcTimestamp("2026-02-30T14:36:25Z"), false);
  assert.equal(isValidUtcTimestamp("2026-08-31T14:36:25.4867Z"), false);
  assert.equal(isValidUtcTimestamp("2026-08-31 14:36:25Z"), false);
});
