# Averia 字段字典

本文档用于解释 Averia CSV / JSON 中的英文字段名。

底层程序字段保持英文，以便后续 TypeScript、数据库和 API 直接复用；人工查看 XLSX 时会自动显示中文表头。

> 注意：这里的“必填”指 Schema 层最低要求，并不代表非必填字段可以永远忽略。随着数据质量提升，部分字段会逐步补全。

## 女优 `actresses.csv`

女优核心人物资料。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 女优ID | 是 | 稳定 ID |
| `primary_name` | 首选姓名 | 是 | 文本/按业务含义填写 |
| `name_ja` | 日文名 | 否 | 文本/按业务含义填写 |
| `name_en` | 英文名/罗马字 | 否 | 文本/按业务含义填写 |
| `kana` | 假名 | 否 | 文本/按业务含义填写 |
| `birth_date` | 出生日期 | 否 | 日期 `YYYY-MM-DD` |
| `debut_date` | 出道日期 | 否 | 日期 `YYYY-MM-DD` |
| `retirement_date` | 引退日期 | 否 | 日期 `YYYY-MM-DD` |
| `height_cm` | 身高(cm) | 否 | 整数 |
| `bust_cm` | 胸围(cm) | 否 | 整数 |
| `waist_cm` | 腰围(cm) | 否 | 整数 |
| `hip_cm` | 臀围(cm) | 否 | 整数 |
| `cup` | 罩杯 | 否 | 文本/按业务含义填写 |
| `blood_type` | 血型 | 否 | 文本/按业务含义填写 |
| `birthplace` | 出生地 | 否 | 文本/按业务含义填写 |
| `status` | 状态 | 否 | 枚举：active, inactive, retired, unknown |
| `profile_image_url` | 头像URL | 否 | 绝对 URL |
| `description` | 简介 | 否 | 文本/按业务含义填写 |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 女优别名 `actress_aliases.csv`

女优的艺名、曾用名、罗马字、不同语言写法等。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 别名ID | 是 | 稳定 ID |
| `actress_id` | 女优ID | 是 | 稳定 ID |
| `alias` | 别名 | 是 | 文本/按业务含义填写 |
| `alias_type` | 别名类型 | 否 | 文本/按业务含义填写 |
| `language` | 语言 | 否 | 文本/按业务含义填写 |
| `is_primary` | 是否主要名称 | 否 | `true/false` |
| `source_id` | 来源ID | 否 | 稳定 ID |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |

## 作品 `works.csv`

作品级规范元数据。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 作品ID | 是 | 稳定 ID |
| `primary_code` | 主番号 | 是 | 文本/按业务含义填写 |
| `title` | 标题 | 是 | 文本/按业务含义填写 |
| `title_ja` | 日文标题 | 否 | 文本/按业务含义填写 |
| `release_date` | 发行日期 | 否 | 日期 `YYYY-MM-DD` |
| `duration_min` | 时长(分钟) | 否 | 整数 |
| `maker_id` | 厂商ID | 否 | 稳定 ID |
| `label_id` | 厂牌ID | 否 | 稳定 ID |
| `series_id` | 系列ID | 否 | 稳定 ID |
| `description` | 简介 | 否 | 文本/按业务含义填写 |
| `cover_url` | 封面URL | 否 | 绝对 URL |
| `thumb_url` | 缩略图URL | 否 | 绝对 URL |
| `backdrop_url` | 背景图URL | 否 | 绝对 URL |
| `score` | 评分 | 否 | 浮点（文本列，保留小数精度） |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 作品番号 `work_codes.csv`

一个作品对应的主番号及其他番号形式。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 番号记录ID | 是 | 稳定 ID |
| `work_id` | 作品ID | 是 | 稳定 ID |
| `code` | 番号 | 是 | 文本/按业务含义填写 |
| `normalized_code` | 标准化番号 | 是 | 文本/按业务含义填写 |
| `code_type` | 番号类型 | 否 | 文本/按业务含义填写 |
| `is_primary` | 是否主番号 | 否 | `true/false` |
| `source_id` | 来源ID | 否 | 稳定 ID |

## 作品参演 `work_cast.csv`

作品与女优之间的多对多参演关系。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `work_id` | 作品ID | 是 | 稳定 ID |
| `actress_id` | 女优ID | 是 | 稳定 ID |
| `role` | 角色/身份 | 否 | 文本/按业务含义填写 |
| `position` | 排序 | 否 | 整数 |

## 作品分类 `work_genres.csv`

作品与分类之间的多对多关系。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `work_id` | 作品ID | 是 | 稳定 ID |
| `genre_id` | 分类ID | 是 | 稳定 ID |

## 厂商 `makers.csv`

厂商实体。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 厂商ID | 是 | 稳定 ID |
| `name` | 名称 | 是 | 文本/按业务含义填写 |
| `name_ja` | 日文名 | 否 | 文本/按业务含义填写 |
| `website_url` | 官网URL | 否 | 绝对 URL |
| `description` | 简介 | 否 | 文本/按业务含义填写 |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 厂牌 `labels.csv`

厂牌/Label 实体，可关联厂商。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 厂牌ID | 是 | 稳定 ID |
| `maker_id` | 厂商ID | 否 | 稳定 ID |
| `name` | 名称 | 是 | 文本/按业务含义填写 |
| `name_ja` | 日文名 | 否 | 文本/按业务含义填写 |
| `website_url` | 官网URL | 否 | 绝对 URL |
| `description` | 简介 | 否 | 文本/按业务含义填写 |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 系列 `series.csv`

作品系列实体，可关联厂商和厂牌。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 系列ID | 是 | 稳定 ID |
| `maker_id` | 厂商ID | 否 | 稳定 ID |
| `label_id` | 厂牌ID | 否 | 稳定 ID |
| `name` | 名称 | 是 | 文本/按业务含义填写 |
| `name_ja` | 日文名 | 否 | 文本/按业务含义填写 |
| `description` | 简介 | 否 | 文本/按业务含义填写 |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 分类 `genres.csv`

规范化分类/标签词汇。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 分类ID | 是 | 稳定 ID |
| `name` | 名称 | 是 | 文本/按业务含义填写 |
| `name_ja` | 日文名 | 否 | 文本/按业务含义填写 |
| `slug` | Slug | 是 | 文本/按业务含义填写 |
| `description` | 说明 | 否 | 文本/按业务含义填写 |
| `created_at` | 创建时间 | 否 | UTC 时间戳 |
| `updated_at` | 更新时间 | 否 | UTC 时间戳 |

## 数据来源 `source_records.csv`

外部数据来源和溯源记录。

| 英文字段 | 中文含义 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | 来源ID | 是 | 稳定 ID |
| `entity_type` | 实体类型 | 是 | 枚举：actress, work, maker, label, series, genre |
| `entity_id` | 实体ID | 是 | 文本/按业务含义填写 |
| `source_name` | 来源名称 | 是 | 文本/按业务含义填写 |
| `source_record_id` | 来源记录ID | 否 | 文本/按业务含义填写 |
| `source_url` | 来源URL | 否 | 绝对 URL |
| `fetched_at` | 获取时间 | 否 | UTC 时间戳 |
| `raw_hash` | 原始数据Hash | 否 | 文本/按业务含义填写 |
| `notes` | 备注 | 否 | 文本/按业务含义填写 |


## 导演 `directors.csv`

| 英文字段 | 中文含义 |
| --- | --- |
| `id` | 导演ID |
| `name` | 名称 |
| `name_ja` | 日文名 |
| `website_url` | 官网URL |
| `description` | 简介 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

## 作品导演 `work_directors.csv`

| 英文字段 | 中文含义 |
| --- | --- |
| `work_id` | 作品ID |
| `director_id` | 导演ID |
| `position` | 导演排序 |
