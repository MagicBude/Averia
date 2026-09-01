import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildJavlibraryUrl, normalizeJavlibraryUrl, parseJavlibraryWork } from "../scripts/providers/javlibrary/lib.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", "javlibrary", name), "utf8");
const NOW = "2026-09-01T08:30:00Z";
const SAMPLE_URL = "https://www.javlibrary.com/ja/?v=javmezzbqu";

test("JavLibrary URL 构造与主机白名单", () => {
  assert.equal(buildJavlibraryUrl({ code: "IPZZ-597" }), "https://www.javlibrary.com/ja/vl_searchbyid.php?keyword=IPZZ-597");
  assert.throws(() => normalizeJavlibraryUrl("https://example.com/x"), /不允许访问的主机/);
  assert.throws(() => normalizeJavlibraryUrl("http://www.javlibrary.com/x"), /只允许 HTTPS/);
});

test("JavLibrary 作品页可解析为 Averia 统一导入 JSON（复用 OpenAver 解析思路）", () => {
  const parsed = parseJavlibraryWork(fixture("work-ipzz-597.html"), SAMPLE_URL, NOW);
  assert.equal(parsed.canonical.source.name, "javlibrary");
  assert.equal(parsed.canonical.source.language, "ja");
  assert.equal(parsed.canonical.source.role, "supplemental");
  assert.equal(parsed.canonical.works.length, 1);
  assert.equal(parsed.canonical.actresses.length, 2);

  const work = parsed.canonical.works[0];
  assert.equal(work.code, "IPZZ-597");
  assert.equal(work.title, "タイトル例");
  assert.equal(work.title_ja, "タイトル例");
  assert.equal(work.release_date, "2026-08-25");
  assert.equal(work.duration_min, 120);
  assert.deepEqual(work.maker, { name: "アイデアポケット", name_ja: "アイデアポケット" });
  assert.deepEqual(work.label, { name: "ティッシュ", name_ja: "ティッシュ" });
  assert.deepEqual(work.series, { name: "引退作", name_ja: "引退作" });
  assert.deepEqual(work.directors, [{ name: "ジーニアス膝", name_ja: "ジーニアス膝", position: 1 }]);
  assert.equal(work.genres.length, 2);
  assert.equal(work.genres[0].name, "スレンダー");
  assert.equal(work.genres[0].name_ja, "スレンダー");
  assert.ok(typeof work.genres[0].slug === "string" && work.genres[0].slug.length > 0);

  assert.equal(work.cast.length, 2);
  assert.deepEqual(work.cast[0], { name: "桃乃木かな", position: 1, source_record_id: "actress:momonogi" });
  assert.deepEqual(work.cast[1], { name: "女優B", position: 2, source_record_id: "actress:akiko" });

  assert.equal(parsed.canonical.actresses[0].source_record_id, "actress:momonogi");
  assert.equal(parsed.canonical.actresses[0].primary_name, "桃乃木かな");
  assert.equal(parsed.canonical.actresses[0].name_ja, "桃乃木かな");
  assert.equal(work.cover_url, "https://www.javlibrary.com/ja/images/cover/ipzz-597.jpg");
  assert.equal(parsed.meta.sample_image_count, 2);
});

test("JavLibrary 作品进入 Prepare 不报错，且番号写入 work_codes", () => {
  const catalog = loadCatalog();
  const parsed = parseJavlibraryWork(fixture("work-ipzz-597.html"), SAMPLE_URL, NOW);
  const stage = prepareImport(parsed.canonical, { catalog, batchId: "provider-test", now: NOW, fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.work_codes.length, 1);
  assert.equal(stage.append.work_codes[0].code, "IPZZ-597");
});

test("离线 CLI 只生成 Provider 产物，不修改正式 CSV", () => {
  const repoRoot = path.resolve(here, "..");
  const formal = [
    "data/actresses/actresses.csv",
    "data/actresses/actress_aliases.csv",
    "data/works/works.csv",
    "data/works/work_codes.csv",
    "data/relations/work_cast.csv",
    "data/relations/work_genres.csv",
    "data/relations/work_directors.csv",
    "data/taxonomy/makers.csv",
    "data/taxonomy/labels.csv",
    "data/taxonomy/series.csv",
    "data/taxonomy/genres.csv",
    "data/taxonomy/directors.csv",
    "data/sources/source_records.csv",
  ];
  const before = new Map(formal.map((rel) => [rel, sha256(path.join(repoRoot, rel))]));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "averia-javlibrary-"));
  try {
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts/provider-javlibrary.mjs"),
      "--file", path.join(here, "fixtures/javlibrary/work-ipzz-597.html"),
      "--url", SAMPLE_URL,
      "--out", out,
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(out, "raw.html")));
    assert.ok(fs.existsSync(path.join(out, "canonical.json")));
    assert.ok(fs.existsSync(path.join(out, "meta.json")));
    for (const rel of formal) assert.equal(sha256(path.join(repoRoot, rel)), before.get(rel), rel);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
