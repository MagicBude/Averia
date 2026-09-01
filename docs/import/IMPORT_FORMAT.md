# Averia 统一导入格式 — V0.2

Averia 不让每个 Provider 直接修改正式 CSV。所有来源先转换为统一 JSON，再进入同一套 Pipeline。

## 顶层结构

```json
{
  "schema_version": 1,
  "source": { "name": "example", "fetched_at": "2026-08-31T08:30:00Z" },
  "actresses": [],
  "works": []
}
```

### source

- `name`：来源稳定名称，必填。后续 Provider 应保持不变。
- `fetched_at`：本批数据获取时间，ISO 8601 UTC；可省略。

## actresses

新女优至少提供 `primary_name`。推荐同时提供来源自己的稳定记录 ID：

```json
{
  "source_record_id": "12345",
  "source_url": "https://example.invalid/actress/12345",
  "primary_name": "示例女优",
  "name_ja": "サンプル女优",
  "name_en": "Sample Actress",
  "kana": "...",
  "birth_date": "2000-01-01",
  "height_cm": 160,
  "aliases": [
    { "value": "Sample Actress", "type": "romanized", "language": "en" }
  ]
}
```

V0.2 女优自动匹配只允许：

1. 同来源 `source_record_id` 已有映射；
2. 首选名 / 日文名 / 英文名 / 假名 / 已知别名经过 NFKC 和空白标准化后**精确唯一匹配**。

不会做模糊相似度自动合并。

## works

新作品至少需要 `code` 和 `title`：

```json
{
  "source_record_id": "work-001",
  "code": "ABC-001",
  "title": "示例作品",
  "release_date": "2026-08-31",
  "duration_min": 120,
  "maker": { "name": "示例厂商" },
  "label": { "name": "示例厂牌" },
  "series": { "name": "示例系列" },
  "genres": [{ "name": "示例分类", "slug": "sample" }],
  "directors": [{ "name": "示例导演", "name_ja": "示例导演", "position": 1 }],
  "cast": [{ "source_record_id": "12345", "name": "示例女优", "position": 1 }]
}
```

作品自动匹配只允许来源记录映射或**标准化番号精确唯一匹配**。标题相似不会触发自动合并。

## 已有实体的字段更新

V0.2 默认不自动覆盖已有实体。来源提供了正式数据中的空字段时，只写入 `stage.json` 的 `proposals`，等待后续冲突裁决机制或人工处理。


## directors（V0.4.3）

作品可以通过 `directors` 数组携带一个或多个导演：

```json
{
  "directors": [
    { "name": "示例导演", "name_ja": "示例导演", "position": 1 }
  ]
}
```

Prepare 会把导演规范化为 `directors.csv`，并通过 `work_directors.csv` 建立作品关系。导演名只做确定性精确匹配，不做模糊自动合并。
