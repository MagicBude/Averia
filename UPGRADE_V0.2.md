# Averia V0.2 增量升级说明

这是 V0.1 → V0.2 的**增量覆盖包**，没有包含 `data/` 下的正式 CSV，也不会覆盖你的现有数据。

## 升级

将压缩包内容解压到 Averia 仓库根目录并允许覆盖同名代码/文档，然后执行：

```bash
pnpm install
pnpm check
pnpm data:export
```

## 建议先跑示例，但不要 Apply

```bash
pnpm import:prepare -- --file imports/examples/canonical.example.json --batch demo-001
pnpm import:report -- --batch demo-001
```

这两条命令只写 `var/`，不会修改正式 CSV。示例使用虚构数据，只用于验证 Pipeline。

如果你确实执行了 `import:apply -- --batch demo-001`，示例虚构数据会写入正式 CSV，因此正常情况下不要 Apply 示例批次。
