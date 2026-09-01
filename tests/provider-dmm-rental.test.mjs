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
  extractDmmAgeDeclarationUrl,
  extractDmmCid,
  extractDmmRentalDetailRegion,
  fetchDmmRentalHtml,
  isDmmAgeGate,
  parseDmmRentalWork,
  selectDmmRentalCover,
} from "../scripts/providers/dmm-rental/lib.mjs";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { prepareImport } from "../scripts/import/lib.mjs";
import { loadEmptyCatalog } from "./helpers/catalog.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixturePath = path.join(here, "fixtures", "dmm-rental", "work-4ipzz698.html");
const ageGateFixturePath = path.join(here, "fixtures", "dmm-rental", "age-gate-4ipzz698.html");
const fixture = () => fs.readFileSync(fixturePath, "utf8");
const ageGateFixture = () => fs.readFileSync(ageGateFixturePath, "utf8");
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

test("DMM 年龄确认页可以识别 declared=yes 官方链接，并校验 rurl 指向原详情页", () => {
  assert.equal(isDmmAgeGate(ageGateFixture()), true);
  const declaration = extractDmmAgeDeclarationUrl(ageGateFixture(), URL);
  assert.match(declaration, /\/age_check\/=\/declared=yes\//);
  assert.match(declaration, /rurl=/);

  const tampered = ageGateFixture().replace("4ipzz698", "1sdam00179");
  assert.equal(extractDmmAgeDeclarationUrl(tampered, URL), "");
});

test("DMM 在线抓取检测到年龄确认时不会替用户自动声明年龄", async () => {
  let calls = 0;
  const result = await fetchDmmRentalHtml(URL, {
    transport: "curl",
    retryDelayMs: 0,
    curlImpl: async () => {
      calls += 1;
      return {
        text: ageGateFixture(),
        finalUrl: "https://www.dmm.co.jp/age_check/",
        status: 200,
        contentType: "text/html; charset=UTF-8",
        transport: "curl",
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.ageGateDetected, true);
  assert.equal(result.ageGateDeclared, false);
  assert.equal(result.ageGateRequired, true);
  assert.equal(result.html, ageGateFixture());
});

test("显式 --adult-confirmed 使用 Cookie 会话，但不跟随 DMM 返回的明文 HTTP 重定向", async () => {
  const calls = [];
  const result = await fetchDmmRentalHtml(URL, {
    transport: "curl",
    adultConfirmed: true,
    retryDelayMs: 0,
    curlImpl: async (url, options) => {
      calls.push({
        url,
        cookieJar: options.cookieJar || "",
        followRedirects: options.followRedirects !== false,
      });
      if (calls.length === 1) {
        return {
          text: ageGateFixture(),
          finalUrl: "https://www.dmm.co.jp/age_check/",
          status: 200,
          contentType: "text/html; charset=UTF-8",
          transport: "curl",
        };
      }
      if (calls.length === 2) {
        // 真实 DMM 会在这里返回 302，Location 可能是 http://...。
        // Averia 只接收 Set-Cookie，不跟随这个重定向。
        return {
          text: "",
          finalUrl: calls[1].url,
          status: 302,
          contentType: "text/html; charset=UTF-8",
          transport: "curl",
        };
      }
      return {
        text: fixture(),
        finalUrl: URL,
        status: 200,
        contentType: "text/html; charset=EUC-JP",
        transport: "curl",
      };
    },
  });

  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /\/age_check\/=\/declared=yes\//);
  assert.match(calls[1].cookieJar, /cookies\.txt$/);
  assert.equal(calls[1].followRedirects, false);
  assert.equal(calls[2].url, URL);
  assert.equal(calls[2].cookieJar, calls[1].cookieJar);
  assert.equal(calls[2].followRedirects, true);
  assert.equal(result.ageGateDetected, true);
  assert.equal(result.ageGateDeclared, true);
  assert.equal(result.ageGateRequired, false);
  assert.equal(result.finalUrl, URL);
  assert.equal(result.html, fixture());
  assert.equal(result.attempts, 3);
});

test("显式 node 模式不会在年龄确认流程中偷偷切换为 curl Cookie 会话", async () => {
  await assert.rejects(
    fetchDmmRentalHtml(URL, {
      transport: "node",
      adultConfirmed: true,
      nodeImpl: async () => ({
        text: ageGateFixture(),
        finalUrl: "https://www.dmm.co.jp/age_check/",
        status: 200,
        contentType: "text/html; charset=UTF-8",
        transport: "node-fetch",
      }),
    }),
    /需要 Cookie.*auto \/ curl/,
  );
});

test("DMM Rental 字段解析只读取作品详情块，不会把侧栏系列/分类/女优链接混入 canonical", () => {
  const region = extractDmmRentalDetailRegion(fixture());
  assert.match(region, /貸出開始日/);
  assert.match(region, /シリーズ：<\/td><td><a[^>]+>引退作/);
  assert.doesNotMatch(region, /新人NO\.1 STYLE|斎藤あみり|AV女優一覧へ|アニメDVD/);

  const parsed = parseDmmRentalWork(fixture(), URL, NOW);
  const work = parsed.canonical.works[0];
  assert.equal(work.series.name, "引退作");
  assert.deepEqual(work.genres.map((item) => item.name), [
    "美少女", "スレンダー", "単体作品", "寝取り・寝取られ・NTR", "フェラ",
    "主観", "独占レンタル", "サンプル動画", "セル仕様", "在庫強化作品",
  ]);
  assert.equal(parsed.meta.detail_scope, "ordered-field-cluster");
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
  assert.deepEqual(work.label, { name: "ティッシュ", name_ja: "ティッシュ" });
  assert.deepEqual(work.series, { name: "引退作", name_ja: "引退作" });
  assert.deepEqual(work.directors, [{ name: "ZAMPA", name_ja: "ZAMPA", position: 1 }]);
  assert.equal(work.cast[0].name, "桃乃木かな");
  assert.equal(work.cast[0].source_record_id, "actress:1031805");
  assert.deepEqual(work.genres.map((item) => item.name), ["美少女", "スレンダー", "単体作品", "寝取り・寝取られ・NTR", "フェラ", "主観", "独占レンタル", "サンプル動画", "セル仕様", "在庫強化作品"]);
  assert.deepEqual(work.codes, [{ code: "4ipzz698", type: "dmm-content-id", is_primary: false }]);
  assert.match(work.cover_url, /pics\.dmm\.co\.jp\/mono\/movie\/4ipzz698\/4ipzz698ps\.jpg/);
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
  assert.equal(stage.append.genres.length, 10);
  assert.equal(stage.append.works[0].release_date, "");
  assert.equal(stage.append.source_records.find((row) => row.entity_type === "work")?.notes.includes("貸出開始日=2026-02-24"), true);
});

test("DMM Rental 封面选择不会把 Logo 或样图当主封面", () => {
  const cover = selectDmmRentalCover(fixture(), URL, "4ipzz698");
  assert.match(cover.url, /4ipzz698ps\.jpg/);
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
