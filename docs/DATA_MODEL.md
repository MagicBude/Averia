# Averia 数据模型

## Actress：女优

保存规范化的女优人物/资料信息。

主数据：

```text
data/actresses/actresses.csv
```

一个人可能存在多个姓名，因此别名不直接平铺到主表，而是单独规范化存储。

## ActressAlias：女优别名

一个别名对应一个女优实体。

```text
Actress 1 ── N ActressAlias
```

用于保存艺名、曾用名、罗马字、不同语言写法和来源站点名称等。

## Work：作品

保存规范化作品元数据。

作品实体独立于番号的具体书写格式。

例如：

```text
SSIS-001
SSIS001
ssis-001
```

可以通过标准化后识别，但作品本身仍由 `work_*` ID 标识。

## WorkCode：作品番号

一个作品允许存在多个番号或番号表现形式。

```text
Work 1 ── N WorkCode
```

`normalized_code` 用于程序匹配，`code` 保留可读形式。

## WorkCast：作品参演关系

连接作品与女优的中间关系表。

```text
Actress N ── N Work
```

`position` 用于在来源提供顺序时保存稳定的演员排序。

## Maker / Label / Series：厂商 / 厂牌 / 系列

三者作为独立实体维护。

不要把它们永久压平成 `works.csv` 中的一段普通文本，因为未来这些实体本身还会拥有更多属性、别名、来源和页面。

## Director / WorkDirector：导演与作品导演关系

导演作为独立实体维护：

```text
Work N ── N Director
```

主数据分别位于：

```text
data/taxonomy/directors.csv
data/relations/work_directors.csv
```

这样同一导演可以关联多部作品，一个作品也可以保留多位导演及其顺序。

## Genre：分类 / 标签

保存 Averia 规范化的分类词汇。

```text
work_genres.csv
```

负责连接作品与分类。

分类同义词、多语言名称等可以在后续 Schema 版本继续扩展。

## SourceRecord：来源记录

用于把 Averia 内部实体与外部来源记录关联起来。

这是 V1 的数据溯源基础层。

后续可以在不破坏核心实体 ID 的前提下继续增加：

```text
Observation
FieldResolution
```

用于保存字段级来源观察值和冲突裁决结果。
