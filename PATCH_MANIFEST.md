# Averia V0.4.0 Patch Manifest

主题：**首个日文厂商官方 Provider — MOODYZ**

## 新增

- `scripts/provider-moodyz.mjs`
- `scripts/providers/moodyz/lib.mjs`
- `tests/provider-moodyz.test.mjs`
- `tests/fixtures/moodyz/work-mdvr434.html`
- `tests/fixtures/moodyz/actress-855540.html`
- `docs/MOODYZ_PROVIDER.md`
- `UPGRADE_V0.4.md`

## 修改

- `package.json`
- `README.md`
- `AGENTS.md`
- `docs/SOURCE_STRATEGY.md`
- `docs/ROADMAP.md`

## 不包含

本补丁**不包含任何 `data/` 正式 CSV**，也不包含：

- `exports/`
- `var/`
- GitHub Pages 的 `docs/index.html`
- GitHub Pages 的 `docs/assets/`
- API 密钥 / Cookie / 代理端口等私密配置

因此覆盖到现有仓库时不会修改已经积累的正式数据，也不会覆盖现有 Pages 首页。

## 回归结果

在 V0.3.2 基线 + V0.4 变更上执行：

```text
数据校验：11 个数据集通过
数据质量：0 error / 0 warning
自动测试：24 / 24 通过
```

其中 V0.4 新增 5 个 MOODYZ Provider 测试。
