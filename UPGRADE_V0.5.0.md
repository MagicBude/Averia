# Averia V0.5.0 升级说明

V0.5.0 新增 Canonical Merge，用于把同一官方来源的多个单页 Provider 产物合并成一个可审核导入文件。

## 为什么需要合并

作品页通常只包含参演者姓名与来源 ID，而女优详情页可以补充罗马字、身高、三围、杯罩与头像。直接分别 Prepare 会产生两个审核批次；V0.5.0 改为先合并，再一次 Prepare。

## 使用方式

```bash
pnpm canonical:merge -- \
  --file "var/providers/moodyz/<作品批次>/canonical.json" \
  --file "var/providers/moodyz/<女优批次>/canonical.json" \
  --out "var/canonical/merged/moodyz-MDVR-434.json"
```

然后：

```bash
pnpm import:prepare -- --file "var/canonical/merged/moodyz-MDVR-434.json" --batch "moodyz-MDVR-434-full-20260831"
pnpm import:report -- --batch "moodyz-MDVR-434-full-20260831"
```

## 安全规则

- V0.5.0 只合并相同 `source.name` 的 canonical。
- 同一 `source_record_id` 才作为稳定的跨页面实体合并键。
- 空字段允许被更完整页面补全。
- 两个非空字段不一致时直接失败，不静默覆盖。
- 别名、Genre、导演、参演者和附加番号按稳定键去重合并。
- 输入 canonical 不会被修改。
- Merge 不接触 `data/` 正式 CSV。
