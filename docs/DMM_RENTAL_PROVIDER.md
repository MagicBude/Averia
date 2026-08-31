# DMM Rental Provider

V0.6.0 新增 `dmm-rental` Provider，用于**按需读取单个公开 FANZA/DMM 宅配单品 Rental 详情页**，并转换为 Averia canonical JSON。

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

同时坚持：

- 单页按需抓取；
- 不递归扫描全站；
- 不绕过年龄确认、验证码、登录或付费访问控制；
- 原始 HTML 先落盘，Parser 失败仍保留现场；
- Provider 永远不直接写正式 CSV。

如果在线请求只得到年龄确认/访问页，可在浏览器正常打开公开详情页后保存 HTML，再通过 `--file` 做离线解析。
