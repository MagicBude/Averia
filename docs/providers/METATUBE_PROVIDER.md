# MetaTube Provider（V0.8）

Averia 接入 [metatube-community/metatube-sdk-go](https://github.com/metatube-community/metatube-sdk-go) 的薄适配 Provider。**不自研 34 个站点的 selector**，而是直连本地起好的 `metatube-server` REST API，把返回的 JSON 转成 Averia 统一导入 canonical。

> 为什么走这条路：站点改版的维护成本整个转移给上游社区；Averia 只负责规范/归并/质量/导出这一层稳定价值。

## 前置：本地起 metatube-server

任选一种（**不需要 Docker**，Windows 直接下二进制即可）：

```bash
# 方式 A：Docker（推荐，一行）
docker run -d -p 8080:8080 ghcr.io/metatube-community/metatube-server:latest

# 方式 B：Windows 二进制（解压双击）
# 下载 https://github.com/metatube-community/metatube-server-releases 的
#   metatube-server-windows-amd64.zip，解压后双击 exe
# 建议持久化缓存（否则重启丢）：metatube-server.exe -dsn metatube.db

# 方式 C：自编译
git clone https://github.com/metatube-community/metatube-sdk-go
cd metatube-sdk-go && make server && ./build/metatube-server
```

默认端口 `8080`。若 server 设了 `TOKEN` 环境变量，调用时须带 `--token`。

## 用法

```bash
# 电影（fanza 是默认 provider）
pnpm provider:metatube -- --provider fanza --code IPZZ-597

# 指定 server 地址与鉴权（远程部署时）
pnpm provider:metatube -- --provider fanza --code IPZZ-597 --base http://192.168.1.10:8080 --token SECRET

# 中文源（madouqu）
pnpm provider:metatube -- --provider madouqu --code ...

# 女优
pnpm provider:metatube -- --provider fanza --id ipzz-00597 --type actor

# 离线调试 Parser（读本地 JSON，不联网）
pnpm provider:metatube -- --file ./sample.json --provider fanza --id ipzz-597
```

参数：

| 参数 | 说明 |
| --- | --- |
| `--provider` | 数据源名（fanza/javbus/madouqu/jav321/mgstage/sod/duga…），默认 `fanza` |
| `--code` | 番号（用于拼 id；也可 `--id` 给原始 id） |
| `--id` | 该源稳定记录 id（优先于 `--code`） |
| `--type` | `movie`（默认）或 `actor` |
| `--base` | server 地址，默认 `http://localhost:8080` |
| `--token` | server 设了 TOKEN 时必填 |
| `--proxy` | 仅当 `--base` 非本地时生效（localhost 不走代理） |
| `--file` | 离线模式，读本地 JSON |
| `--out` / `--timeout` / `--help` | 输出目录 / 超时 / 帮助 |

## 数据流

```
metatube-server (34 源)  ──REST JSON──▶  provider-metatube.mjs
   raw.json + SHA-256                              │  parse → Averia canonical
                                                  ▼
                            import:prepare → import:report → import:apply → data/ CSV
```

产物在 `var/providers/metatube/<时间戳>-<记录>/`：`raw.json`（原始，含 SHA-256）、`canonical.json`、`meta.json`。**Provider 不写正式 CSV。**

## 字段映射

| MetaTube MovieInfo | Averia canonical work |
| --- | --- |
| `number` | `code` |
| `title` | `title`（日文源同时写 `title_ja`） |
| `release_date` | `release_date` |
| `runtime` | `duration_min` |
| `maker` / `label` / `series` | 同名对象（日文源写 `name_ja`） |
| `genres[]` | `genres[]`（带 source 前缀 slug） |
| `director` | `directors[]` |
| `actors[]` | `cast[]`（并展开为 `actresses[]`） |
| `cover_url` | `cover_url` |
| `summary` | `description`（剧情简介） |
| `thumb_url` | `thumb_url` |
| `backdrop_url` | `backdrop_url` |
| `score` | `score`（评分，浮点存文本列） |
| `provider` | `source.name = metatube-<provider>`，`language`/`role` 按源定 |

| MetaTube ActorInfo | Averia canonical actress |
| --- | --- |
| `name` | `primary_name`（日文源 `name_ja`） |
| `aliases[]` | `aliases[]` |
| `birthday` | `birth_date` |
| `height` | `height_cm` |
| `cup_size` | `cup` |
| `measurements`（B85/W58/H83） | `bust_cm` / `waist_cm` / `hip_cm` |
| `blood_type` | `blood_type` |
| `images[0]` | `profile_image_url` |

## 合规边界

- 只调本地/自建 server，不碰第三方站点、不绕过反爬/验证码。
- 原始 JSON 落盘 + SHA-256，可审查可复现。
- 中文源（madouqu）当前 schema 无 `name_zh`/`title_zh`，中文名先落 `primary_name`，待中文层 schema 落地后回填。

## 多源归并

metatube 一个 `provider` 是一家源。要跨源（如 fanza + javbus + madouqu 同一作品），分别跑多次 `provider:metatube` 得到多个 batch，各自 `import:prepare`，由 **V0.8 Phase 3 的 `entity_aliases` 精确别名匹配** 消重（用 `pnpm resolve:link` 登记跨语言别名）。
