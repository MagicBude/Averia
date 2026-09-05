# Averia 数据标准 — V1

版本：`1.0`

本文档定义 Averia 第一阶段结构化数据集的统一规则。

## 1. 唯一事实源

`data/` 目录下的 CSV 文件为权威数据源。

JSON 与 XLSX 均由 CSV 自动生成，不允许把导出文件反过来作为主数据维护。

### 编码

```text
UTF-8
```

### CSV 基本规则

- 必须包含表头。
- 使用英文逗号 `,` 作为分隔符。
- 支持 RFC 4180 风格的引号转义。
- 未知或缺失值使用空字段表示。
- 不要用 `N/A`、`null`、`unknown`、`-` 等字符串代替空值，除非该字符串确实就是来源原文。

## 2. 稳定 ID 格式

核心实体使用“小写英文前缀 + 六位十进制数字”的内部 ID。

```text
actress_000001
alias_000001
work_000001
code_000001
maker_000001
label_000001
series_000001
genre_000001
source_000001
```

规则：

- ID 一旦公开或写入正式数据，不再修改。
- 删除记录后也不得复用旧 ID。
- 姓名、番号、标题等不能替代内部 ID。

## 3. 番号标准化

`primary_code` 保存 Averia 首选的人类可读番号。

`normalized_code` 用于程序匹配。

示例：

```text
原始/首选番号：SSIS-001
标准化番号：   SSIS001
```

V1 标准化规则：

1. 去除首尾空白。
2. ASCII 英文字母转换为大写。
3. 删除空格、连字符 `-`、下划线 `_` 和点号 `.`。
4. 保留其余字母和数字字符。

禁止仅凭标题相似就判定两个作品一定相同。

## 4. 日期与时间

### 日期

统一使用：

```text
YYYY-MM-DD
```

例如：

```text
2026-08-31
```

### 时间戳

统一使用 UTC ISO 8601。允许秒级或毫秒级精度：

```text
YYYY-MM-DDTHH:mm:ssZ
YYYY-MM-DDTHH:mm:ss.SSSZ
```

例如：

```text
2026-08-31T08:30:00Z
2026-08-31T08:30:00.486Z
```

必须使用 `Z` 表示 UTC；当前不接受 `+08:00` 等偏移时区格式。Provider 的原始抓取时间可以保留毫秒精度，程序自动生成的业务时间戳可继续使用秒级精度。

V1 的导出文件默认不加入没有业务意义的“生成时间”，避免每次导出都产生无意义 Git diff。

## 5. 布尔值

CSV 中布尔值仅使用小写：

```text
true
false
```

不要使用：

```text
True
FALSE
1
0
yes
no
```

## 6. 整数与单位

数值字段只保存数字，单位写在字段名中。

例如：

```text
height_cm = 163
duration_min = 120
position = 1
```

不要写成：

```text
163cm
120分钟
第1位
```

## 7. 女优姓名与别名

`primary_name` 是 Averia 选择的首选显示名称。

其他名字统一保存到：

```text
data/actresses/actress_aliases.csv
```

别名可以表示：

- 曾用艺名
- 其他艺名
- 不同汉字写法
- 罗马字
- 中文译名
- 假名
- 来源站点特有名称

不能因为出现另一个别名就新建一个女优实体。

## 8. 作品

`works.csv` 保存作品级的规范元数据。

每个作品都拥有独立的：

```text
work_XXXXXX
```

内部 ID。

番号同时保存在：

- `works.primary_code`：方便查看和查询
- `work_codes.csv`：保存一个作品的一个或多个番号/番号表现形式

这种适度重复是有意设计的，后续校验工具负责检查一致性。

## 9. 多对多关系

多对多关系必须使用独立关系表。

例如：

```text
work_cast.csv
work_genres.csv
work_directors.csv
```

禁止在 `works.csv` 中设计：

```text
actress_1
actress_2
actress_3

genre_1
genre_2
genre_3
```

因为参演人数和分类数量都是不固定的。

## 10. 数据来源与溯源

外部数据应尽量通过：

```text
source_records.csv
```

建立来源记录。

来源记录可保存：

- Averia 实体
- 来源名称
- 来源站点记录 ID
- 来源 URL
- 抓取 / 观察时间
- 原始内容 Hash
- 备注

### 10.1 字段级溯源三表（V0.8 起）

除 `source_records`（按实体）外，V0.8 引入三张字段级溯源 / 归并表，均为正式 CSV（CSV 仍为唯一事实源）：

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `observations` | 字段级原始观察日志（append-only，永不覆盖） | `entity_type`/`entity_id`/`field`/`observed_value`/`observed_language`/`source_name`/`raw_hash` |
| `field_resolutions` | 某实体某字段最终采用哪个值、依据、胜出来源 | `field`/`resolved_value`/`resolution_method`/`winning_source_name`/`status`/`conflicting_observation_ids` |
| `entity_aliases` | 跨源 / 跨语言别名与外部身份（显式，matcher 当精确键） | `entity_type`/`entity_id`/`alias`/`alias_type`/`language`/`source_name` |

规则（详见 [`FIELD_RESOLUTION.md`](./FIELD_RESOLUTION.md) 与 `AGENTS.md`）：

- 跨语言 / 跨源实体等同**只能**通过显式 `entity_aliases` 或人工 `resolution` 建立；字符串相似度**绝不**自动合并。
- 两个可靠来源对同一非空字段给出不同值 → 生成 `field_resolutions(status=pending_review)`，**阻断**该字段 Apply，直到人工裁决（`resolution:decide` / `resolve:link`）。
- `field_resolutions.method=auto_fill` 仅用于「字段为空且单一来源」的安全补全，不产生冲突。

## 11. 女优状态

V1 `status` 可使用：

```text
active
inactive
retired
unknown
```

含义：

| 值 | 中文含义 |
| --- | --- |
| `active` | 活跃 |
| `inactive` | 暂无活动 / 非活跃 |
| `retired` | 已引退 |
| `unknown` | 状态未知 |

如果尚未判断状态，也可以暂时留空。

## 12. 语言代码

语言字段尽量使用 BCP 47 风格代码。

例如：

```text
ja
en
zh-CN
zh-TW
```

不要在底层字段中混用：

```text
中文
日语
英语
```

展示层可以再转换为中文名称。

## 13. URL

已知时优先保存规范的绝对 URL。

CSV / JSON 中不保存图片二进制数据或 Base64 图片。

图片相关字段只保存：

- URL
- 未来的 image_id
- 或其他资源标识

## 14. 排序规则

为了让 Git diff 稳定，推荐：

- 实体表：按 `id` 排序
- `work_cast.csv`：按 `work_id` → `position` → `actress_id`
- `work_genres.csv`：按 `work_id` → `genre_id`
- `work_directors.csv`：按 `work_id` → `position` → `director_id`
- `source_records.csv`：按 `id`

自动生成脚本必须尽量维持确定性顺序。

## 15. CSV 字段语言

CSV / JSON 作为程序接口层，字段名称统一使用英文。

中文含义见：

```text
docs/standards/FIELD_DICTIONARY.md
```

面向人的 XLSX 导出则使用中文工作表名和中文表头。

## 16. 破坏性 Schema 修改

以下行为属于破坏性变更：

- 删除字段
- 重命名字段
- 改变字段语义
- 改变主键规则
- 改变已有 ID 的含义

执行前至少必须：

1. 记录修改原因。
2. 提供数据迁移方案。
3. 更新 Schema。
4. 更新校验工具。
5. 更新导出脚本。
6. 更新测试。
7. 更新相关文档。


## 12. V0.2 数据导入边界

外部来源不能直接写入正式 CSV。统一流程为：

```text
Provider / 人工文件 → Averia Import JSON → Stage → 审核 → Apply → Canonical CSV
```

自动匹配必须是可解释且确定性的。V0.2 明确禁止模糊相似度自动合并。

已有实体的非空字段不会因为新来源出现不同值而自动覆盖；这类情况必须进入后续 Observation / Field Resolution 或人工审核机制。


## Provider 原始来源规则

从外部数据源进入 Averia 的数据必须先转换为统一导入 JSON，再进入 V0.2 Pipeline。Provider 本身不属于事实源。

对于可程序化获取的页面，至少保留：

- `source_record_id`：来源站内稳定记录标识；
- `source_url`：实际解析的来源页面；
- `fetched_at`：抓取时间；
- 原始页面快照；
- 原始页面 SHA-256；
- Provider / Parser 版本。

来源字段缺失、不完整或表达精度不足时，应保持空值或原始精度，不得通过猜测补全。不同来源出现冲突时，先保留来源证据，后续再通过字段级溯源机制解决。

## 数据源语言规范（V0.3.2 起）

- `title_ja`：仅保存日文原始/权威标题；英文翻译不得写入。
- `name_ja`：保存女优日文标准名；英文/罗马字进入 `name_en` 或 aliases。
- Provider 必须明确来源语言和角色；例如 JAVDatabase canonical source 使用 `language=en`、`role=supplemental`。
- 当日文主源与英文补充源冲突时，不自动覆盖，进入后续字段级 Observation / Resolution。
- FANZA / DMM Web API 作为下一阶段日文结构化主源，详见 `docs/strategy/SOURCE_STRATEGY.md`。



## 17. 导演实体与作品关系（V0.4.3）

导演必须作为独立 `Director` 实体保存，而不是仅写在作品备注或普通文本字段里。

```text
data/taxonomy/directors.csv
data/relations/work_directors.csv
```

规则：

- `director_id` 使用 `director_XXXXXX`。
- 同一作品允许多个导演。
- `position` 保存来源提供的顺序；没有明确顺序时按抓取顺序从 1 开始。
- 导演自动匹配只使用规范化名称精确匹配，不进行模糊猜测。


## 18. 业务图片 URL 规则（V0.4.4）

`cover_url` 与 `profile_image_url` 必须指向对应作品/女优的业务图片，不得写入站点 Logo、导航图标、默认品牌图等页面装饰资源。Provider 需要对图片候选进行来源与路径判断；若无法确定业务图片，宁可留空，也不要保存明显错误的站点资源。

## Canonical 多页面合并

同一 Provider 的作品页、女优页等独立抓取结果允许在进入 Stage 前合并。V0.5.0 的规则是：

1. 仅合并相同 `source.name`。
2. 同一 `source_record_id` 视为同一来源实体。
3. 空字段可以由更完整页面补齐。
4. 两个非空值不一致时禁止自动覆盖并终止合并。
5. 数组字段按稳定键去重，例如女优别名、作品 Genre、导演、Cast 和附加番号。
6. 合并产物不能绕过 `import:prepare` 和人工 Report 审核。
