# Averia 数据源策略

Averia 的目标不是“找一个网站全部照抄”，而是建立可追溯的多源元数据资料库。

## 核心原则

1. **日文原始数据优先**：作品标题、女优日文名、厂商/厂牌/系列等核心字段优先采用日本官方或原生日文来源。
2. **来源语言不可混淆**：英文来源提供的翻译标题不能覆盖 `title_ja`；英文名不能覆盖 `name_ja`。
3. **结构化官方接口优先于网页抓取**：有稳定 API 时优先 API，网页 HTML Provider 作为补充。
4. **任何来源都不是绝对真理**：原始值应保留来源记录，冲突通过后续 Observation / Resolution 机制裁决。
5. **Provider 永远不直接写正式 CSV**：仍然经过 canonical JSON → Prepare → Report → Apply。

## 来源层级

### A 级：日文官方 / 结构化主源

#### FANZA / DMM Web API

定位：Averia 的首选广覆盖日文主源。

适合字段：

- 日文作品标题
- Content ID / 商品 ID
- 发行/配信日期
- 出演女优
- メーカー（厂商）
- シリーズ（系列）
- ジャンル（分类）
- 女优日文名及部分プロフィール字段

优点：官方、日文、JSON/XML 结构化、覆盖范围广，不需要依赖 HTML DOM。

注意：需要 DMM 会員、DMM Affiliate、Web API 利用注册和 API ID。凭据只能通过环境变量/本地私密配置提供，禁止提交 Git。

### A-/B+ 级：厂商官方日文站

例如 SOD 官方、各メーカー/レーベル官方站。

定位：针对该厂商自己的作品/女优时，通常拥有非常高的字段权威性。

缺点：站点分散、页面结构不统一，不适合作为全库唯一入口。

### B 级：MGS 等日本正规发行/配信平台

定位：补充 FANZA 覆盖不到、独占或厂商特定作品；保留原生日文标题和站内 ID。

不把 MGS 当作唯一主源，因为其覆盖范围和 FANZA 不完全相同。

### C 级：聚合/二次整理来源

#### JAVDatabase

定位从 V0.3 起调整为 **英文补充源 / 交叉验证源**。

适合字段：

- Content ID 交叉核对
- 英文标题
- 英文女优名 / 罗马字别名
- 演员表交叉核对
- 历史资料补缺

不再把以下字段当作日文主数据依据：

- `title_ja`
- `name_ja`
- 日文ジャンル名称
- 日文メーカー/シリーズ标准名

JAVDatabase 自身也说明当前电影数据直接来自日本站点并经过人工编辑，因此它仍然有很高的补充价值，但其产品定位明确是英文 JAV 数据库。

## 字段建议优先级

| 字段 | 首选 | 次选 | 补充 |
| --- | --- | --- | --- |
| 作品日文标题 `title_ja` | FANZA / 厂商官方 | MGS | 不使用英文翻译覆盖 |
| 主番号 | 厂商官方 / FANZA | MGS | JAVDatabase 校验 |
| Content ID | FANZA | MGS | JAVDatabase 校验 |
| 女优日文名 `name_ja` | FANZA / 厂商官方 | MGS | JAVDatabase JP 字段 |
| 女优英文名 `name_en` | 明确官方罗马字 | JAVDatabase | 后续人工补充 |
| 厂商/系列 | FANZA / 厂商官方 | MGS | JAVDatabase 校验 |
| 分类/ジャンル | 各来源分别保存观察值 | 映射到 Averia taxonomy | 禁止按英文翻译直接覆盖 |

## 下一阶段

V0.4 建立 `FANZA Provider`：

1. 使用 DMM Web API，而不是优先抓 FANZA HTML；
2. API 凭据通过环境变量读取；
3. 保存原始 API JSON 快照；
4. 转换为 Averia canonical JSON；
5. 先用单个番号做真实 Probe；
6. 与 JAVDatabase 的同一作品结果生成差异报告；
7. 确认字段映射后再考虑批量导入。
