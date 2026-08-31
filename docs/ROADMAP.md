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

## V0.6 — DMM Rental 日文参考源与 XLSX 总览 ✅（当前）

- FANZA/DMM 宅配单品 Rental 单页 Provider
- 日文标题 / 出演者 / 監督 / Series / Maker / Label / Genre / 时长 / 封面
- DMM CID 作为附加番号
- 保守 CID → 标准番号推导，并支持 `--code` 显式覆盖
- `貸出開始日` 与 `release_date` 严格区分
- `女优总览` / `作品总览` 人类阅读 Sheet
- 固定规范 Sheet 顺序：女优在女优别名前
- 修复首次创建非空 Series 时 `seriess` 表名错误

## V0.7 — 字段级溯源与跨来源 Resolution

- Observation：保存来源对字段的原始观察值
- Field Resolution：记录最终字段值的选择依据
- 厂商官方源、DMM/MGS 发行平台、英文补充源的字段冲突报告
- 跨来源同作品/同女优对齐
- Provider 版本迁移与 Raw Snapshot 重新解析机制

## V0.8 — 本地数据库

- SQLite 物化
- 姓名 / 番号搜索索引
- 从规范 CSV 导入 SQLite
- CSV 仍保持唯一事实源

## V0.9 — API

- 女优查询
- 作品查询
- 番号搜索
- 厂商 / 厂牌 / 系列 / 分类浏览
- 分页、筛选、排序

## V1.0 — Web 应用

- 搜索优先首页
- 女优资料页
- 作品详情页
- 厂商 / 厂牌 / 系列 / 分类页
- 实体关系跳转
- 数据集统计
- Averia 品牌界面
