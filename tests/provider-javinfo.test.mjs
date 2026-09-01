import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildJavinfoMovieUrl, parseJavinfoMovieResponse } from "../scripts/providers/javinfo/lib.mjs";

const fixture = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/javinfo/ipzz-597.json"), "utf8"));

test("JavInfo /movie URL 可以固定 FANZA 并请求图片", () => {
  const url = new URL(buildJavinfoMovieUrl({ code: "ipzz597", providers: "fanza", includeImages: true }));
  assert.equal(url.origin, "https://api.javinfo.dev");
  assert.equal(url.pathname, "/movie");
  assert.equal(url.searchParams.get("q"), "IPZZ-597");
  assert.equal(url.searchParams.get("providers"), "fanza");
  assert.equal(url.searchParams.get("includeImages"), "true");
});

test("真实 IPZZ-597 JavInfo 响应映射为 Averia canonical", () => {
  const { canonical, meta } = parseJavinfoMovieResponse(fixture, "2026-09-01T05:30:00.000Z", { code: "IPZZ-597" });
  assert.equal(canonical.source.name, "javinfo-fanza");
  assert.equal(canonical.source.role, "reference");
  assert.equal(canonical.source.language, "mixed");
  assert.equal(canonical.works.length, 1);
  const work = canonical.works[0];
  assert.equal(work.code, "IPZZ-597");
  assert.equal(work.title_ja, "墓まで持っていく僕とかなちゃん二人だけの秘密 親友彼女の無防備すっぴん姿が可愛すぎて 衝動的に寝取ってしまった例の夜 桃乃木かな");
  assert.equal(work.release_date, "2025-08-08");
  assert.equal(work.duration_min, 127);
  assert.equal(work.maker.name, "Idea Pocket");
  assert.equal(work.label.name, "Dish");
  assert.equal(work.genres.length, 9);
  assert.equal(work.cover_url, "https://pics.dmm.co.jp/digital/video/ipzz00597/ipzz00597pl.jpg");
  assert.deepEqual(work.codes, [{ code: "ipzz00597", type: "fanza-content-id", is_primary: false }]);
  assert.equal(canonical.actresses[0].primary_name, "Kana Momonogi");
  assert.equal(canonical.actresses[0].name_en, "Kana Momonogi");
  assert.equal(canonical.actresses[0].profile_image_url, "https://pics.dmm.co.jp/mono/actjpgs/momonogi_kana.jpg");
  assert.equal(meta.gallery_full_count, 14);
  assert.equal(meta.sample_url_present, true);
});

test("JavInfo 返回的番号与请求不一致时拒绝生成 canonical", () => {
  assert.throws(() => parseJavinfoMovieResponse(fixture, "2026-09-01T05:30:00.000Z", { code: "SSIS-001" }), /不一致/);
});
