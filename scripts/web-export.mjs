// scripts/web-export.mjs
//
// Averia Web 前置 —— 把 SQLite 派生库（CSV 的只读物化层）导出为静态数据，
// 供 web/ 下的纯静态网页（无构建步骤、可直接 file:// 打开）消费。
//
// 数据流向（与 ADR-0001 一致）：CSV(事实源) → SQLite(物化) → 本脚本 → web/data/*
// 本脚本只读 SQLite，绝不回写 CSV 或 SQLite。
//
// 产物：
//   web/data/averia.json  —— 完整数据包（可被 API / 用户脚本以 CDN 方式消费，对标 JAV_info 的 dist/）
//   web/data/data.js      —— `window.AVERIA_DATA = {...}`，<script> 引入即挂载（file:// 也能用）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  getActress,
  getWork,
  getStats,
  databaseExists,
} from "./lib/db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const DATA_DIR = path.join(WEB_DIR, "data");

function main() {
  if (!databaseExists()) {
    console.error(
      "✗ SQLite 派生库不存在，请先运行 `pnpm db:sync` 生成后再导出网页数据。",
    );
    process.exit(1);
  }

  const db = openDatabase({ readonly: true });

  // ---------- 演员 ----------
  const actressIds = db
    .prepare(`SELECT id FROM actresses ORDER BY primary_name`)
    .all()
    .map((r) => r.id);

  const actresses = actressIds.map((id) => {
    const a = getActress(db, id);
    return {
      id: a.id,
      primary_name: a.primary_name ?? null,
      name_ja: a.name_ja ?? null,
      name_en: a.name_en ?? null,
      kana: a.kana ?? null,
      birth_date: a.birth_date ?? null,
      debut_date: a.debut_date ?? null,
      retirement_date: a.retirement_date ?? null,
      height_cm: a.height_cm ?? null,
      bust_cm: a.bust_cm ?? null,
      waist_cm: a.waist_cm ?? null,
      hip_cm: a.hip_cm ?? null,
      cup: a.cup ?? null,
      blood_type: a.blood_type ?? null,
      birthplace: a.birthplace ?? null,
      status: a.status ?? "unknown",
      profile_image_url: a.profile_image_url ?? null,
      aliases: (a.aliases ?? []).map((x) => ({
        alias: x.alias,
        language: x.language ?? null,
      })),
      works: (a.works ?? []).map((w) => ({
        id: w.id,
        primary_code: w.primary_code,
        title: w.title,
        title_ja: w.title_ja ?? null,
        release_date: w.release_date ?? null,
        thumb_url: w.thumb_url ?? null,
        score: w.score ?? null,
      })),
    };
  });

  // ---------- 作品 ----------
  const workIds = db
    .prepare(`SELECT id FROM works ORDER BY release_date DESC, id`)
    .all()
    .map((r) => r.id);

  const works = workIds.map((id) => {
    const w = getWork(db, id);
    return {
      id: w.id,
      primary_code: w.primary_code,
      title: w.title,
      title_ja: w.title_ja ?? null,
      release_date: w.release_date ?? null,
      duration_min: w.duration_min ?? null,
      maker_id: w.maker_id ?? null,
      maker_name: w.maker_name ?? null,
      label_id: w.label_id ?? null,
      label_name: w.label_name ?? null,
      series_id: w.series_id ?? null,
      series_name: w.series_name ?? null,
      description: w.description ?? null,
      cover_url: w.cover_url ?? null,
      thumb_url: w.thumb_url ?? null,
      backdrop_url: w.backdrop_url ?? null,
      score: w.score ?? null,
      codes: (w.codes ?? []).map((c) => ({
        code: c.code,
        is_primary: !!c.is_primary,
      })),
      cast: (w.cast ?? []).map((c) => ({
        actress_id: c.actress_id,
        primary_name: c.primary_name,
        name_ja: c.name_ja ?? null,
        name_en: c.name_en ?? null,
        position: c.position,
      })),
      genres: (w.genres ?? []).map((g) => ({ id: g.id, name: g.name })),
      directors: (w.directors ?? []).map((d) => ({ id: d.id, name: d.name })),
    };
  });

  // ---------- 分类法（供筛选下拉 & 详情展示）----------
  const taxonomy = (table) =>
    db.prepare(`SELECT id, name, name_ja FROM ${table} ORDER BY name`).all();
  const makers = taxonomy("makers");
  const labels = taxonomy("labels");
  const series = taxonomy("series");
  const genres = db.prepare(`SELECT id, name FROM genres ORDER BY name`).all();

  const stats = getStats(db);
  db.close();

  const bundle = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "Averia SQLite 派生库（CSV 物化，只读）",
      counts: {
        actresses: actresses.length,
        works: works.length,
        makers: makers.length,
        labels: labels.length,
        series: series.length,
        genres: genres.length,
        ...(stats.counts ?? {}),
      },
    },
    actresses,
    works,
    makers,
    labels,
    series,
    genres,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const jsonPath = path.join(DATA_DIR, "averia.json");
  const jsPath = path.join(DATA_DIR, "data.js");
  fs.writeFileSync(jsonPath, JSON.stringify(bundle));
  fs.writeFileSync(jsPath, `window.AVERIA_DATA = ${JSON.stringify(bundle)};`);

  const sizeKb = (fs.statSync(jsonPath).size / 1024).toFixed(1);
  console.log(
    `✓ 已导出网页数据 → web/data/averia.json (${sizeKb} KB)\n` +
      `  演员 ${bundle.meta.counts.actresses} · 作品 ${bundle.meta.counts.works} · 厂商 ${bundle.meta.counts.makers} · 厂牌 ${bundle.meta.counts.labels} · 系列 ${bundle.meta.counts.series} · 分类 ${bundle.meta.counts.genres}`,
  );
}

main();
