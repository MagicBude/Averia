import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildJavdatabaseUrl, classifyJavdatabaseUrl, parseJavdatabaseActress, parseJavdatabaseWork } from "../scripts/providers/javdatabase/lib.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", "javdatabase", name), "utf8");
const NOW = "2026-08-31T08:30:00Z";

test("JAVDatabase URL 构造与类型判断只允许受支持的单页", () => {
  assert.equal(buildJavdatabaseUrl({ code: "SDAM-179" }), "https://www.javdatabase.com/movies/sdam-179/");
  assert.equal(classifyJavdatabaseUrl("https://www.javdatabase.com/idols/sachi-yamada/"), "actress");
  assert.throws(() => classifyJavdatabaseUrl("https://example.com/movies/sdam-179/"), /不允许访问的主机/);
});

test("JAVDatabase 作品页可以解析为 Averia 统一导入 JSON", () => {
  const parsed = parseJavdatabaseWork(fixture("movie-sdam-179.html"), "https://www.javdatabase.com/movies/sdam-179/", NOW);
  assert.equal(parsed.canonical.source.name, "javdatabase");
  assert.equal(parsed.canonical.source.language, "en");
  assert.equal(parsed.canonical.source.role, "supplemental");
  assert.equal(parsed.canonical.works.length, 1);
  assert.equal(parsed.canonical.actresses.length, 1);
  const work = parsed.canonical.works[0];
  assert.equal(work.code, "SDAM-179");
  assert.equal(work.title, "Sachi Yamada debut work");
  assert.equal(work.release_date, "2026-08-25");
  assert.equal(work.duration_min, 153);
  assert.deepEqual(work.maker, { name: "SOD Create" });
  assert.deepEqual(work.genres.map((g) => g.slug), ["amateur", "debut", "hi-def"]);
  assert.equal(work.cast[0].source_record_id, "actress:sachi-yamada");
  assert.deepEqual(work.codes, [{ code: "1sdam00179", type: "content-id", is_primary: false }]);
});

test("JAVDatabase 女优页保留不完整日期为空值，并发现作品 URL", () => {
  const parsed = parseJavdatabaseActress(fixture("idol-sachi-yamada.html"), "https://www.javdatabase.com/idols/sachi-yamada/", NOW);
  const actress = parsed.canonical.actresses[0];
  assert.equal(actress.source_record_id, "actress:sachi-yamada");
  assert.equal(actress.primary_name, "Sachi Yamada");
  assert.equal(actress.name_ja, "山田さち");
  assert.equal(actress.birth_date, "");
  assert.equal(actress.debut_date, "2026-08-25");
  assert.deepEqual(parsed.meta.discovered_work_urls, ["https://www.javdatabase.com/movies/sdam-179/"]);
  assert.ok(!parsed.meta.discovered_work_urls.some((url) => url.includes("stol-139")), "不应把页脚 Recent Comments 的作品链接误判为女优作品");
});

test("JAVDatabase 作品的 Content ID 会作为附加番号进入 Stage", () => {
  const catalog = loadCatalog();
  const parsed = parseJavdatabaseWork(fixture("movie-sdam-179.html"), "https://www.javdatabase.com/movies/sdam-179/", NOW);
  const stage = prepareImport(parsed.canonical, { catalog, batchId: "provider-test", now: NOW, fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.work_codes.length, 2);
  const contentCode = stage.append.work_codes.find((row) => row.code === "1sdam00179");
  assert.ok(contentCode);
  assert.equal(contentCode.code_type, "content-id");
  assert.equal(contentCode.is_primary, "false");
});


function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

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
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "averia-provider-"));
  try {
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts/provider-javdatabase.mjs"),
      "--file", path.join(here, "fixtures/javdatabase/movie-sdam-179.html"),
      "--url", "https://www.javdatabase.com/movies/sdam-179/",
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
