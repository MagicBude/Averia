# Averia V0.3.1 Hotfix

## 修复内容

V0.3.0 发布包漏打包了 `scripts/import/lib.mjs` 的新版实现，导致：

- JAVDatabase Provider 能正确解析 `Content ID`；
- `canonical.json` 中也能看到 `works[].codes[]`；
- 但进入 V0.2 的旧 `Prepare` 实现后，附加番号不会写入 Stage；
- 因此测试“JAVDatabase 作品的 Content ID 会作为附加番号进入 Stage”得到 `1 !== 2`。

V0.3.1 补齐新版导入核心，支持将 `works[].codes[]` 中的附加番号安全追加到 `work_codes`。

## 预期结果

以 `SDAM-179` Fixture 为例，Stage 中应生成两条 `work_codes`：

1. `SDAM-179`：`catalog`，主番号；
2. `1sdam00179`：`content-id`，非主番号。

## 升级

将本补丁解压覆盖到 Averia 根目录，然后执行：

```bash
pnpm check
```

预期 14/14 测试通过。
