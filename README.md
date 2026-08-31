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
│  │  └─ work_genres.csv
│  ├─ taxonomy/                 # 厂商、厂牌、系列、分类
│  │  ├─ makers.csv
│  │  ├─ labels.csv
│  │  ├─ series.csv
│  │  └─ genres.csv
│  └─ sources/                  # 数据来源与溯源
│     └─ source_records.csv
├─ exports/                     # 自动生成，不作为主数据维护
│  ├─ json/
│  └─ xlsx/
├─ schemas/                     # CSV 数据契约
├─ scripts/                     # 校验与导出脚本
├─ tests/                       # 基础测试
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
                                           └──< 作品分类 WorkGenre >── 分类 Genre

任意核心实体 ──< 数据来源 SourceRecord
```

## 环境要求

- Node.js 20 或更高版本
- pnpm 9 或更高版本

本初始化包固定使用：

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
| `pnpm test` | 运行 Node.js 基础测试 |
| `pnpm check` | 运行数据校验和测试 |

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

### 阶段 2：数据处理 Pipeline

增加数据源适配器、标准化、去重、身份匹配、数据溯源以及冲突处理。

### 阶段 3：数据库

优先增加 SQLite；后续数据量和部署需求扩大时，可迁移或同步到 PostgreSQL。

### 阶段 4：应用层

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

1. [`DATA_STANDARD.md`](./DATA_STANDARD.md) — Averia V1 核心数据规则
2. [`docs/FIELD_DICTIONARY.md`](./docs/FIELD_DICTIONARY.md) — CSV 字段中英文对照和含义
3. [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — 数据实体和关系设计
4. [`docs/CONTRIBUTING_DATA.md`](./docs/CONTRIBUTING_DATA.md) — 如何新增和修正数据
5. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 项目演进路线
6. [`AGENTS.md`](./AGENTS.md) — AI / 编码 Agent 工作规范

## License

V0.1 暂不声明数据内容许可证。

在正式公开大量来源数据或接受第三方数据贡献前，应分别确定：

- 源代码许可证
- 数据集许可证
- 图片等媒体资源的存储和使用策略
- 外部数据源的访问与引用规则
