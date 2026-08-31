# JAVDatabase Provider — V0.3

V0.3 的第一个真实数据源 Provider 对接 **JAVDatabase**。Provider 的职责只有：

```text
JAVDatabase 单页
   ↓
抓取 HTML
   ↓
保存 raw.html 原始快照
   ↓
Parser 标准化
   ↓
Averia 统一导入 JSON
   ↓
V0.2 Prepare / Report / Apply
```

**Provider 永远不直接修改 `data/` 正式 CSV。**

## 当前支持范围

V0.3 刻意只支持单页：

- 作品页：`https://www.javdatabase.com/movies/<slug>/`
- 女优页：`https://www.javdatabase.com/idols/<slug>/`

暂时不做：

- 全站遍历；
- 自动翻页；
- 图片下载；
- 并发批量请求；
- 绕过地区限制、验证码、访问控制或反爬机制。

这样可以先验证数据模型和 Parser，再逐步增加批量采集能力。

## 抓取一部作品

可以直接按番号：

```bash
pnpm provider:javdatabase -- --code SDAM-179
```

也可以提供完整 URL：

```bash
pnpm provider:javdatabase -- --url https://www.javdatabase.com/movies/sdam-179/
```

成功后会在本地生成：

```text
var/providers/javdatabase/<时间>-<记录>/
├─ raw.html
├─ canonical.json
└─ meta.json
```

其中：

- `raw.html`：获取时的原始网页快照，用于以后复现 Parser 问题；
- `canonical.json`：可以直接交给 Averia V0.2 Pipeline；
- `meta.json`：Provider 版本、来源 URL、原始 HTML SHA-256 等调试信息。

CLI 会自动打印下一步的 `import:prepare` 和 `import:report` 命令。

## 抓取一个女优资料页

女优页使用 URL slug：

```bash
pnpm provider:javdatabase -- --idol sachi-yamada
```

或者：

```bash
pnpm provider:javdatabase -- --url https://www.javdatabase.com/idols/sachi-yamada/
```

Parser 当前映射：

- 英文/罗马字姓名；
- 日文名；
- 完整出生日期（只有 YYYY-MM-DD 完整日期才写入）；
- 出道日期；
- 身高；
- 三围；
- 罩杯；
- 血型；
- 出生地；
- 头像 URL；
- 页面中的已知别名；
- 页面上发现的作品 URL（写到 `meta.json`，不递归自动抓取）。

例如 `2002-??-??` 这种不完整日期不会伪造成 `2002-01-01`，而是保持为空，避免制造错误精度。

## 作品页映射

作品页当前映射：

- DVD ID → `works.code` / 主番号；
- Content ID → `work_codes` 附加番号，类型 `content-id`；
- Title → 标题；
- Release Date → 发行日期；
- Runtime → 时长；
- Studio → Maker；
- JAV Series → Series；
- Genre(s) → Genres；
- Idol(s)/Actress(es) → Cast；
- Open Graph 图片 → `cover_url`。

作品页中的参演女优会先生成**最小女优实体**（来源 ID + 姓名）。之后单独抓该女优资料页时，V0.2 会优先通过同一来源的 `source_record_id` 精确匹配，不会重复创建女优。

## 离线调试 Parser

如果页面结构变化，可以先保存 HTML，再离线解析：

```bash
pnpm provider:javdatabase -- \
  --file ./page.html \
  --url https://www.javdatabase.com/movies/sdam-179/
```

`--file` 模式不会访问网络。

项目测试中的：

```text
tests/fixtures/javdatabase/
```

保存的是精简、非完整网页 Fixture，用于稳定验证 Parser 规则。

## 网络与来源规则

Provider 遵守以下边界：

1. 只允许 HTTPS；
2. 只允许 `javdatabase.com` / `www.javdatabase.com`；
3. 当前每次命令只请求一个页面；
4. 不跟随到非 JAVDatabase 主机；
5. 不下载视频或图片媒体；
6. 不提供规避验证码、地区限制或访问控制的功能；
7. 如果来源站规则发生变化，应先更新 Provider，再进行批量工作。

JAVDatabase 在 2026 年的站点说明中表示其作品数据源和站点策略仍在持续调整，因此 Averia 必须保留 `raw.html` 快照，并把 Parser 当作可版本化组件，而不是假设网页结构永远不变。

## 推荐的第一次真实验证

先只抓一个作品：

```bash
pnpm provider:javdatabase -- --code SDAM-179
```

然后执行 CLI 输出的：

```bash
pnpm import:prepare -- --file <canonical.json> --batch <batch>
pnpm import:report -- --batch <batch>
```

先检查 `report.md`，**不要急着 Apply**。确认作品、女优、厂商、分类和附加 Content ID 都正确后，再执行 Apply。
