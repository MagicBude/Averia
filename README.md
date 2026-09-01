# Averia

> 面向 JAV 女优、作品及相关实体的结构化元数据资料库。

Averia 是一个**数据优先（Data First）**的元数据项目，用于长期整理女优、作品、厂商、厂牌、系列、分类标签以及相关来源信息。

项目初期明确采用 **CSV 作为唯一事实源（Source of Truth）**，并由 CSV 自动生成 **JSON** 和 **XLSX**。后续可以在不推翻核心数据模型的前提下继续增加 SQLite / PostgreSQL、API、搜索服务以及 Web 网站。


## 项目目标

- 使用适合 Git 管理和审查的 CSV 文件维护结构化数据。
- 为女优、作品、厂商等实体分配稳定的 Averia 内部 ID，避免依赖姓名、标题或番号作为主键。
- 保存外部来源和数据溯源信息，便于后续核对、纠错和多来源合并。
- 自动生成适合程序使用的 JSON 和适合人工浏览的 XLSX。
- 从第一天开始保持数据模型与未来关系型数据库兼容。
- 后续可以自然扩展为数据导入 Pipeline、API 和 Averia 网站。

## 为什么 CSV 字段名仍然使用英文

Averia 的说明文档、命令输出、测试名称和 Excel 展示层都以中文为主，但 CSV / JSON 的字段名保留英文，例如：

```text
primary_name
release_date
maker_id
```

这是有意设计的：英文机器字段更适合 TypeScript、数据库、JSON API 和跨平台工具链，不会因为界面语言变化而修改底层数据结构。

你平时人工查看时，可以直接使用生成的 `exports/xlsx/averia.xlsx`，其中工作表名称和表头均为中文。

完整中英文字段对照见：

- [`docs/FIELD_DICTIONARY.md`](./docs/FIELD_DICTIONARY.md)

## 仓库结构

```text
Averia/
├─ data/                         # 唯一事实源：CSV 主数据
│  ├─ actresses/                # 女优及别名
│  │  ├─ actresses.csv
│  │  └─ actress_aliases.csv
│  ├─ works/                    # 作品及番号
│  │  ├─ works.csv
│  │  └─ work_codes.csv
│  ├─ relations/                # 多对多关系
│  │  ├─ work_cast.csv
│  │  ├─ work_genres.csv
│  │  └─ work_directors.csv
│  ├─ taxonomy/                 # 厂商、厂牌、系列、分类
│  │  ├─ makers.csv
│  │  ├─ labels.csv
│  │  ├─ series.csv
│  │  ├─ genres.csv
│  │  └─ directors.csv
│  └─ sources/                  # 数据来源与溯源
│     └─ source_records.csv
├─ exports/                     # 自动生成，不作为主数据维护
│  ├─ json/
│  └─ xlsx/
├─ schemas/                     # CSV 数据契约
├─ scripts/                     # 校验、导出、导入与 Provider 脚本
├─ imports/                     # 统一导入格式示例（正式批次保存在 var/）
├─ tests/                       # 基础测试与 Provider Fixture
├─ docs/                        # 项目文档
├─ AGENTS.md                    # AI / Agent 协作规范
└─ DATA_STANDARD.md             # 核心数据标准
```

## 核心数据模型

```text
女优 Actress ──< 女优别名 ActressAlias

女优 Actress >── 参演关系 WorkCast ──< 作品 Work >── 厂商 Maker
                                           │   ├──── 厂牌 Label
                                           │   └──── 系列 Series
                                           │
                                           ├──< 番号 WorkCode
                                           ├──< 作品分类 WorkGenre >── 分类 Genre
                                           └──< 作品导演 WorkDirector >── 导演 Director

任意核心实体 ──< 数据来源 SourceRecord
```

## 环境要求

- Node.js 20 或更高版本
- pnpm 9 或更高版本

当前项目固定使用：

```text
pnpm 11.21.0
```

## 第一次运行

```bash
pnpm install
pnpm check
pnpm data:export
```

`pnpm data:export` 会先校验 CSV，然后自动生成：

```text
exports/json/averia.json
exports/json/*.json
exports/xlsx/averia.xlsx
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm data:validate` | 校验 CSV 表头、ID、外键、布尔值、日期及部分业务约束 |
| `pnpm data:export:json` | 从 CSV 生成 JSON |
| `pnpm data:export:xlsx` | 从 CSV 生成中文 XLSX 工作簿 |
| `pnpm data:export` | 先校验，再生成全部导出文件 |
| `pnpm data:quality` | 生成数据质量报告 |
| `pnpm import:prepare -- --file <file> --batch <id>` | 准备安全导入批次，不修改正式 CSV |
| `pnpm import:report -- --batch <id>` | 查看导入审核报告 |
| `pnpm import:apply -- --batch <id>` | 备份、写入并校验已审核批次 |
| `pnpm provider:javdatabase -- --code <番号>` | 抓取并解析一个 JAVDatabase 作品页，不写正式 CSV |
| `pnpm provider:javdatabase -- --idol <slug>` | 抓取并解析一个 JAVDatabase 女优页，不写正式 CSV |
| `pnpm provider:moodyz -- --code <番号>` | 抓取并解析一个 MOODYZ 官方日文作品页，不写正式 CSV |
| `pnpm provider:moodyz -- --actress-id <ID>` | 抓取并解析一个 MOODYZ 官方女优页，不写正式 CSV |
| `pnpm test` | 运行 Node.js 基础测试 |
| `pnpm check` | 运行数据校验、质量检查和测试 |

## 唯一事实源

只有 `data/` 目录下的 CSV 文件属于权威数据。

**不要直接修改 `exports/` 下自动生成的 JSON 或 XLSX 文件。**

发现数据错误时，应修改对应 CSV，然后重新执行：

```bash
pnpm data:export
```

## 项目阶段

### 阶段 1：结构化数据集

```text
CSV → JSON / XLSX
```

### 阶段 2：数据质量与安全导入 Pipeline（V0.2）

已经加入统一导入 JSON、精确实体匹配、Stage 审核、备份/回滚、正式 CSV 指纹保护以及数据质量报告。具体外部站点 Provider 在后续版本逐步接入。

### 阶段 3：真实数据源 Provider（V0.3）

已经加入第一个 **JAVDatabase 单页 Provider**。它只负责：

```text
JAVDatabase 页面 → raw.html → Parser → canonical.json → V0.2 Prepare / Report / Apply
```

Provider **绝不直接修改 `data/`**。当前刻意限制为单页抓取，不做全站遍历、并发批量请求、图片下载或任何访问限制绕过。

第一次验证建议：

```bash
pnpm provider:javdatabase -- --code SDAM-179
```

然后只执行 CLI 打印的 `import:prepare` 和 `import:report`，先人工审核 Stage，再决定是否 Apply。

### 阶段 4：日文官方主数据源（V0.4）

已经加入 **MOODYZ Official Provider**，作为第一个日文厂商官方来源：

```text
MOODYZ 官方页 → raw.html → canonical.json → Prepare / Report / Apply
```

作品页优先保留日文标题、品番、発売日、女优、Label、Series、Genre 和收录时间；女优页保留日文姓名、官方罗马字、身高和三围。JAVDatabase 继续作为英文补充和交叉验证源。

第一次验证建议：

```bash
pnpm provider:moodyz -- --code MDVR-434
```

V0.4.1 增加网络传输兼容层：默认 `auto`，Windows + 代理环境下优先使用系统 `curl`；其它环境若 Node `fetch()` 出现 `ECONNRESET`、连接超时或 TLS 类错误，会自动回退到 `curl`。代理地址仍然动态读取，不写死在仓库中。

V0.4.2 根据真实 MOODYZ 页面修正标题解析：当前作品页与女优页主标题实际使用 `H2`，Parser 现在按 `H1 → H2 → og:title → <title>` 逐级解析，并跳过空标题；Parser 失败时仍会保留 `raw.html` 与失败 `meta.json`，方便离线复现。

当前仍只允许单页抓取，不递归遍历、不批量并发。

### 阶段 5：数据库

优先增加 SQLite；后续数据量和部署需求扩大时，可迁移或同步到 PostgreSQL。

### 阶段 6：应用层

在稳定数据层之上建设：

- API
- 全文搜索
- 数据统计
- 女优资料页
- 作品详情页
- 厂商 / 厂牌 / 系列浏览
- Averia Web 网站

## 文档入口

建议按以下顺序阅读：

- 版本演进与变更记录：[`CHANGELOG.md`](./CHANGELOG.md)
- 数据源策略与多来源权威性：[`docs/SOURCE_STRATEGY.md`](./docs/SOURCE_STRATEGY.md)

1. [`DATA_STANDARD.md`](./DATA_STANDARD.md) — Averia V1 核心数据规则
2. [`docs/FIELD_DICTIONARY.md`](./docs/FIELD_DICTIONARY.md) — CSV 字段中英文对照和含义
3. [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — 数据实体和关系设计
4. [`docs/CONTRIBUTING_DATA.md`](./docs/CONTRIBUTING_DATA.md) — 如何新增和修正数据
5. [`docs/IMPORT_FORMAT.md`](./docs/IMPORT_FORMAT.md) — V0.2 统一导入 JSON 格式
6. [`docs/IMPORT_PIPELINE.md`](./docs/IMPORT_PIPELINE.md) — 安全导入、审核、备份和回滚流程
7. [`docs/DATA_QUALITY.md`](./docs/DATA_QUALITY.md) — 数据质量检查
8. [`docs/JAVDATABASE_PROVIDER.md`](./docs/JAVDATABASE_PROVIDER.md) — V0.3 英文补充 Provider
9. [`docs/MOODYZ_PROVIDER.md`](./docs/MOODYZ_PROVIDER.md) — V0.4 首个日文厂商官方 Provider
10. [`docs/SOURCE_STRATEGY.md`](./docs/SOURCE_STRATEGY.md) — 多来源语言与权威性策略
11. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 项目演进路线
12. [`AGENTS.md`](./AGENTS.md) — AI / 编码 Agent 工作规范

## License

V0.3 暂不声明数据内容许可证。

在正式公开大量来源数据或接受第三方数据贡献前，应分别确定：

- 源代码许可证
- 数据集许可证
- 图片等媒体资源的存储和使用策略
- 外部数据源的访问与引用规则

## 版本历史

Averia 的逐版本变更、新增 Provider、数据模型调整与安全约束（年龄确认、明文 HTTP 拒绝、代理凭据不落库、字段冲突人工裁决等）统一记录在 [`CHANGELOG.md`](./CHANGELOG.md)。

当前数据源策略与多来源权威性见 [`docs/SOURCE_STRATEGY.md`](./docs/SOURCE_STRATEGY.md)。各 Provider 的使用细节见 `docs/` 下对应文档。
