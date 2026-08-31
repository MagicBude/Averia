# Averia V0.4.3 增量包清单

本补丁在第一次真实数据 Apply 前补齐导演数据模型。

## 新增文件

- `data/taxonomy/directors.csv`
- `data/relations/work_directors.csv`
- `schemas/directors.schema.json`
- `schemas/work_directors.schema.json`
- `UPGRADE_V0.4.3.md`

## 修改文件

- `package.json`
- `schemas/source_records.schema.json`
- `scripts/import/lib.mjs`
- `scripts/providers/moodyz/lib.mjs`
- `scripts/provider-moodyz.mjs`
- `scripts/quality-report.mjs`
- `tests/catalog.test.mjs`
- `tests/import.test.mjs`
- `tests/provider-javdatabase.test.mjs`
- `tests/provider-moodyz.test.mjs`
- `README.md`
- `AGENTS.md`
- `DATA_STANDARD.md`
- `docs/CONTRIBUTING_DATA.md`
- `docs/DATA_MODEL.md`
- `docs/FIELD_DICTIONARY.md`
- `docs/IMPORT_FORMAT.md`
- `docs/MOODYZ_PROVIDER.md`

## 不包含

- 既有正式 CSV 数据
- `exports/`
- `var/`
- GitHub Pages 页面
- 任何代理地址、凭据或本地环境配置

## 验证结果

- 13 个数据集校验通过，0 行正式数据
- 数据质量：0 error / 0 warning
- 自动测试：33 / 33 通过
- `MDVR-434` 离线 Provider → Prepare → Report 验证通过
- 该批次可生成 `directors=1` 与 `work_directors=1`
