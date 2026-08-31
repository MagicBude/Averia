# Averia V0.4.2 Patch Manifest

这是 V0.4.1 的 MOODYZ 真实页面 Parser 修复补丁，不包含 `data/`、`exports/` 或 `var/` 数据。

## 修改

- `package.json`：版本提升到 `0.4.2`
- `scripts/providers/moodyz/lib.mjs`：兼容空 H1 / H2 / og:title / title，Provider 版本提升到 3
- `scripts/provider-moodyz.mjs`：Parser 前保存 raw.html；失败保留 meta.json
- `tests/provider-moodyz.test.mjs`：增加真实标题结构与失败快照回归测试
- `tests/fixtures/moodyz/work-mdvr434.html`：改为当前真实页面的空 H1 + H2 结构
- `tests/fixtures/moodyz/actress-855540.html`：改为当前真实页面的空 H1 + H2 结构
- `docs/MOODYZ_PROVIDER.md`
- `README.md`
- `UPGRADE_V0.4.2.md`

## 本地验证结果

```text
11 个数据集校验通过
0 个数据质量错误
0 个警告
32 / 32 Node 测试通过
```
