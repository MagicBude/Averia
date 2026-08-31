# MOODYZ Official Provider

Averia V0.4 引入第一个**日文厂商官方 Provider**：MOODYZ；V0.4.1 增加 Node/curl 双传输兼容层；V0.4.2 按真实页面结构修正标题解析并保留失败快照；V0.4.3 将官网“監督”正式映射为 Director / WorkDirector；V0.4.4 修正真实页面封面/头像选择，避免把站点 Logo 当业务图片。

## 为什么先接 MOODYZ

当前 MOODYZ 官方作品页直接提供：

- 日文作品标题
- 女优
- 発売日
- シリーズ
- レーベル
- ジャンル
- 監督
- 品番
- 収録時間

官方女优页还提供：

- 日文姓名
- 罗马字姓名
- 身高
- 三围 / Cup
- 该女优在 MOODYZ 的作品列表

因此，它非常适合验证 Averia 的“日文官方源优先”策略。

## Provider 定位

```text
MOODYZ 官方 HTML
      ↓
raw.html
      ↓
MOODYZ Parser
      ↓
canonical.json
      ↓
Prepare / Report
      ↓
人工审核
      ↓
Apply
```

Provider 永远不直接修改 `data/`。

canonical source 标记为：

```json
{
  "name": "moodyz-official",
  "language": "ja",
  "role": "authoritative"
}
```

这表示：对于 MOODYZ 自己发行的作品，日文标题、女优日文名、品番、発売日、Label / Genre 等字段可以作为高优先级来源；但仍然保留人工审核和多来源冲突机制。

## 作品抓取

```bash
pnpm provider:moodyz -- --code MDVR-434
```

也可以直接指定官方 URL：

```bash
pnpm provider:moodyz -- \
  --url https://moodyz.com/works/detail/MDVR434
```

## 女优页抓取

MOODYZ 女优详情页使用数字 ID，因此命令为：

```bash
pnpm provider:moodyz -- --actress-id 855540
```

或：

```bash
pnpm provider:moodyz -- \
  --url https://moodyz.com/actress/detail/855540
```

女优页发现的作品链接只记录到 `meta.json`，不会递归抓取。

## 离线 Parser 调试

```bash
pnpm provider:moodyz -- \
  --file ./page.html \
  --url https://moodyz.com/works/detail/MDVR434
```

离线模式不会发网络请求。

## 代理

与 JAVDatabase Provider 共用 Averia 网络层：

```text
--proxy
   ↓
HTTP_PROXY / HTTPS_PROXY
   ↓
Windows 系统代理
   ↓
Direct
```

代理地址不会写死在代码中；`meta.json` 也不会保存代理 URL 或凭据。

## 网络传输兼容（V0.4.1）

代理解决“从哪里出网”，Transport 解决“用哪个 HTTP/TLS 客户端发请求”。两者分开处理。

```text
transport=auto（默认）
   ├─ Windows + 已启用代理 → 优先系统 curl
   └─ 其它环境 → Node fetch
                    ↓ ECONNRESET / timeout / TLS 兼容错误
                   curl fallback
```

这是因为部分站点在同一个代理下会接受 Windows `curl` 的 TLS 连接，却在 Node/Undici 完成 TLS 握手前重置连接。该回退只处理正常公开 HTTPS 页面的客户端兼容，不用于绕过访问控制。

通常直接运行即可：

```bash
pnpm provider:moodyz -- --code MDVR-434
```

必要时可以诊断：

```bash
# 强制 curl
pnpm provider:moodyz -- --code MDVR-434 --transport curl

# 强制 Node fetch（用于复现 Node 网络问题）
pnpm provider:moodyz -- --code MDVR-434 --transport node
```

支持的值只有：`auto`、`node`、`curl`。

`meta.json` 会额外记录：

```json
{
  "network_transport": "curl",
  "transport_fallback_from": "node-fetch:ECONNRESET"
}
```

如果是 Windows + 代理环境直接优先 curl，则不会伪造“回退原因”。

## 标题解析兼容（V0.4.2）

2026-08-31 的真实 MOODYZ 作品页与女优页主标题使用 `H2`，页面中还可能存在空 `H1`。因此 Provider 不再假设“主标题一定是 H1”，而是按以下顺序解析：

```text
非空 H1
  ↓
非空 H2
  ↓
og:title
  ↓
<title>
```

同时会排除 `プロフィール`、`WORKS`、`RECOMMEND` 等通用区块标题。`meta.json` 的 `title_source` 会记录本次实际使用了 `h1`、`h2`、`og:title` 或 `title`。

如果页面抓取成功但 Parser 因结构变化失败，V0.4.2 会先保存 `raw.html`，并写入 `parse_status: "failed"` 的 `meta.json`。这样可以直接使用保存的原始页面离线修 Parser，不必再次请求来源站。

## 输出目录

默认：

```text
var/providers/moodyz/<时间>-<记录>/
├─ raw.html
├─ canonical.json
└─ meta.json
```

`raw.html` 用于以后页面结构变化时重新调试 Parser；`canonical.json` 是进入 Averia V0.2 Pipeline 的唯一 Provider 输出。

## 当前边界

V0.4 刻意限制为：

- 单作品页
- 单女优页
- 不递归抓取
- 不并发批量抓取
- 不下载图片
- 不绕过验证码、登录或访问限制

先把日文官方字段映射做稳，再扩展到其它官方厂商站。


## 导演映射（V0.4.3）

MOODYZ 作品页中的 `監督` 不再只写入备注，而是进入 canonical `works[].directors[]`。Prepare 会生成：

```text
directors.csv
work_directors.csv
```

例如 `MDVR-434` 当前官方页面中的 `ジーニアス膝` 会被保存为独立导演实体，并与作品建立关系。


## 图片选择（V0.4.4）

真实 MOODYZ 页面中的 `og:image` 可能是站点 Logo，而不是作品封面或女优头像。因此 Provider 不再无条件信任 `og:image`。

作品图片优先选择页面 `<img>` 中 URL 路径包含 `/content/` 的内容图片；女优页优先选择 `/actress_main/`。`site_design`、`logo_image` 等站点资源会被降权并排除。只有没有更可信的业务图片时才考虑其它候选。

`meta.json` 会分别记录 `cover_source` 或 `profile_image_source`，便于以后定位图片字段来自 `img:src`、`img:data-src`、`og:image` 等哪个页面位置。

Provider 仍然只保存图片 URL，不下载图片文件。
