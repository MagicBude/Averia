# Averia V0.5.1 升级说明

## 背景

第一次真实 `import:apply` 时，MOODYZ Provider 的 `fetched_at` 使用标准 ISO 8601 毫秒时间：

```text
2026-08-31T14:36:25.486Z
```

旧校验器只接受秒级 `YYYY-MM-DDTHH:mm:ssZ`，因此写入后校验失败并触发自动回滚。正式数据没有被污染。

## 修复

时间戳校验现在接受两种 UTC ISO 8601 精度：

```text
2026-08-31T14:36:25Z
2026-08-31T14:36:25.486Z
```

仍然拒绝：

- 非 UTC `Z` 格式；
- 非法日期；
- 超过 3 位的小数秒；
- 非 ISO 日期时间分隔格式。

## 回归

V0.5.1 使用真实 MOODYZ 作品 canonical + 女优 canonical 执行：

```text
Canonical Merge → Prepare → Apply → Validate → Quality → Test
```

确认带毫秒的 `source_records.fetched_at` 可以安全写入正式 CSV。

## 测试隔离修复

第一次真实数据写入后还发现，少数测试直接读取正式 Catalog 并假设 MOODYZ Fixture 一定是全新实体。这会导致仓库有真实数据后 `pnpm test` 误失败。

V0.5.1 将需要“空数据前提”的单元测试改为显式空 Catalog Fixture；读取正式 CSV 的数据完整性测试仍保留。这样测试结果不再取决于资料库是否为空。
