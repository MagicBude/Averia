# JavLibrary Provider — V0.8

V0.8 新增的英文可达元数据补充源 **JavLibrary**。Provider 职责与 JAVDatabase 一致：

```text
JavLibrary 详情页（按番号搜索 → 详情）
   ↓
合规抓取 HTML（主机白名单 + HTTPS-only）
   ↓
保存 raw.html 原始快照 + SHA-256
   ↓
Parser 标准化（复用 OpenAver 的 HTML 字段解析思路）
   ↓
Averia 统一导入 JSON
   ↓
V0.2 Prepare / Report / Apply
```

**Provider 永远不直接修改 `data/` 正式 CSV。**

## 当前支持范围

V0.8 只支持单页、按需抓取：

- 按番号搜索：`pnpm provider:javlibrary -- --code IPZZ-597`（搜索页 → 详情页两步）
- 直接详情页 URL：`pnpm provider:javlibrary -- --url https://www.javlibrary.com/ja/?v=javmezzbqu`

暂时不做：

- 全站遍历、自动翻页、并发批量请求；
- 图片 / 样本图下载（Averia 只记录封面 / 样本图 URL，不下载媒体）；
- **绕过 Cloudflare、年龄门或验证码**——JavLibrary 返回验证页时 Provider 直接 fail closed（报错、不生成假数据）。

## 合规边界（重要）

本 Provider **有意不实现**任何反爬 / 验证码 / 年龄门绕过：

- 网络传输层使用与 JAVDatabase 相同的合规 `fetch`（主机白名单 + 原始快照 + 限速 + 失败重试），被 Cloudflare 拦截即停止并报错；
- 解析逻辑移植自 OpenAver 的 `core/scrapers/javlibrary.py`（HTML → 字段 selector），但去掉了其依赖 Windows WebView 手动过 Cloudflare 的 `cf_transport` 部分；
- 这符合 AGENTS.md「禁止提交用于绕过登录 / 访问控制 / 付费墙 / 验证码 / 反爬机制的工具」「数据导入器应尊重适用的网站规则、访问策略和合理速率限制」。

## 抓取一部作品

按番号（搜索 → 详情）：

```bash
pnpm provider:javlibrary -- --code IPZZ-597
```

或直接给详情页 URL：

```bash
pnpm provider:javlibrary -- --url "https://www.javlibrary.com/ja/?v=javmezzbqu"
```

离线调试 Parser（不发起网络请求，适合用已保存的 HTML 跑回归）：

```bash
pnpm provider:javlibrary -- --file tests/fixtures/javlibrary/work-ipzz-597.html --url "https://www.javlibrary.com/ja/?v=javmezzbqu"
```

## 产物

每次运行在 `var/providers/javlibrary/<时间戳>-<番号>/` 下生成三个文件：

- `raw.html`：原始 HTML 快照（可复现 Parser 问题）；
- `canonical.json`：Averia 统一导入 JSON；
- `meta.json`：Provider 版本、来源 URL、最终 URL、抓取时间、`raw_sha256`、网络模式（**不保存代理 URL / 凭据**）。

## 进入 Pipeline

```bash
pnpm import:prepare -- --file "var/providers/javlibrary/<...>/canonical.json" --batch "javlibrary-IPZZ-597-<日期>"
pnpm import:report -- --batch "javlibrary-IPZZ-597-<日期>"
# 人工审核 observations / field_resolutions 后
pnpm import:apply -- --batch "javlibrary-IPZZ-597-<日期>"
```

> 跨源安全归并（不把 Idea Pocket / Dish / Slender / Kana Momonogi 建重）依赖 V0.8 Phase 3 的 `entity_aliases` + matcher 精确别名匹配；在此之前新源产物只能 Stage，Apply 前需人工确认不重复。
