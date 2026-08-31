# Averia V0.5.0 Patch Manifest

本补丁基于 V0.4.7，新增 Canonical Merge，不包含 `data/`、`exports/` 或 `var/`。

主要变更：

- `scripts/canonical/merge.mjs`：同来源 canonical 的确定性合并核心。
- `scripts/canonical-merge.mjs`：Canonical Merge CLI。
- `tests/canonical-merge.test.mjs`：真实 MOODYZ 作品页 + 女优页合并、Prepare 与冲突阻断测试。
- `package.json`：新增 `canonical:merge`，版本更新至 0.5.0。
- `UPGRADE_V0.5.0.md`：升级与使用说明。
- `README.md`、`AGENTS.md`、`DATA_STANDARD.md`：补充“先 Merge 再 Prepare”的项目规则。
