# ADR-0002: 作品 schema 富字段补强 —— 落库 MetaTube 的 summary / thumb_url / backdrop_url / score

- **Status**: Accepted
- **Date**: 2026-09-04
- **Deciders**: MagicBude（Averia 所有者）

## Context

V0.8 引入 metatube adapter（直连本地 `metatube-server` REST API，覆盖 34 个上游源）后，发现 adapter 把 `MovieInfo` 里一批**高价值字段静默丢弃**了：

- `summary`（剧情简介）→ 没喂进 `works.description`（该列 schema 早已存在，但 adapter 从未写入）；
- `thumb_url`（缩略图）、`backdrop_url`（背景图）→ 完全没建模；
- `score`（评分，如 `4.2`）→ 完全没建模。

只保留了 `cover_url` 一张封面图。这些字段对下游检索、展示与未来的 Web / 搜索体验价值很高，长期丢弃等于让 34 个源的贡献凭空白白流失。

作用力：

- Averia 的 canonical 命名是全局合同，已被导出、API（V1.0）、XLSX 复用；**不能**为迁就 MetaTube 改写全局字段名。
- 女优侧只取 `images[0]` 当 `profile_image_url`，图集（`images[1..]`）同样是被丢弃的富字段，但它是数组，扁平 CSV 表达不经济。
- Phase 4 已建立字段级观察 / 裁决（`observations` / `field_resolutions`），新增字段应自然纳入这套守卫，而非绕过。

## Decision

1. **`works.schema.json` 新增三列**：`thumb_url`、`backdrop_url`、`score`，插在 `cover_url` 之后、`created_at` 之前。`description` 列已存在，本次仅由 adapter 从 `summary` 喂入（非 schema 变更）。`score` 以**文本列**存储（保留小数精度；CSV-first 下数值类型由 V0.9 SQLite 派生层决定，不在事实源层强约束）。
2. **metatube adapter 映射**（薄映射，不改命名合同）：
   - `summary` → `description`
   - `thumb_url` → `thumb_url`
   - `backdrop_url` → `backdrop_url`
   - `score` → `score`（数值或空串）
   - （`homepage` 已在来源记录层落到 `source_records.source_url`，不重复进 work 主表）
3. **`WORK_OBSERVABLE_FIELDS` 纳入新增字段**，使 Phase 4 的字段级观察 / 裁决覆盖 `thumb_url` / `backdrop_url` / `score`；多源评分不一致会自然进入 `pending_review`，由人工裁决，不静默 last-write-wins。
4. **女优 image 图集（`images[1..]`）本期不建模**，保持单 `profile_image_url`；媒体 / 图集的规范化建模留待后续 ADR（建议 V0.9 媒体表或 V1.0 Web），不在本决策范围。
5. 其它 Provider（javinfo / javdatabase / javlibrary / moodyz / dmm-rental）可**按需**回填这些新列，无需强制。

## Consequences

**正面**：

- 不再浪费 34 个上游源携带的简介 / 缩略图 / 背景图 / 评分，下游 Web、搜索、XLSX 可直接消费。
- 新增字段自动进入 Phase 4 冲突守卫（评分跨源不一致会被拦下人工裁决），延续"冲突不静默解决"的硬线。
- 不改 canonical 命名合同，其它 Provider 与 V1.0 API / V1.1 Web 协议零破坏。

**负面 / 风险**：

- `cover_url` / `thumb_url` / `backdrop_url` 三张图并存略冗余，但都是绝对 URL、可控、可 diff，可接受。
- `score` 跨源语义可能不同（不同站各自评分体系），`pending_review` 会要求人工判断以哪个为准；这是预期行为而非缺陷。
- 女优图集暂时缺失，待媒体表 ADR 补强。

## Alternatives Considered

- **直接照搬 MetaTube `MovieInfo` 字段名**（如把 `works.title` 改叫 `number`）：拒绝。破坏全局 canonical 命名合同，牵连导出 / API / XLSX 协议，其它 Provider 也要被迫改名。
- **一次建媒体 junction 表统一建模 封面 / 缩略 / 背景 / 图集**：拒绝。本期范围过大；先做作品级标量富字段，媒体表（含女优图集）作为独立 ADR 在 V0.9 / V1.0 另行设计。
- **女优 `images` 也建模为图集列**：拒绝。数组在扁平 CSV 表达不经济，且会冲击现有 `profile_image_url` 消费方；延后到媒体表 ADR 统一处理。
- **`score` 在 schema 层强约束为浮点**：拒绝。CSV-first 下所有列本质是文本，数值类型应在 V0.9 SQLite 物化层决定；事实源层不引入 `floatFields` 概念，保持 schema 简单。
