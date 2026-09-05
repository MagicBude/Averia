# 字段级溯源与冲突裁决（V0.8）

本文档说明 Averia 如何在「多来源、跨语言」前提下，既保留每个字段的来源证据，又避免含糊地合并实体。

## 1. 三张表的职责

| 表 | 写入时机 | 是否可改 | 用途 |
| --- | --- | --- | --- |
| `observations` | `import:prepare` 对每个「来源贡献的字段值」 | 只追加，永不修改 | 字段级 provenance：「某来源对某实体的某字段观察到了什么」 |
| `field_resolutions` | `import:prepare` 对每个字段的「采用值决策」 | 由 `resolution:decide` 写 `status=manual` | 记录最终采用值、依据、胜出来源、冲突来源 |
| `entity_aliases` | 跨源/跨语言显式别名，或 `resolve:link` 写入 | 显式增删 | 把另一个名字/外部 ID 挂到既有实体，matcher 当作精确键 |

三张表本身都是 CSV（正式数据集），JSON/XLSX 由 CSV 重新生成。

## 2. 一次导入的字段级流程

```text
Provider（moodyz / dmm-rental / javinfo / javdatabase）
   │  raw.json + canonical.json + meta.json（保留原始，不丢）
   ▼
import:prepare
   ├─ 实体精确匹配（source_record_id / 规范名 / entity_aliases 精确键）
   ├─ 追加确定新实体 / 关系 / 来源映射
   ├─ 对每个贡献字段写 observations（append）
   ├─ 空字段补全 → field_resolutions(method=auto_fill, status=auto)
   └─ 冲突字段 → field_resolutions(status=pending_review)  【阻断该字段 Apply】
   ▼
import:report / resolution:report
   └─ 展示待追加、待审冲突、来源证据
   ▼
人工审核：resolution:decide / resolve:link
   ▼
import:apply
   └─ 存在任何 pending_review → 整体阻断（exit 5），不写正式 CSV
      无 pending_review → 备份 → 写实体 CSV + 三表 → 全量校验失败回滚
```

## 3. 冲突的两种结局

### 3.1 安全补全（auto_fill）

字段当前为空，且仅有一个来源提供值 → 直接采用，记录 `field_resolutions(method=auto_fill, status=auto)`，不阻断。

例：既有 `actress_000002` 的 `profile_image_url` 为空，JavInfo 提供 URL → auto_fill。

### 3.2 冲突阻断（pending_review）

两个可靠来源对同一**非空**字段给出不同值 → 生成 `field_resolutions(status=pending_review, conflicting_observation_ids=[...])`，Apply 被整体阻断，直到人工裁决。

例：既有 `actress_000002.primary_name = 桃乃木かな`（日文），JavInfo 给出英文 `Kana Momonogi` → 因差异且均非空 → pending_review，**绝不**静默用英文名覆盖日文主键。

## 4. 跨语言 / 跨源归并

归并**只**能经以下显式途径建立，字符串相似度不触发自动合并：

1. 同来源 `source_record_id` 映射；
2. 实体表 `primary_name` / `name_ja` / `name_en` / `kana` / 规范名 相等；
3. `entity_aliases` 中已存在的显式别名 / 外部 ID 精确相等；
4. 作品标准化番号相等。

人工归并命令：

```bash
# 查看待审冲突及双方来源值
pnpm resolution:report -- --batch <id>

# 裁决某条 pending_review：选定值 + 胜出来源
pnpm resolution:decide -- --resolution <res_id> --value <选定值> [--source <胜出来源>]

# 拒绝新建、改挂别名（跨语言归并：Kana Momonogi → actress_000002）
pnpm resolve:link -- --alias "Kana Momonogi" --entity actress_000002 --type en
```

`resolve:link` 会写入 `entity_aliases` 与一条 `field_resolutions(method=link)`，后续相同别名将精确命中既有实体，不再建重。

## 5. 来源语言与权威性

- `SOURCE_STRATEGY.md` 规定：厂商官方日文源优先；FANZA/DMM 经 JavInfo 返回的英文人名/分类为 `reference`，**不覆盖**日文 `authoritative` 字段。
- 因此 JavInfo 的英文 `primary_name` 候选与日文既有 `primary_name` 冲突时，应优先保留日文，英文放入 `name_en` 或 `entity_aliases`（type=en），而非覆盖主键。

## 6. 回滚与可审计性

- 每条 `observation` 保留 `raw_hash`，可回查 Provider `raw.json` 原文。
- `field_resolutions` 记录 `conflicting_observation_ids`，裁决过程可审计、可回滚。
- `import:apply` 失败自动恢复 `data/` 备份，CSV 始终是唯一事实源。
