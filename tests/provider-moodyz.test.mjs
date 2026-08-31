import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildMoodyzUrl, classifyMoodyzUrl, parseMoodyzActress, parseMoodyzWork } from "../scripts/providers/moodyz/lib.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", "moodyz", name), "utf8");
const NOW = "2026-08-31T12:30:00Z";

function dataHashes() {
  const catalog = loadCatalog();
  return Object.fromEntries(Object.entries(catalog).map(([name, dataset]) => [
    name,
    crypto.createHash("sha256").update(fs.readFileSync(dataset.filePath)).digest("hex"),
  ]));
}

test("MOODYZ URL 构造只允许官方作品页和女优页", () => {
  assert.equal(buildMoodyzUrl({ code: "MDVR-434" }), "https://moodyz.com/works/detail/MDVR434");
  assert.equal(buildMoodyzUrl({ actressId: "855540" }), "https://moodyz.com/actress/detail/855540");
  assert.equal(classifyMoodyzUrl("https://moodyz.com/works/detail/MDVR434"), "work");
  assert.equal(classifyMoodyzUrl("https://moodyz.com/actress/detail/855540"), "actress");
  assert.throws(() => classifyMoodyzUrl("https://example.com/works/detail/MDVR434"), /不允许访问的主机/);
});

test("MOODYZ 官方作品页解析为日文权威 canonical JSON", () => {
  const parsed = parseMoodyzWork(fixture("work-mdvr434.html"), "https://moodyz.com/works/detail/MDVR434", NOW);
  assert.equal(parsed.canonical.source.name, "moodyz-official");
  assert.equal(parsed.canonical.source.language, "ja");
  assert.equal(parsed.canonical.source.role, "authoritative");
  assert.equal(parsed.canonical.works.length, 1);
  assert.equal(parsed.canonical.actresses.length, 1);

  const work = parsed.canonical.works[0];
  assert.equal(work.code, "MDVR-434");
  assert.equal(work.title_ja, work.title);
  assert.equal(work.release_date, "2026-08-11");
  assert.equal(work.duration_min, 90);
  assert.deepEqual(work.maker, { name: "MOODYZ", name_ja: "MOODYZ", website_url: "https://moodyz.com/" });
  assert.deepEqual(work.label, { name: "MOODYZ VR", name_ja: "MOODYZ VR" });
  assert.deepEqual(work.genres.map((item) => item.name), ["フェラ", "パイズリ", "騎乗位", "美少女", "メイド", "VR専用"]);
  assert.equal(work.cast[0].source_record_id, "actress:855540");
  assert.deepEqual(work.directors, [{ name: "ジーニアス膝", name_ja: "ジーニアス膝", position: 1 }]);
  assert.equal(work.source_notes, "");
  assert.equal(parsed.meta.title_source, "h2");
});

test("MOODYZ 女优页解析日文名、罗马字、身高和三围", () => {
  const parsed = parseMoodyzActress(fixture("actress-855540.html"), "https://moodyz.com/actress/detail/855540", NOW);
  const actress = parsed.canonical.actresses[0];
  assert.equal(actress.primary_name, "純白彩永");
  assert.equal(actress.name_ja, "純白彩永");
  assert.equal(actress.name_en, "MASHIRO SANA");
  assert.equal(actress.height_cm, 165);
  assert.equal(actress.bust_cm, 93);
  assert.equal(actress.waist_cm, 57);
  assert.equal(actress.hip_cm, 86);
  assert.equal(actress.cup, "H");
  assert.equal(parsed.meta.title_source, "h2");
  assert.deepEqual(parsed.meta.discovered_work_urls, [
    "https://moodyz.com/works/detail/MDVR434",
    "https://moodyz.com/works/detail/MIDV999",
  ]);
});

test("MOODYZ 标题解析可在空 H1 时使用 H2，并可回退到 og:title", () => {
  const fixtureHtml = fixture("work-mdvr434.html");
  const fromH2 = parseMoodyzWork(fixtureHtml, "https://moodyz.com/works/detail/MDVR434", NOW);
  assert.equal(fromH2.meta.title_source, "h2");

  const withoutHeadings = fixtureHtml
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "")
    .replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, "")
    .replace('<meta property="og:image"', `<meta property="og:title" content="${fromH2.canonical.works[0].title_ja} | 人気知名度NO.1！アダルトビデオ最強のAVメーカー MOODYZ公式サイト">\n  <meta property="og:image"`);
  const fromMeta = parseMoodyzWork(withoutHeadings, "https://moodyz.com/works/detail/MDVR434", NOW);
  assert.equal(fromMeta.canonical.works[0].title_ja, fromH2.canonical.works[0].title_ja);
  assert.equal(fromMeta.meta.title_source, "og:title");
});

test("MOODYZ 日文作品进入 Prepare 后保留 title_ja 和官方 taxonomy", () => {
  const parsed = parseMoodyzWork(fixture("work-mdvr434.html"), "https://moodyz.com/works/detail/MDVR434", NOW);
  const stage = prepareImport(parsed.canonical, { batchId: "moodyz-test", now: NOW, catalog: loadCatalog(), fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.works.length, 1);
  assert.equal(stage.append.works[0].title_ja, parsed.canonical.works[0].title_ja);
  assert.equal(stage.append.makers.length, 1);
  assert.equal(stage.append.makers[0].name, "MOODYZ");
  assert.equal(stage.append.labels.length, 1);
  assert.equal(stage.append.labels[0].name, "MOODYZ VR");
  assert.equal(stage.append.genres.length, 6);
  assert.equal(stage.append.directors.length, 1);
  assert.equal(stage.append.directors[0].name, "ジーニアス膝");
  assert.equal(stage.append.work_directors.length, 1);
});

test("MOODYZ Parser 失败时仍保留 raw.html 与失败 meta.json", () => {
  const before = dataHashes();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "averia-moodyz-failed-"));
  const badHtml = path.join(temp, "bad.html");
  const out = path.join(temp, "out");
  fs.writeFileSync(badHtml, "<!doctype html><html><body><main>页面结构已变化</main></body></html>", "utf8");
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "provider-moodyz.mjs"),
    "--file", badHtml,
    "--url", "https://moodyz.com/works/detail/MDVR434",
    "--out", out,
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.ok(fs.existsSync(path.join(out, "raw.html")));
  assert.ok(fs.existsSync(path.join(out, "meta.json")));
  assert.equal(fs.existsSync(path.join(out, "canonical.json")), false);
  const meta = JSON.parse(fs.readFileSync(path.join(out, "meta.json"), "utf8"));
  assert.equal(meta.parse_status, "failed");
  assert.match(meta.parse_error, /无法从 MOODYZ 作品页解析日文标题/);
  assert.deepEqual(dataHashes(), before);
});

test("MOODYZ 离线 CLI 只生成 Provider 产物，不修改正式 CSV", () => {
  const before = dataHashes();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "averia-moodyz-"));
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "provider-moodyz.mjs"),
    "--file", path.join(here, "fixtures", "moodyz", "work-mdvr434.html"),
    "--url", "https://moodyz.com/works/detail/MDVR434",
    "--out", out,
  ], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(out, "raw.html")));
  assert.ok(fs.existsSync(path.join(out, "canonical.json")));
  assert.ok(fs.existsSync(path.join(out, "meta.json")));
  const meta = JSON.parse(fs.readFileSync(path.join(out, "meta.json"), "utf8"));
  assert.equal(meta.network_mode, "offline-file");
  assert.equal(meta.network_transport, "offline-file");
  assert.equal(meta.source_language, "ja");
  assert.equal(meta.source_role, "authoritative");
  assert.deepEqual(dataHashes(), before);
});
