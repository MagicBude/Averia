import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeCanonicalDocuments } from "../scripts/canonical/merge.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";
import { parseMoodyzActress, parseMoodyzWork } from "../scripts/providers/moodyz/lib.mjs";
import { loadEmptyCatalog } from "./helpers/catalog.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", "moodyz", name), "utf8");
const NOW = "2026-08-31T14:40:00Z";

function moodyzPair() {
  const work = parseMoodyzWork(fixture("work-mdvr434.html"), "https://moodyz.com/works/detail/MDVR434", "2026-08-31T14:18:50Z").canonical;
  const actress = parseMoodyzActress(fixture("actress-855540.html"), "https://moodyz.com/actress/detail/855540", "2026-08-31T14:36:25Z").canonical;
  return { work, actress };
}

test("同一 MOODYZ source_record_id 会把作品页半成品女优与女优页完整资料合并", () => {
  const { work, actress } = moodyzPair();
  const merged = mergeCanonicalDocuments([work, actress], { now: NOW });
  assert.equal(merged.actresses.length, 1);
  assert.equal(merged.works.length, 1);
  const person = merged.actresses[0];
  assert.equal(person.source_record_id, "actress:855540");
  assert.equal(person.primary_name, "純白彩永");
  assert.equal(person.name_en, "MASHIRO SANA");
  assert.equal(person.height_cm, 165);
  assert.equal(person.bust_cm, 93);
  assert.equal(person.waist_cm, 57);
  assert.equal(person.hip_cm, 86);
  assert.equal(person.cup, "H");
  assert.match(person.profile_image_url, /\/actress_main\/855540\//);
  assert.deepEqual(person.aliases, [{ value: "MASHIRO SANA", type: "romanized", language: "en" }]);
  assert.equal(merged.source.fetched_at, "2026-08-31T14:36:25Z");
  assert.equal(merged.merge.input_count, 2);
});

test("合并后的 MOODYZ canonical 一次 Prepare 即可建立完整女优、作品与关系", () => {
  const { work, actress } = moodyzPair();
  const merged = mergeCanonicalDocuments([work, actress], { now: NOW });
  const stage = prepareImport(merged, { catalog: loadEmptyCatalog(), batchId: "merged-test", now: NOW, fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.actresses.length, 1);
  assert.equal(stage.append.actress_aliases.length, 1);
  assert.equal(stage.append.works.length, 1);
  assert.equal(stage.append.work_cast.length, 1);
  assert.equal(stage.append.work_genres.length, 6);
  assert.equal(stage.append.work_directors.length, 1);
  assert.equal(stage.append.source_records.length, 2);
  assert.equal(stage.append.actresses[0].name_en, "MASHIRO SANA");
  assert.equal(stage.append.actresses[0].height_cm, "165");
});

test("同一权威来源的两个非空字段冲突会阻止 Canonical Merge", () => {
  const { work, actress } = moodyzPair();
  const bad = structuredClone(actress);
  bad.actresses[0].height_cm = 166;
  const workWithHeight = structuredClone(work);
  workWithHeight.actresses[0].height_cm = 165;
  assert.throws(() => mergeCanonicalDocuments([workWithHeight, bad], { now: NOW }), /非空字段冲突/);
});

test("Canonical Merge CLI 生成新文件且不修改输入", () => {
  const { work, actress } = moodyzPair();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "averia-canonical-merge-"));
  const workPath = path.join(temp, "work.json");
  const actressPath = path.join(temp, "actress.json");
  const outPath = path.join(temp, "merged.json");
  fs.writeFileSync(workPath, `${JSON.stringify(work, null, 2)}\n`);
  fs.writeFileSync(actressPath, `${JSON.stringify(actress, null, 2)}\n`);
  const beforeWork = fs.readFileSync(workPath, "utf8");
  const beforeActress = fs.readFileSync(actressPath, "utf8");

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "canonical-merge.mjs"),
    "--file", workPath,
    "--file", actressPath,
    "--out", outPath,
  ], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(outPath));
  const merged = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(merged.actresses.length, 1);
  assert.equal(merged.works.length, 1);
  assert.equal(fs.readFileSync(workPath, "utf8"), beforeWork);
  assert.equal(fs.readFileSync(actressPath, "utf8"), beforeActress);
});
