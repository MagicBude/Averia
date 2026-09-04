import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  parseMetatubeMovieResponse,
  parseMetatubeActorResponse,
  providerLanguage,
  sourceName,
} from "../scripts/providers/metatube/lib.mjs";
import { loadEmptyCatalog } from "./helpers/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(here, "fixtures", "metatube", name), "utf8"));
const NOW = "2026-09-04T00:00:00Z";
const MOVIE = fixture("movie-ipzz-597.json");

test("providerLanguage / sourceName 按源归类", () => {
  assert.equal(providerLanguage("fanza"), "ja");
  assert.equal(providerLanguage("madouqu"), "zh");
  assert.equal(providerLanguage("theporndb"), "en");
  assert.equal(sourceName("fanza"), "metatube-fanza");
});

test("解析 fanza 电影响应为 Averia canonical（含日文名映射）", () => {
  const { canonical, meta } = parseMetatubeMovieResponse(MOVIE, NOW, { provider: "fanza" });
  assert.equal(canonical.source.name, "metatube-fanza");
  assert.equal(canonical.source.language, "ja");
  assert.equal(canonical.source.role, "reference");

  const work = canonical.works[0];
  assert.equal(work.code, "IPZZ-597");
  assert.equal(work.title, "素人妻のふしだらな誘惑");
  assert.equal(work.title_ja, "素人妻のふしだらな誘惑");
  assert.equal(work.release_date, "2022-03-15");
  assert.equal(work.duration_min, 120);
  assert.deepEqual(work.maker, { name: "アイデアポケット", name_ja: "アイデアポケット" });
  assert.deepEqual(work.label, { name: "ディッシュ", name_ja: "ディッシュ" });
  assert.equal(work.genres.length, 3);
  assert.ok(work.genres[0].slug.startsWith("metatube-fanza-"));
  assert.deepEqual(work.directors, [{ name: "稲葉りお", name_ja: "稲葉りお", position: 1 }]);
  assert.equal(work.cast.length, 1);
  assert.equal(work.cast[0].name, "桃乃木かな");
  assert.equal(work.cover_url, "https://pics.dmm.co.jp/digital/videoa/ipzz00597/ipzz00597pl.jpg");

  // ADR-0002：作品富字段（summary→description / thumb_url / backdrop_url / score）
  assert.equal(work.description, "ある日、隣に引っ越してきたのは昔の同級生だった。");
  assert.equal(work.thumb_url, "https://pics.dmm.co.jp/digital/videoa/ipzz00597/ipzz00597pt.jpg");
  assert.equal(work.backdrop_url, "https://pics.dmm.co.jp/digital/videoa/ipzz00597/ipzz00597bd.jpg");
  assert.equal(work.score, 4.2);

  // 女优被展开到 actresses
  assert.equal(canonical.actresses.length, 1);
  assert.equal(canonical.actresses[0].primary_name, "桃乃木かな");
  assert.equal(canonical.actresses[0].name_ja, "桃乃木かな");
  assert.equal(meta.movie_number, "IPZZ-597");
});

test("解析女优响应映射三围/血型等到 actress schema 字段", () => {
  const payload = {
    data: {
      id: "12345",
      name: "桃乃木かな",
      provider: "fanza",
      homepage: "https://www.dmm.co.jp/mono/actress/12345/",
      birthday: "1996-12-01",
      height: 162,
      cup_size: "G",
      measurements: "B85/W58/H83",
      blood_type: "A",
      aliases: ["Kana Momonogi", "ももちゃん"],
      images: ["https://pics.dmm.co.jp/mono/actress/12345.jpg"],
    },
  };
  const { canonical } = parseMetatubeActorResponse(payload, NOW, { provider: "fanza" });
  const a = canonical.actresses[0];
  assert.equal(a.primary_name, "桃乃木かな");
  assert.equal(a.name_ja, "桃乃木かな");
  assert.equal(a.birth_date, "1996-12-01");
  assert.equal(a.height_cm, 162);
  assert.equal(a.cup, "G");
  assert.equal(a.bust_cm, 85);
  assert.equal(a.waist_cm, 58);
  assert.equal(a.hip_cm, 83);
  assert.equal(a.blood_type, "A");
  assert.equal(a.profile_image_url, "https://pics.dmm.co.jp/mono/actress/12345.jpg");
  assert.equal(a.aliases.length, 2);
});

test("Prepare 不报错且把番号写入 work（空 catalog 隔离）", () => {
  const catalog = loadEmptyCatalog();
  const { canonical } = parseMetatubeMovieResponse(MOVIE, NOW, { provider: "fanza" });
  const stage = prepareImport(canonical, { catalog, batchId: "provider-test", now: NOW, fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.work_codes.length, 1);
  assert.equal(stage.append.work_codes[0].code, "IPZZ-597");
});

test("离线 CLI 只生成 Provider 产物，不修改正式 CSV", () => {
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
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "averia-metatube-"));
  try {
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts/provider-metatube.mjs"),
      "--file", path.join(here, "fixtures/metatube/movie-ipzz-597.json"),
      "--provider", "fanza",
      "--id", "ipzz-00597",
      "--out", out,
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(out, "raw.json")));
    assert.ok(fs.existsSync(path.join(out, "canonical.json")));
    const meta = JSON.parse(fs.readFileSync(path.join(out, "meta.json"), "utf8"));
    assert.equal(meta.raw_sha256.length, 64, "meta 应含 SHA-256");
    assert.equal(meta.fetch_mode, "file");
    for (const rel of formal) assert.equal(sha256(path.join(repoRoot, rel)), before.get(rel), rel);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
