# Averia 数据质量检查 — V0.2

执行：

```bash
pnpm data:quality
```

报告输出到：

```text
var/reports/data-quality.md
```

当前检查包括：

- 同一标准化番号是否指向多个不同作品；
- 女优姓名 / 别名的精确标准化键是否跨实体冲突；
- `works.primary_code` 是否缺少对应主番号记录；
- `source_records` 是否指向不存在的实体。

CI 中使用：

```bash
pnpm data:quality -- --fail-on-error
```

警告不会阻断，错误会阻断。
