export const DATASET_SHEET_ORDER = [
  "actresses",
  "actress_aliases",
  "works",
  "work_codes",
  "work_cast",
  "work_genres",
  "work_directors",
  "makers",
  "labels",
  "series",
  "genres",
  "directors",
  "source_records",
];

// V0.8 多来源溯源与实体归并新增的数据集只进入 CSV / JSON，不进入 XLSX
// （保持固定 15 个关系 Sheet 约定，见 CHANGELOG.md V0.8.0 与 docs/V0.8-MULTI-SOURCE-RESOLUTION.md）。
export const NON_XLSX_DATASETS = [
  "observations",
  "field_resolutions",
  "entity_aliases",
];

export const ACTRESS_OVERVIEW_COLUMNS = [
  ["id", "女优ID"],
  ["primary_name", "首选姓名"],
  ["name_ja", "日文名"],
  ["name_en", "英文名/罗马字"],
  ["aliases", "别名"],
  ["status", "状态"],
  ["birth_date", "出生日期"],
  ["debut_date", "出道日期"],
  ["retirement_date", "引退日期"],
  ["height_cm", "身高(cm)"],
  ["measurements", "三围(B-W-H)"],
  ["cup", "罩杯"],
  ["blood_type", "血型"],
  ["birthplace", "出生地"],
  ["work_count", "作品数"],
  ["profile_image_url", "头像URL"],
  ["description", "简介"],
  ["updated_at", "更新时间"],
];

export const WORK_OVERVIEW_COLUMNS = [
  ["id", "作品ID"],
  ["primary_code", "番号"],
  ["title_ja", "日文标题"],
  ["actresses", "女优"],
  ["release_date", "发行日期"],
  ["duration_min", "时长(分钟)"],
  ["maker", "厂商"],
  ["label", "厂牌"],
  ["series", "系列"],
  ["directors", "导演"],
  ["genres", "分类"],
  ["cover_url", "封面URL"],
  ["updated_at", "更新时间"],
];

function mapById(records) {
  return new Map(records.map((row) => [row.id, row]));
}

function pushGrouped(map, key, value) {
  if (!key || value == null) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function uniqueJoined(values, separator = "、") {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].join(separator);
}

function sortByPosition(rows) {
  return [...rows].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
}

export function buildActressOverviewRows(catalog) {
  const aliasesByActress = new Map();
  for (const row of catalog.actress_aliases.records) pushGrouped(aliasesByActress, row.actress_id, row.alias);

  const worksByActress = new Map();
  for (const row of catalog.work_cast.records) {
    if (!worksByActress.has(row.actress_id)) worksByActress.set(row.actress_id, new Set());
    worksByActress.get(row.actress_id).add(row.work_id);
  }

  return catalog.actresses.records.map((row) => {
    const measurements = [row.bust_cm, row.waist_cm, row.hip_cm].some(Boolean)
      ? `${row.bust_cm || "?"}-${row.waist_cm || "?"}-${row.hip_cm || "?"}`
      : "";
    return {
      id: row.id,
      primary_name: row.primary_name,
      name_ja: row.name_ja,
      name_en: row.name_en,
      aliases: uniqueJoined(aliasesByActress.get(row.id) ?? []),
      status: row.status,
      birth_date: row.birth_date,
      debut_date: row.debut_date,
      retirement_date: row.retirement_date,
      height_cm: row.height_cm ? Number(row.height_cm) : null,
      measurements,
      cup: row.cup,
      blood_type: row.blood_type,
      birthplace: row.birthplace,
      work_count: worksByActress.get(row.id)?.size ?? 0,
      profile_image_url: row.profile_image_url,
      description: row.description,
      updated_at: row.updated_at,
    };
  });
}

export function buildWorkOverviewRows(catalog) {
  const actresses = mapById(catalog.actresses.records);
  const makers = mapById(catalog.makers.records);
  const labels = mapById(catalog.labels.records);
  const series = mapById(catalog.series.records);
  const genres = mapById(catalog.genres.records);
  const directors = mapById(catalog.directors.records);

  const castByWork = new Map();
  for (const row of catalog.work_cast.records) pushGrouped(castByWork, row.work_id, row);
  const directorsByWork = new Map();
  for (const row of catalog.work_directors.records) pushGrouped(directorsByWork, row.work_id, row);
  const genresByWork = new Map();
  for (const row of catalog.work_genres.records) pushGrouped(genresByWork, row.work_id, row);

  return catalog.works.records.map((row) => ({
    id: row.id,
    primary_code: row.primary_code,
    title_ja: row.title_ja || row.title,
    actresses: uniqueJoined(sortByPosition(castByWork.get(row.id) ?? []).map((link) => actresses.get(link.actress_id)?.primary_name)),
    release_date: row.release_date,
    duration_min: row.duration_min ? Number(row.duration_min) : null,
    maker: makers.get(row.maker_id)?.name_ja || makers.get(row.maker_id)?.name || "",
    label: labels.get(row.label_id)?.name_ja || labels.get(row.label_id)?.name || "",
    series: series.get(row.series_id)?.name_ja || series.get(row.series_id)?.name || "",
    directors: uniqueJoined(sortByPosition(directorsByWork.get(row.id) ?? []).map((link) => directors.get(link.director_id)?.name_ja || directors.get(link.director_id)?.name)),
    genres: uniqueJoined((genresByWork.get(row.id) ?? []).map((link) => genres.get(link.genre_id)?.name_ja || genres.get(link.genre_id)?.name)),
    cover_url: row.cover_url,
    updated_at: row.updated_at,
  }));
}
