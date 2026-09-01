# V0.7.0 升级说明

## 重点

新增 JavInfo API Provider，并将它定位为 Averia 的主采集入口；现有 MOODYZ、DMM Rental、JAVDatabase Provider 保留，用于权威字段校验、缺失补充与故障兜底。

## 新命令

```bash
export JAVINFO_API_KEY='jvi_...'
pnpm provider:javinfo -- --code IPZZ-597 --providers fanza
```

API Key 只从 `JAVINFO_API_KEY` 读取，不支持 `--key`。

## Provenance

JavInfo 返回 `source=fanza` 时写成 `javinfo-fanza`，而不是 `fanza`。这是为了明确“数据通过 JavInfo 中间层获得”。

## 已知边界

JavInfo FANZA/DMM 响应可能混合日文标题与英文人名/分类。V0.7.0 不做自动翻译或跨语言实体猜测；这些字段后续可由厂商官方 Provider 补全/解析。
