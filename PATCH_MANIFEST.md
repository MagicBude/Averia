# Averia V0.3.2 Patch Manifest

本补丁不包含 `data/`，不会覆盖正式 CSV。

## 新增

- `scripts/lib/network-proxy.mjs`
- `tests/network-proxy.test.mjs`
- `docs/SOURCE_STRATEGY.md`
- `UPGRADE_V0.3.2.md`

## 更新

- `scripts/provider-javdatabase.mjs`
- `scripts/providers/javdatabase/lib.mjs`
- `tests/provider-javdatabase.test.mjs`
- `docs/JAVDATABASE_PROVIDER.md`
- `docs/ROADMAP.md`
- `README.md`
- `AGENTS.md`
- `DATA_STANDARD.md`
- `package.json`

## 验证

- Node tests: 19 / 19 passed
- 数据集校验：11 / 11 passed
- 数据质量：0 error / 0 warning
- 离线 Provider：成功生成 raw/canonical/meta，未修改正式 CSV
