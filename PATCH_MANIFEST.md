# Averia V0.4.1 Patch Manifest

这是 V0.4.0 的网络兼容修复补丁，不包含 `data/`、`exports/` 或 `var/` 正式/运行数据。

## 新增

- `scripts/lib/http-transport.mjs`
- `tests/http-transport.test.mjs`
- `UPGRADE_V0.4.1.md`

## 修改

- `package.json`：版本提升到 `0.4.1`
- `scripts/providers/moodyz/lib.mjs`：Node/curl 双 Transport
- `scripts/provider-moodyz.mjs`：自动选择 Transport，记录网络传输元数据
- `tests/provider-moodyz.test.mjs`：补充离线网络传输断言
- `docs/MOODYZ_PROVIDER.md`：网络兼容说明
- `README.md`
- `AGENTS.md`

## 验证目标

```text
11 个数据集校验通过
0 个数据质量错误
全部 Node 测试通过
MOODYZ 离线 Provider 不修改正式 CSV
ECONNRESET 自动回退 curl
Windows + 动态代理可优先 curl
```
