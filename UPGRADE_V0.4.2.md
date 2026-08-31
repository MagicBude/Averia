# Averia V0.4.2 升级说明

V0.4.2 修复真实 MOODYZ 页面主标题并非 `H1` 导致的解析失败。

## 根因

真实 `https://moodyz.com/works/detail/MDVR434` 与女优详情页当前使用 `H2` 作为页面主标题，并可能存在空 `H1`。V0.4.1 Fixture 使用了 `H1`，导致测试通过但真实页面失败。

## 修复

- 标题解析改为 `非空 H1 → 非空 H2 → og:title → <title>`。
- 跳过空标题与通用区块标题。
- `meta.json` 新增 `title_source`，便于诊断真实解析来源。
- Fixture 改为与当前真实页面一致的“空 H1 + H2 主标题”。
- 网络抓取成功后先保存 `raw.html`，Parser 失败仍保留原始现场与失败 `meta.json`。
- Parser 失败不会生成 `canonical.json`，更不会修改正式 CSV。

## 验证

```bash
pnpm check
pnpm provider:moodyz -- --code MDVR-434
```

成功后再根据终端提示执行 `import:prepare` 与 `import:report`，不要直接 Apply。
