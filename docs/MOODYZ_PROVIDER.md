# MOODYZ Official Provider

Averia V0.4 引入第一个**日文厂商官方 Provider**：MOODYZ。

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
