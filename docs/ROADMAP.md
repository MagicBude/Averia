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

## V0.3 — Provider 与字段级溯源

针对允许且适合程序化访问的数据来源逐步增加 Provider：

```text
Fetch
  ↓
Raw Record
  ↓
Provider Parser
  ↓
Averia Import JSON
  ↓
V0.2 Pipeline
  ↓
Canonical CSV
```

同时增加：

- Observation：保存来源对字段的原始观察值
- Field Resolution：记录最终字段值选择依据
- 多来源冲突报告
- Provider fixture / parser 测试
- 请求速率、缓存和失败重试规范

## V0.4 — 本地数据库

- SQLite 物化
- 姓名 / 番号搜索索引
- 从规范 CSV 导入 SQLite
- CSV 仍保持唯一事实源

## V0.5 — API

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
