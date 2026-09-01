# JavInfo API Provider

V0.7.0 起，Averia 将 JavInfo API 作为主采集入口之一，目标是减少站点 HTML/WAF/年龄确认等维护成本，同时保留来源可追溯性。

## 定位

- JavInfo 是聚合/标准化中间层，不等同于 Averia 直接访问 FANZA/DMM。
- 响应 `source=fanza` 时，Averia 记录来源名为 `javinfo-fanza`；`source=dmm` 时为 `javinfo-dmm`。
- FANZA/DMM 经 JavInfo 返回的标题可能有日文，但演员、Maker、Label、Genre 常已标准化为英文，因此角色为 `reference`，不覆盖厂商官方 `authoritative` 日文字段。
- `raw.json` 永久保留 API 完整响应；当前 Schema 尚未建模的 gallery/sample 等字段不会丢失。

## API Key

只使用环境变量 `JAVINFO_API_KEY`。不要把 key 放在命令行参数、`.env` 提交到 Git、日志、截图或聊天中。

Git Bash：

```bash
export JAVINFO_API_KEY='jvi_...'
```

PowerShell：

```powershell
$env:JAVINFO_API_KEY='jvi_...'
```

## 单作品

```bash
pnpm provider:javinfo -- --code IPZZ-597 --providers fanza
```

Provider 只生成：

- `raw.json`
- `canonical.json`
- `meta.json`

不会写正式 CSV。之后仍然执行 Prepare → Report → Apply。

## 字段映射

| JavInfo | Averia |
| --- | --- |
| `dvdId` | 主番号 |
| `contentId` | 附加 Content ID |
| `titleJa` | `title` / `title_ja` |
| `releaseDate` | `release_date` |
| `runtimeMins` | `duration_min` |
| `makers[0]` | maker（按响应原文） |
| `label` | label（按响应原文） |
| `series` | series（按响应原文） |
| `categories[]` | genres（按响应原文） |
| `actresses[]` | actress/cast（按响应原文） |
| `extra.actressesRich[].image` | 女优头像 |
| `jacketFullUrl` | 封面 |
| `extra.galleryFull` / `sampleUrl` | 暂保留在 raw/meta，等待媒体表 |

## 批量策略

不要用 `/movie` 枚举未知目录。推荐：

1. `/query` 每页发现番号（最大页大小以 JavInfo 当前文档为准）；
2. 对每个确定番号调用 `/movie` 获取完整记录；
3. 本地去重和缓存，已有成功 raw 不重复计费；
4. 最终仍通过 Averia Prepare / Report 审核。
