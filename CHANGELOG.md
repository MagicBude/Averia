# Changelog

Averia 的逐版本变更记录。每个版本的 **核心变更、新增 Provider、数据模型调整、安全约束** 均在此汇总。

约定：

- 详细设计文档见 `docs/`（如 `docs/strategy/SOURCE_STRATEGY.md`、`docs/design/V0.8-MULTI-SOURCE-RESOLUTION.md`）。
- **CSV 始终是唯一事实源**；任何 Provider 都不得直接修改 `data/`。
- 所有导入必须走 `import:prepare → import:report → import:apply`，apply 自带校验、备份与失败回滚。

---

## V0.8.0（进行中）— 多来源字段级溯源与实体归并

目标：同一个作品在多个来源、不同语言、不同名称下，收敛为一个规范 Averia 实体。

新增三个正式数据集（schema + 空 CSV，均进入 CSV 事实源，不进入 XLSX）：

- `observations`（`data/sources/observations.csv`）：字段级原始观察日志（append-only），细化 `source_records`。
- `field_resolutions`（`data/sources/field_resolutions.csv`）：字段级裁决层，`resolved_value` / `resolution_method` / `winning_source_name` / `status`；两可靠源同非空字段冲突时置 `pending_review`，**阻断 Apply** 直到人工裁决。
- `entity_aliases`（`data/relations/entity_aliases.csv`）：跨源 / 跨语言别名与外部身份，matcher 当作精确匹配键，是防止跨源重复实体的核心修复。

核心规则：

- 跨语言 / 跨源实体等同**只能**经显式 `entity_aliases` 或人工 `resolution` 建立；字符串相似度不自动合并。
- 冲突不得静默 last-write-wins，必须进入 `field_resolutions(pending_review)` → 人工 / 规则决议。
- 每阶段 `pnpm check` 必须全绿，既有正式数据无损。

当前已落地（Phase 1）：三表 schema 与空 CSV；`scripts/import/lib.mjs` 的 `nextIdFactory` 已识别 `obs_ / res_ / ea_` 前缀；XLSX 通过 `NON_XLSX_DATASETS` 排除三新表，保持固定 15 关系 Sheet。DMM IPZZ-698 批次已回滚为仅 Stage（正式 `data/` 回到 23 行 MOODYZ 基线，Stage 留 `var/imports`）。

已落地（Phase 2）：`import:prepare` 对每个来源贡献的字段产出 `observations` 记录（append-only 溯源日志），含跨语言标注（`name_en` / 英文 taxonomy 记 `en`，日文名 / 标题记 `ja`，数值与日期留空）。导入报告新增「数据观察」小节。匹配既有实体的来源观察同样写入，不静默丢弃。

新增源（V0.8 预置能力）：**JavLibrary Provider**（`pnpm provider:javlibrary -- --code <番号> | --url <详情页> | --file <本地HTML>`）。解析逻辑移植自 OpenAver 的 `core/scrapers/javlibrary.py`，但**不含其 Cloudflare / 年龄门绕过**（`cf_transport`）；Averia 以合规 `fetch` 抓取，被验证页拦截即 fail closed。输出 Averia 统一导入 canonical（`role=supplemental language=ja`，日文名称记 `name_ja`）。配套：`scripts/providers/javlibrary/lib.mjs`、`scripts/provider-javlibrary.mjs`、`tests/provider-javlibrary.test.mjs`、`tests/fixtures/javlibrary/work-ipzz-597.html`、`docs/providers/JAVLIBRARY_PROVIDER.md`。

已落地（Phase 3）：`entity_aliases` 精确别名匹配 —— 防跨源重复实体的核心修复。

- `scripts/import/lib.mjs` 新增 `buildAliasIndex()`：按 `(实体类型, 规范化别名)` 建索引，与既有精确匹配并列；为兼容女优（去空格）与 taxonomy（折叠空格）的既有约定，同一别名按两种空白规范化登记。
- `resolveSimpleEntity`（maker / label / series / genre / director）与女优匹配分支均并入别名精确命中，命中集合取并集；结果不唯一时仍按硬规则阻断为 `ambiguous-*`，绝不模糊合并。
- 新增 `pnpm resolve:link -- --alias <名称> --entity <实体ID> --type <别名类型>`：显式登记跨源 / 跨语言别名（拒绝新建、改挂别名）。三道守卫：别名已指向其它实体则阻断（会造成 matcher 歧义）、别名与另一同类型实体正式名相同则阻断（等同合并实体，属人工决策）、重复登记幂等跳过。写入前备份 `data/`，写入后跑全量校验，失败自动回滚；支持 `--dry-run`。
- 修复：新建 genre 时 `slug` 为必填但来源未给则留空，导致 `import:apply` 校验失败。现按「来源 slug → 名称转写 → 实体 ID 片段」兜底，保证非空且稳定。
- 验证：IPZZ-597（javinfo 英文源）入库后，日文源导入同一厂商 / 厂牌 / 分类 —— 登记别名前新建 3 个重复实体，登记后精确命中既有 ID、零新增。

已落地（Phase 4）：字段级裁决与冲突阻断 —— 多来源安全入库的最后一道闸。

- `prepareImport` 对既有实体的每个贡献字段做裁决：既有为空 + 单一来源补全 → `field_resolutions(auto_fill)` 并写入 `entity_updates`（可安全 Apply）；两者皆非空且不同 → `field_resolutions(pending_review)`（阻断该字段，不静默覆盖）；同值 → 仅记 `observations`。
- `import:apply` 遇任意 `pending_review` **整体阻断**（exit 5），对应 AGENTS「冲突不可静默解决」；否则将 `entity_updates` 合并进既有实体记录并重写受影响数据集 CSV。
- 新增 `pnpm resolution:report`（列出待裁决冲突与双方值）、`pnpm resolution:decide -- --entity-type <类型> --entity-id <ID> --field <字段> --decision adopt|keep`（翻转 `pending_review` 为 `manual`，adopt 时追加 `entity_update`；改前备份 `stage.json`）。
- 导入报告新增「字段裁决」小节（auto_fill / pending_review 分列）。
- `scripts/import/lib.mjs` 导出纯函数 `pendingReviewCount(stage)` 与 `applyResolutionDecision(stage, opts)`，供 CLI 与测试复用。
- 范围说明：本阶段覆盖 actress / work 标量字段冲突；taxonomy 实体（maker/label 等）的英文名补全为同源机制的自然延伸，留待后续批次接入时补 `resolveSimpleEntity` 的 `entity_updates` 回写。

已落地（作品富字段 / ADR-0002）：metatube adapter 此前静默丢弃的 `MovieInfo` 高价值字段现已落库，详见 `docs/adr/0002-enrich-works-rich-fields.md`。

- `works.schema.json` 新增 `thumb_url` / `backdrop_url` / `score` 三列（插在 `cover_url` 之后）；`description` 列早已存在，本次由 adapter 从 `summary` 喂入。
- metatube adapter 映射：`summary`→`description`、`thumb_url`→`thumb_url`、`backdrop_url`→`backdrop_url`、`score`→`score`（浮点存文本列）。
- `WORK_OBSERVABLE_FIELDS` 纳入三新字段，使 Phase 4 字段级观察 / 裁决覆盖评分等；多源评分冲突自然进入 `pending_review`，由人工裁决。
- 女优 image 图集（`images[1..]`）本期不建模，保持单 `profile_image_url`；媒体 / 图集规范化建模留待 V0.9 / V1.0 的媒体表 ADR。
- 正式 `data/works/works.csv` 已做列迁移（表头与 schema 一致），既有 2 行数据无损；`pnpm check` 全绿。

详细设计：**`docs/design/V0.8-MULTI-SOURCE-RESOLUTION.md`**。

---

## V0.7.0 — JavInfo API 主采集入口

- 新增 JavInfo API Provider：`pnpm provider:javinfo -- --code <番号> [--providers fanza]`。
- API Key 仅从 `JAVINFO_API_KEY` 环境变量读取，不支持 `--key`，不写入日志 / `meta.json` / `raw.json` / Git / URL。
- 定位为**主采集入口**；MOODYZ、DMM Rental、JAVDatabase 保留，用于权威字段校验、缺失补充与故障兜底。
- Provenance：上游 `source=fanza` 在 Averia 写作 `javinfo-fanza`，明确“数据经 JavInfo 中间层获得”，不冒充 FANZA 官方直连。
- 已知边界：JavInfo FANZA/DMM 响应可能混合日文标题与英文人名 / 分类；V0.7.0 不做自动翻译或跨语言实体猜测，留待 V0.8 归并层处理。
- 新增：`scripts/providers/javinfo/lib.mjs`、`scripts/provider-javinfo.mjs`、`tests/provider-javinfo.test.mjs`、`tests/fixtures/javinfo/ipzz-597.json`、`docs/providers/JAVINFO_PROVIDER.md`。

---

## V0.6.0 — DMM Rental Provider 与 XLSX 人类阅读总览

- 新增 DMM/FANZA 宅配 Rental 单页 Provider（`pnpm provider:dmm-rental -- --cid <cid>`），来源固定 `language=ja role=reference`；厂商官方 Provider 优先级更高。
- **`貸出開始日` 不等同于发行日**，绝不写入 `release_date`，只进 `source_notes` / `meta`。
- XLSX 新增 `女优总览`、`作品总览` 两个人类阅读视图，并把规范 Sheet 顺序固定为 15 个关系 Sheet（见 `exports/xlsx/README.md`）。
- 修复 Series 首次创建时 `${kind}s` 误拼成 `seriess`：改为显式数据集名称映射（DMM `引退作` Fixture 覆盖）。

---

## V0.6.1 — DMM 年龄确认处理

- 直接请求公开 Rental 详情页时，DMM 可能先返回「年齢認証 - FANZA」页。Averia **不会替用户默认声明年龄**。
- 仅当用户显式传入 `--adult-confirmed` 才走 DMM `declared=yes` 流程；临时 `curl` Cookie Jar 存于系统临时目录，流程结束立即删除。
- Cookie 内容 / 端口 / 凭据不写入 `meta.json`、CSV、日志或 Git；若声明后仍非原详情页则停止，不绕过验证码 / 登录 / 地区限制 / 付费访问控制。

---

## V0.6.2 — 年龄确认明文 HTTP 安全兼容

- 真实 `declared=yes` 可能返回 `Location: http://...`；Averia **不跟随明文 HTTP**，而是关闭重定向只接收 `Set-Cookie`，再用同一临时 Cookie Jar 主动重新请求原始 HTTPS 详情页。
- `fetchTextViaCurl()` / Node transport 新增 `followRedirects:false`；初始请求仍由 `--proto=https` 约束。

---

## V0.6.3 — DMM 字段作用域修复

- 真实页面含大量侧栏 / 导航 / 推荐链接，旧整页扁平解析会把更早出现的「シリーズ / ジャンル」误认为作品字段（如系列误为 `新人NO.1 STYLE`、Genres 混入 `アニメDVD`、其它女优名、`AV女優一覧へ`）。
- 改为锁定从「貸出開始日」到「品番」的**有序作品详情字段簇**，仅在局部区域解析实体与 taxonomy；无法定位则直接失败，避免污染 canonical。
- 增加字段类型链接优先过滤、`一覧へ` 等导航标签过滤、详情区品番与请求 CID 一致性检查、真实噪声回归 Fixture。

---

## V0.5.0 — Canonical Merge

- 新增 `canonical:merge`：合并同一 `source.name` 的多个单页 Provider 产物为一个可审核导入文件，再一次性 `import:prepare`。
- 同一 `source_record_id` 才是跨页面实体合并的稳定键；空字段可由更完整页面补全，两非空值冲突直接失败，不静默覆盖。
- 别名 / Genre / 导演 / 参演者 / 附加番号按稳定键去重合并；不修改输入文件，不接触 `data/`。

---

## V0.5.1 — 毫秒时间戳兼容与测试隔离

- 首次真实 `import:apply` 暴露：`fetched_at` 形如 `2026-08-31T14:36:25.486Z`（毫秒级）旧校验器只接受秒级，导致校验失败并触发自动回滚。
- 校验 now 接受两种 UTC ISO 8601 精度：`...Z` 与 `...SSSZ`；仍拒绝非 UTC `Z`、非法日期、超 3 位小数秒、非 ISO 分隔格式。
- 修复真实数据写入后少数测试假定空数据导致 `pnpm test` 误失败：需空前提的单测改显式空 Catalog Fixture，读取正式 CSV 的完整性测试保留。

---

## V0.4.0 — 首个日文厂商官方 Provider：MOODYZ

- 新增 MOODYZ 官方作品页 / 女优页 Parser；canonical `source` 标记 `language:ja`、`role:authoritative`。
- 作品日文标题同时写入 `title` 与 `title_ja`，避免英文聚合源成为默认主标题。
- 解析官方品番、発売日、时长、Label、Series、Genre 与女优关系；女优页解析日文名、罗马字名、身高、三围、Cup。
- 复用 V0.3.2 自动代理网络层；保留单页抓取限制，不自动递归。
- DMM/FANZA API 路线保留，但因注册需要日本国内收款账户而延期，不使用不合规方式绕过。

---

## V0.4.1 — 网络传输兼容层

- 新增 `scripts/lib/http-transport.mjs`，支持 `auto / node / curl` 三种网络传输。
- Windows + 已启用代理时 `auto` 优先系统 `curl`；其它环境默认 Node `fetch()`，遇 `ECONNRESET`、连接超时、Undici socket 或 TLS 类错误自动回退 `curl`。
- `curl` 显式使用动态解析出的代理地址，不写死任何端口；`meta.json` 记 `network_transport` / `transport_fallback_from`。
- 仅改变公开 HTTPS 页面所用客户端，不绕过登录 / 验证码 / 付费墙 / 访问控制。

---

## V0.4.2 — 标题解析修复

- 真实 MOODYZ 页面主标题为 `H2`（可能空 `H1`），旧 Fixture 用 `H1` 导致测试通过但真实失败。
- 解析改为 `非空 H1 → 非空 H2 → og:title → <title>`，跳过空标题与通用区块标题；`meta.json` 记 `title_source`。
- Fixture 改为与真实页面一致的「空 H1 + H2 主标题」；抓取先存 `raw.html`，Parser 失败仍保留现场与失败 `meta.json`。

---

## V0.4.3 — 导演进入正式数据模型

- 真实 `MDVR-434` 页面提供 `監督：ジーニアス膝`；新增 `directors.csv` 与 `work_directors.csv` 及两 schema，不再把导演仅存备注。
- 在首次真实数据 Apply 前补齐模型，避免后续迁移历史正式数据。

---

## V0.4.4 — MOODYZ 业务图片识别

- 真实 canonical 审核发现 `og:image` 可能指向站点 Logo，污染 `cover_url` / `profile_image_url`。
- 改为优先识别作品 `/content/` 图片、女优 `/actress_main/` 图片，排除 `site_design` / `logo_image`；`meta.json` 记 `cover_source` / `profile_image_source`。Provider 仍只保存 URL，不下载图片。

---

## V0.4.5 — 临时 HTTP 网关错误自动重试

- 网络层将 `408 / 429 / 500 / 502 / 503 / 504` 视为可能的瞬时上游 / 限流错误，默认最多 3 次、指数退避 `750ms → 1500ms` 后重试；`404` 等永久错误不重试。
- `meta.json` 新增 `network_attempts`，不写死代理端口、不改变 Parser / Apply / 正式 CSV。

---

## V0.4.6 — CLI 参数映射修复

- 修复 `provider:moodyz --actress-id` 无法传到 MOODYZ URL 构造器（`parseArgs` 保留参数名连字符导致 `args["actress-id"]` 与 `actressId` 不匹配）；CLI 边界显式完成映射。
- 新增 CLI 级测试：女优 fixture → 女优 `canonical.json`，最终 URL 为 `https://moodyz.com/actress/detail/<id>`。

---

## V0.4.7 — 网络稳定性

- 将“取得 HTTP 状态码之前”的瞬时网络错误也纳入统一重试：`curl` exit `5/6/7/18/28/35/52/55/56/92`、`ECONNRESET` / `ECONNREFUSED` / `ETIMEDOUT` / `EPIPE`、`EAI_AGAIN` / `ENETUNREACH` / `EHOSTUNREACH`、Undici 连接 / 头 / body 超时与 socket 错误、TLS/SSL 握手类错误。
- 默认最多 3 次、等待约 `750ms` / `1500ms` 后重试，CLI 打印重试原因。
- 保持：不直接写正式 CSV、代理端口不写死、`meta.json` 不存代理地址或凭据、离线 `--file` 模式完全不发网络请求。

---

## V0.3.0 — 首个真实数据源：JAVDatabase Provider

- 新增 JAVDatabase 单页 Provider：作品页按番号构造 URL，女优页按 slug 构造 URL。
- 自动保存 `raw.html` / `canonical.json` / `meta.json`；作品页映射 Maker / Series / Genres / Cast，Content ID 作为附加作品番号进入 Stage；女优页基本资料与别名解析。
- 增加离线 HTML Parser 模式、Provider Fixture 与自动测试；Provider 绝不直接写正式 CSV。
- 定位 `language=en`、`role=supplemental`，用于补充与交叉验证，不是日文权威源。

---

## V0.3.2 — 网络层与来源策略

- 自动发现 Windows 系统代理，四级网络策略：`--proxy` > `HTTP_PROXY` / `HTTPS_PROXY` > Windows 系统代理 > 直连；必要时自动重启一次 Node 子进程让其从启动阶段启用环境代理。
- `meta.json` 仅记录 `network_mode` 与 `proxy_used`，不保存代理 URL / 端口 / 账号 / 密码。
- 新增 `docs/strategy/SOURCE_STRATEGY.md`，将 FANZA / DMM Web API 定为下一阶段的日文结构化主源。
- 推荐 Node 24；Node 22 至少需 22.21 以启用内置代理能力。

---

## V0.2.0 — 数据质量与安全导入 Pipeline

- 定义 V0.2 统一导入 JSON 格式（`imports/` 示例）。
- 精确实体匹配：以 `source_record_id`、规范名、别名、标准化番号作为稳定键；已有实体非空字段只生成 review-only proposal，不自动覆盖；多候选即阻断。
- Stage 审核链路：`import:prepare → import:report → import:apply`。
- `import:apply` 自带校验、自动备份、正式 CSV 指纹保护、全量校验失败时恢复。
- 新增数据质量报告（`pnpm data:quality`）。
- 原则：示例为虚构数据，**不要 Apply 示例批次**，避免污染正式 CSV。
