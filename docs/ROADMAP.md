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

## V0.4 — 日文厂商官方 Provider ✅（当前）

首个实现：MOODYZ Official Provider。

```text
日文官方 HTML
   ↓
Raw Snapshot
   ↓
Provider Parser
   ↓
Averia canonical JSON
   ↓
Prepare / Report / Apply
```

当前能力：

- MOODYZ 单作品页
- MOODYZ 单女优页
- 日文标题 / 女优名 / 品番 / 発売日
- Label / Series / Genre / 时长
- 女优官方罗马字 / 身高 / 三围
- 发现关联作品但不递归抓取

下一步：

- 用真实 MOODYZ 页面执行首次 Prepare / Report
- 根据真实 HTML 修正 Parser 边界
- 选择第二个官方厂商站验证可复用程度
- 调研 MGS 作为跨厂商日文发行平台补源

DMM/FANZA Web API 保留为未来选项，但当前因 Affiliate 注册需要日本国内收款账户而延期，不通过不合规方式绕过。

## V0.5 — 字段级溯源与多来源冲突

- Observation：保存来源对字段的原始观察值
- Field Resolution：记录最终字段值的选择依据
- 日文官方源、发行平台、英文补充源的字段冲突报告
- Provider 版本迁移与 Raw Snapshot 重新解析机制

## V0.6 — 本地数据库

- SQLite 物化
- 姓名 / 番号搜索索引
- 从规范 CSV 导入 SQLite
- CSV 仍保持唯一事实源

## V0.7 — API

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
