# Averia V0.5.1 Patch Manifest

本补丁修复第一次真实 Apply 暴露出的 UTC 时间戳毫秒兼容问题。

包含：

- `package.json`：版本升级到 0.5.1
- `scripts/lib/time.mjs`：统一 UTC ISO 8601 时间戳校验
- `scripts/validate-data.mjs`：接受秒级/毫秒级 UTC 时间戳
- `tests/time.test.mjs`：时间戳回归测试
- `tests/helpers/catalog.mjs`：提供隔离的空 Catalog 测试夹具
- `tests/import.test.mjs`、`tests/canonical-merge.test.mjs`、`tests/provider-moodyz.test.mjs`：移除“正式数据必须为空”的隐含假设
- `DATA_STANDARD.md`：更新时间规范
- `README.md`：补充 V0.5.1 说明
- `UPGRADE_V0.5.1.md`：升级说明

不包含 `data/`、`exports/` 或 `var/` 正式/运行时数据。
