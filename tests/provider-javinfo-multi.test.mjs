import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMulti } from "../scripts/provider-javinfo-multi.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(__dirname, "fixtures", "javinfo", "multi");

test("provider:javinfo:multi 对三个来源独立落盘，source_name 与来源对应", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "averia-javinfo-multi-"));
  try {
    const results = await runMulti({
      code: "IPZZ-597",
      sources: ["fanza", "dmm", "javdatabase"],
      outBaseDir: tmp,
      fixtures: {
        fanza: path.join(FX, "fanza.json"),
        dmm: path.join(FX, "dmm.json"),
        javdatabase: path.join(FX, "javdatabase.json"),
      },
      noImages: true,
    });

    assert.equal(results.length, 3);
    for (const r of results) {
      const dir = path.join(tmp, r.source);
      assert.ok(fs.existsSync(path.join(dir, "raw.json")), `${r.source}/raw.json 应存在`);
      assert.ok(fs.existsSync(path.join(dir, "canonical.json")), `${r.source}/canonical.json 应存在`);
      assert.ok(fs.existsSync(path.join(dir, "meta.json")), `${r.source}/meta.json 应存在`);

      const canonical = JSON.parse(fs.readFileSync(path.join(dir, "canonical.json"), "utf8"));
      assert.equal(canonical.works[0].code, "IPZZ-597");
      assert.equal(r.source_name, `javinfo-${r.source}`);
      assert.equal(r.workCount, 1);
      assert.equal(r.actressCount, 1);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("provider:javinfo:multi 离线模式下缺少 fixture 且无 fetchImpl 时抛错", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "averia-javinfo-multi-"));
  try {
    await assert.rejects(
      () => runMulti({ code: "IPZZ-597", sources: ["fanza"], outBaseDir: tmp, fixtures: {} }),
      /未提供 --file-fanza|无法离线运行/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
