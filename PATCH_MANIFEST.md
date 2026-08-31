# Averia V0.6.0 Patch Manifest

本补丁只包含代码、测试和文档，不包含 `data/`、`exports/json/`、`exports/xlsx/averia.xlsx` 或 `var/`，不会覆盖用户已经写入的真实数据。

主要变化：

- `package.json`：版本升级到 0.6.0，新增 `provider:dmm-rental`。
- `scripts/providers/dmm-rental/lib.mjs`：DMM Rental 单页 Parser / URL / CID / 封面 / 网络入口。
- `scripts/provider-dmm-rental.mjs`：DMM Rental CLI。
- `scripts/import/lib.mjs`：修复非空 Series 首次创建时错误访问 `seriess`。
- `scripts/export/xlsx.mjs`：XLSX 总览数据构建与固定 Sheet 顺序。
- `scripts/export-xlsx.mjs`：新增“女优总览/作品总览”，固定“女优 → 女优别名 → …”顺序。
- `tests/provider-dmm-rental.test.mjs`：DMM Parser / Prepare / CLI 回归。
- `tests/export-xlsx.test.mjs`：Sheet 顺序和总览解引用回归。
- `tests/fixtures/dmm-rental/work-4ipzz698.html`：基于公开页面字段结构的离线 Fixture。
- `docs/DMM_RENTAL_PROVIDER.md`：Provider 使用与字段语义。
- `docs/SOURCE_STRATEGY.md`：加入 DMM HTML 参考源层级。
- `docs/ROADMAP.md`：同步 V0.5/V0.6 已完成里程碑并顺延后续路线。
- `exports/xlsx/README.md`：说明总览与工作表顺序。
- `UPGRADE_V0.6.0.md`：升级说明。
