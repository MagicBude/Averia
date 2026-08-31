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

## V0.3 — 第一个真实数据源 Provider ✅（当前）

数据链路：

```text
Fetch
  ↓
Raw HTML Snapshot
  ↓
Provider Parser
  ↓
Averia Import JSON
  ↓
V0.2 Prepare / Report / Apply
  ↓
Canonical CSV
```

当前完成：

- JAVDatabase 单作品页抓取与解析
- JAVDatabase 单女优页抓取与解析
- 原始 HTML 快照与 SHA-256
- 统一导入 JSON 输出
- Content ID 附加番号
- Provider Fixture 自动测试
- 离线 HTML Parser 模式
- URL 主机与页面类型白名单

下一步验证：

- 小规模真实数据审核与首次 Apply
- 根据真实数据修正字段映射
- 再设计 Provider 批次队列、请求间隔、缓存与失败重试

V0.3 不做全站遍历，先以单页方式稳定字段映射和数据模型。

## V0.4 — 字段级溯源与多来源冲突

- Observation：保存来源对字段的原始观察值
- Field Resolution：记录最终字段值的选择依据
- 多来源冲突报告
- Provider 版本迁移与重新解析机制

## V0.5 — 本地数据库

- SQLite 物化
- 姓名 / 番号搜索索引
- 从规范 CSV 导入 SQLite
- CSV 仍保持唯一事实源

## V0.6 — API

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
