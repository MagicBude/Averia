# Averia V0.4.7 Patch Manifest

本补丁基于 V0.4.6，只包含网络稳定性相关增量，不包含 `data/`、`exports/` 或 `var/`。

主要变更：

- `scripts/lib/http-transport.mjs`：增加 TLS/连接级瞬时错误重试。
- `scripts/provider-moodyz.mjs`：打印网络重试原因，版本更新至 V0.4.7。
- `scripts/providers/moodyz/lib.mjs`：Provider 版本与网络回调透传更新。
- `tests/http-transport.test.mjs`：增加 curl exit 35、组合回退、显式 curl 重试和永久错误不重试测试。
- `UPGRADE_V0.4.7.md`：升级说明。
- `package.json`：版本更新至 0.4.7。
