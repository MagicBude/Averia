# Averia 开发路线图

## V0.1 — 数据仓库基础 ✅

- 规范 CSV 数据集
- 稳定实体 ID
- JSON 自动导出
- 中文 XLSX 自动导出
- Schema 与数据校验
- 来源记录 / 基础溯源
- 中文文档
- GitHub Actions CI

## V0.2 — 数据质量与安全导入 Pipeline ✅

- 统一导入 JSON 合同
- 女优精确姓名 / 别名匹配
- 作品标准化番号匹配
- 来源记录优先匹配
- 新实体稳定 ID 自动分配
- Prepare / Stage / Review / Apply 流程
- 正式 CSV 指纹保护
- Apply 前自动备份，校验失败自动回滚
- 已有实体字段只生成补全建议，不自动覆盖
- 重复番号、姓名冲突、来源悬空等数据质量报告

## V0.3 — 英文补充 Provider 与网络层 ✅

- JAVDatabase 单作品 / 单女优 Provider
- Raw HTML + SHA-256
- Content ID 附加番号
- Provider Fixture / 离线模式
- 自动代理：CLI → 环境变量 → Windows 系统代理 → Direct
- JAVDatabase 定位调整为英文补充 / 交叉验证源

## V0.4 — 日文厂商官方 Provider ✅

首个实现：MOODYZ Official Provider。

- 单作品页 / 单女优页
- 日文标题 / 女优名 / 品番 / 発売日
- Maker / Label / Series / Genre / 时长 / 导演
- 女优官方罗马字 / 身高 / 三围 / 头像
- 作品封面识别
- Node / curl 网络 fallback 与瞬时错误重试
- 真实 MDVR-434 + 純白彩永 完整链路验证

## V0.5 — Canonical Merge 与首次真实入库 ✅

- 同一来源多页面 canonical 安全合并
- 同一 source_record_id 的半成品实体与完整实体合并
- 非空字段冲突阻断
- 作品页关系 + 女优页完整资料一次 Prepare
- 首个 MOODYZ 官方作品与女优正式写入 CSV

## V0.6 — DMM Rental 日文参考源与 XLSX 总览 ✅

- FANZA/DMM 宅配单品 Rental 单页 Provider
- 日文标题 / 出演者 / 監督 / Series / Maker / Label / Genre / 时长 / 封面
- DMM CID 作为附加番号
- 保守 CID → 标准番号推导，并支持 `--code` 显式覆盖
- `貸出開始日` 与 `release_date` 严格区分
- `女优总览` / `作品总览` 人类阅读 Sheet
- 固定规范 Sheet 顺序：女优在女优别名前
- 修复首次创建非空 Series 时 `seriess` 表名错误
- 后续补丁见 CHANGELOG V0.6.1–V0.6.3（年龄确认、明文 HTTP 兼容、字段作用域修复）

## V0.7.0 — JavInfo API 主采集入口 ✅

- 新增 JavInfo API Provider（`pnpm provider:javinfo`），作为主采集入口
- API Key 仅从 `JAVINFO_API_KEY` 环境变量读取，不落库 / 不写日志 / 不进 URL
- Provenance：上游 `source=fanza` 在 Averia 写作 `javinfo-fanza`，明确经中间层获得，不冒充 FANZA 官方直连
- 已知边界：不做自动翻译或跨语言实体猜测，留待 V0.8 归并层
- 详见 CHANGELOG V0.7.0 与 `docs/providers/JAVINFO_PROVIDER.md`

## V0.8.0 — 多来源字段级溯源与实体归并（进行中）

- Observation / Field Resolution / entity_aliases 三表（schema + 空 CSV 进入事实源，不进 XLSX）
- 跨语言 / 跨源实体等同只能经显式 `entity_aliases` 或人工 `resolution` 建立；字符串相似度不自动合并
- 冲突不得静默 last-write-wins，进入 `field_resolutions(pending_review)` 阻断 Apply 直到人工裁决
- 已落地：Phase 1（三表 schema 骨架）、Phase 2（`import:prepare` 记录字段级 observations）、Phase 3（`entity_aliases` 精确别名匹配，防跨源重复实体核心修复）
- 待做：Phase 4（field_resolutions 冲突裁决 + 审核工作台）、Phase 5（JavInfo 多源独立请求）、Phase 6（IPZZ-597 / IPZZ-698 / MDVR-434 三样本回归）、Phase 7（文档收尾）
- 详见 `docs/design/V0.8-MULTI-SOURCE-RESOLUTION.md` 与 CHANGELOG V0.8.0

## V0.9 — 本地数据库 SQLite（派生只读层）

- **定位**：SQLite 是规范 CSV 的**物化 / 查询层**，不是事实源；CSV 仍保持唯一事实源（见 ADR-0001）
- `pnpm db:sync`：把所有 `data/*.csv` 导入单文件 `data/averia.db`
- FTS5 全文索引（番号 / 姓名 / 别名 / 标题）+ 常规索引（code / name / entity_id）
- `pnpm db:query`：只读查询，供 V1.0 API 与 V1.1 Web 直接消费
- 写入只走 `Prepare → Apply → CSV`；每次 `import:apply` 后自动 `db:sync` 刷新
- 物化范围：8 个核心实体表 + 关系表 +（V0.8 完成后）observations / field_resolutions / entity_aliases

## V1.0 — API

- 女优查询
- 作品查询
- 番号搜索
- 厂商 / 厂牌 / 系列 / 分类浏览
- 分页、筛选、排序

## V1.1 — Web 应用

- 搜索优先首页
- 女优资料页
- 作品详情页
- 厂商 / 厂牌 / 系列 / 分类页
- 实体关系跳转
- 数据集统计
- Averia 品牌界面
