# DMM Rental Provider

V0.6.0 新增 `dmm-rental` Provider，用于**按需读取单个公开 FANZA/DMM 宅配单品 Rental 详情页**，并转换为 Averia canonical JSON。V0.6.1 根据真实线上返回补充年龄确认会话处理；V0.6.2 继续适配 DMM 年龄声明端点可能返回明文 HTTP 重定向的真实行为；V0.6.3 根据首个真实详情页结果收紧作品字段解析作用域，避免侧栏和推荐链接污染系列、分类等字段。

## 定位

`dmm-rental` 是日文广覆盖**参考源**：

```json
{
  "name": "dmm-rental",
  "language": "ja",
  "role": "reference"
}
```

它不取代厂商官方站。对于作品标题、发行日期、厂牌、系列等字段，若存在厂商官方 `authoritative` 数据，官方源优先。

## 为什么 `貸出開始日` 不写 `release_date`

DMM 宅配 Rental 页展示的是**租赁开始日**，其语义不等同于作品最初发行日。

因此 Provider 会：

- `release_date` 保持空值；
- 把 `貸出開始日` 写入 `source_notes`；
- 同时写入 `meta.json.rental_start_date`；
- 后续由厂商官方源或其它明确提供发行日的来源补 `release_date`。

这可以避免把“租赁上架日期”污染成“作品发行日期”。

## 使用

按 DMM CID：

```bash
pnpm provider:dmm-rental -- --cid 4ipzz698
```

显式指定主番号：

```bash
pnpm provider:dmm-rental -- --cid 4ipzz698 --code IPZZ-698
```

如果在线请求返回 FANZA 年龄确认页，并且你本人确认已满 18 岁，可以显式加入：

```bash
pnpm provider:dmm-rental -- \
  --cid 4ipzz698 \
  --code IPZZ-698 \
  --adult-confirmed
```

`--adult-confirmed` 是用户的明确声明。Averia **不会默认替用户声明年龄**。

指定完整详情页：

```bash
pnpm provider:dmm-rental -- \
  --url "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=4ipzz698/"
```

离线解析真实页面：

```bash
pnpm provider:dmm-rental -- \
  --file ./dmm-4ipzz698.html \
  --url "https://www.dmm.co.jp/rental/ppr/-/detail/=/cid=4ipzz698/" \
  --code IPZZ-698
```

## 当前提取字段

- 日文标题
- DMM CID / 品番
- 保守推导或显式指定的标准番号
- `貸出開始日`（仅来源观察值）
- 収録時間
- 出演者
- 監督
- シリーズ
- メーカー
- レーベル
- ジャンル
- 主封面 URL

## 番号策略

DMM 的品番常见形式例如：

```text
4ipzz698
1sdam00179
```

V0.6 仅在满足保守规则时推导：

```text
4ipzz698    → IPZZ-698
1sdam00179  → SDAM-179
```

如果不能安全推导，Provider 会停止并要求 `--code`，不会猜测。

DMM 原始 CID 同时作为 `dmm-content-id` 写入 `work_codes`。

## 网络和访问边界

Provider 与其它来源共用 Averia 网络层：自动代理、curl/Node fallback、瞬时错误重试。

真实 DMM 请求可能先返回 `年齢認証 - FANZA`。V0.6.1 的处理规则是：

1. 首次检测到年龄确认页时保存失败现场；
2. 未传 `--adult-confirmed` 时停止，并提示用户明确选择；
3. 只有显式传入 `--adult-confirmed` 时，才访问 DMM 页面自身提供的 `declared=yes` URL；
4. 年龄声明请求**不跟随重定向**，只接收响应中的 Cookie；真实 DMM 可能返回 `Location: http://...`，Averia 不会因此放开明文 HTTP；
5. 使用同一个临时 Cookie Jar，主动重新请求最初经过白名单校验的 HTTPS Rental 详情页；
6. Cookie 文件只存在于系统临时目录，流程结束即删除，不进入 Git、日志或 `meta.json`；
7. 如果年龄声明后仍未回到原详情页，立即停止，不继续尝试其它方式。

同时坚持：

- 单页按需抓取；
- 不递归扫描全站；
- 年龄确认必须由用户显式 `--adult-confirmed`；
- 不绕过验证码、登录、地区限制或付费访问控制；
- 原始 HTML 先落盘，Parser 失败仍保留现场；
- Provider 永远不直接写正式 CSV。

如果在线会话仍无法得到详情页，可在浏览器正常打开公开详情页后保存 HTML，再通过 `--file` 做离线解析。

## V0.6.3：作品详情字段作用域

真实 DMM Rental 页面不仅包含作品资料，还包含侧栏、导航、分类入口和推荐女优。页面其它区域同样可能出现「シリーズ」「ジャンル」等文字，因此**禁止把整页扁平化后直接取第一次命中**。

V0.6.3 的规则是：

1. 先寻找以 `貸出開始日` 开始，并按顺序包含 `収録時間 → 出演者 → 監督 → シリーズ → メーカー → レーベル → ジャンル → 品番` 的作品详情字段簇；
2. 出演者、导演、系列、厂商、厂牌、分类只在该字段簇中解析；
3. 链接存在时优先保留与字段类型相符的 DMM `article=` 链接；
4. `一覧へ` 等导航标签不作为实体；
5. 详情区 `品番` 若与请求 URL 的 CID 不一致，立即停止解析；
6. 无法定位详情字段簇时停止解析，不回退到“整页猜字段”。

这条规则来自真实页面回归：旧逻辑曾把侧栏的 `新人NO.1 STYLE` 当成作品系列，并把 `アニメDVD`、其它女优姓名、`AV女優一覧へ` 等混入 Genres。
