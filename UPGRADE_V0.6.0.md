# Averia V0.6.0 升级说明

V0.6.0 包含两个面向实际使用的重要增强。

## 1. DMM Rental 日文参考 Provider

新增：

```bash
pnpm provider:dmm-rental -- --cid 4ipzz698
```

Provider 只处理单个公开宅配 Rental 详情页，输出 `raw.html / canonical.json / meta.json`，不直接写正式 CSV。

来源角色固定为：

```text
language = ja
role = reference
```

厂商官方 Provider 仍然拥有更高数据优先级。

特别注意：DMM Rental 的 `貸出開始日` 不等同于作品发行日，因此不会写入 `release_date`。

详见 `docs/DMM_RENTAL_PROVIDER.md`。

## 2. XLSX 人类阅读总览与固定 Sheet 顺序

`averia.xlsx` 新增：

- `女优总览`
- `作品总览`

并把规范 Sheet 顺序固定为：

```text
女优 → 女优别名 → 作品 → 作品番号 → 作品参演 → 作品分类 → 作品导演
→ 厂商 → 厂牌 → 系列 → 分类 → 导演 → 数据来源
```

最终工作簿顺序为：

```text
女优总览
作品总览
女优
女优别名
作品
...
```

覆盖补丁后执行：

```bash
pnpm check
pnpm data:export
```

## 3. 修复 Series 首次创建时的复数表名错误

旧版导入器用 `${kind}s` 推导简单实体数据集名称，导致 `series` 被错误拼成 `seriess`。此前真实数据中的 Series 为空，所以没有触发。V0.6 改为显式映射数据集名称，并通过 DMM 的 `引退作` Fixture 覆盖这一场景。
