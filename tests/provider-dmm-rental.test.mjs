import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildDmmRentalUrl,
  deriveCatalogCodeFromDmmCid,
  extractDmmCid,
  parseDmmRentalWork,
  selectDmmRentalCover,
} from "../scripts/providers/dmm-rental/lib.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";
import { loadEmptyCatalog } from "./helpers/catalog.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixturePath = path.join(here, "fixtures", "dmm-rental", "work-4ipzz698.html");
const fixture = () => fs.readFileSync(fixturePath, "utf8");
const URL = "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=4ipzz698/";
const NOW = "2026-08-31T15:20:00Z";

function dataHashes() {
  const catalog = loadCatalog();
  return Object.fromEntries(Object.entries(catalog).map(([name, dataset]) => [
    name,
    crypto.createHash("sha256").update(fs.readFileSync(dataset.filePath)).digest("hex"),
  ]));
}

test("DMM Rental URL 与 CID/番号保守推导保持确定性", () => {
  assert.equal(buildDmmRentalUrl({ cid: "4ipzz698" }), URL);
  assert.equal(extractDmmCid(URL), "4ipzz698");
  assert.equal(deriveCatalogCodeFromDmmCid("4ipzz698"), "IPZZ-698");
  assert.equal(deriveCatalogCodeFromDmmCid("1sdam00179"), "SDAM-179");
  assert.equal(deriveCatalogCodeFromDmmCid("h_123abc"), "");
  assert.throws(() => buildDmmRentalUrl({ url: "https://example.com/rental/ppr/-/detail/=/cid=4ipzz698/" }), /不允许访问的主机/);
});

test("DMM Rental 详情页解析为日文参考 canonical，并区分貸出開始日与发行日", () => {
  const parsed = parseDmmRentalWork(fixture(), URL, NOW);
  const work = parsed.canonical.works[0];
  assert.equal(parsed.canonical.source.name, "dmm-rental");
  assert.equal(parsed.canonical.source.language, "ja");
  assert.equal(parsed.canonical.source.role, "reference");
  assert.equal(work.code, "IPZZ-698");
  assert.equal(work.release_date, "");
  assert.equal(parsed.meta.rental_start_date, "2026-02-24");
  assert.match(work.source_notes, /貸出開始日=2026-02-24/);
  assert.equal(work.duration_min, 140);
  assert.deepEqual(work.maker, { name: "アイデアポケット", name_ja: "アイデアポケット" });
  assert.deepEqual(work.label, { name: "ディープス", name_ja: "ディープス" });
  assert.deepEqual(work.series, { name: "引退作", name_ja: "引退作" });
  assert.deepEqual(work.directors, [{ name: "ZAMPA", name_ja: "ZAMPA", position: 1 }]);
  assert.equal(work.cast[0].name, "桃乃木かな");
  assert.equal(work.cast[0].source_record_id, "actress:123456");
  assert.deepEqual(work.genres.map((item) => item.name), ["美少女", "単体作品", "寝取り・寝取られ・NTR", "フェラ", "主観"]);
  assert.deepEqual(work.codes, [{ code: "4ipzz698", type: "dmm-content-id", is_primary: false }]);
  assert.match(work.cover_url, /pics\.dmm\.co\.jp\/mono\/movie\/adult\/ipzz698r\/ipzz698rpl\.jpg/);
  assert.doesNotMatch(work.cover_url, /logo|banner|sample/i);
  assert.equal(parsed.meta.catalog_code_source, "derived-from-dmm-cid");
});

test("DMM Rental 主番号可由 --code 显式覆盖，避免不安全推导", () => {
  const html = fixture().replaceAll("4ipzz698", "x_unusual_cid");
  const customUrl = "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=x_unusual_cid/";
  assert.throws(() => parseDmmRentalWork(html, customUrl, NOW), /请使用 --code/);
  const parsed = parseDmmRentalWork(html, customUrl, NOW, { code: "IPZZ-698" });
  assert.equal(parsed.canonical.works[0].code, "IPZZ-698");
  assert.equal(parsed.meta.catalog_code_source, "cli");
});

test("DMM Rental canonical 可以进入 Prepare，并把 CID 作为附加番号", () => {
  const parsed = parseDmmRentalWork(fixture(), URL, NOW);
  const stage = prepareImport(parsed.canonical, { batchId: "dmm-test", now: NOW, catalog: loadEmptyCatalog(), fingerprint: "test" });
  assert.equal(stage.summary.error_count, 0);
  assert.equal(stage.append.actresses.length, 1);
  assert.equal(stage.append.works.length, 1);
  assert.equal(stage.append.work_codes.length, 2);
  assert.equal(stage.append.work_cast.length, 1);
  assert.equal(stage.append.directors.length, 1);
  assert.equal(stage.append.work_directors.length, 1);
  assert.equal(stage.append.genres.length, 5);
  assert.equal(stage.append.works[0].release_date, "");
  assert.equal(stage.append.source_records.find((row) => row.entity_type === "work")?.notes.includes("貸出開始日=2026-02-24"), true);
});

test("DMM Rental 封面选择不会把 Logo 或样图当主封面", () => {
  const cover = selectDmmRentalCover(fixture(), URL, "4ipzz698");
  assert.match(cover.url, /ipzz698rpl\.jpg/);
  assert.doesNotMatch(cover.url, /logo|banner|sample/i);
});

test("DMM Rental 离线 CLI 只生成 Provider 产物，不修改正式 CSV", () => {
  const before = dataHashes();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "averia-dmm-rental-"));
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "provider-dmm-rental.mjs"),
    "--file", fixturePath,
    "--url", URL,
    "--out", out,
  ], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const canonical = JSON.parse(fs.readFileSync(path.join(out, "canonical.json"), "utf8"));
  assert.equal(canonical.works[0].code, "IPZZ-698");
  assert.equal(canonical.works[0].release_date, "");
  const meta = JSON.parse(fs.readFileSync(path.join(out, "meta.json"), "utf8"));
  assert.equal(meta.network_mode, "offline-file");
  assert.equal(meta.source_role, "reference");
  assert.deepEqual(dataHashes(), before);
});
