# 架构决策记录（ADR）

本目录用 **ADR（Architecture Decision Record）** 固化 Averia 的关键技术决策。
做法借鉴 Localogue 的 ADR 制度（ADR-013/014/016 等），目标是让"为什么这么定"可被后人检索，而不是散落在聊天记录或某次提交里。

## 何时写 ADR

满足任一即可写一条：

- 选了某个架构方向（真相源格式、存储、数据模型演进）
- 拒绝了明显可行的替代方案（尤其用户曾纠结过的）
- 引入了会长期影响后续设计的约束（合规边界、许可证）

纯实现细节、bug 修复、临时方案 **不** 写 ADR，写在 CHANGELOG 即可。

## 命名与状态

- 文件：`0001-<短横线主题>.md`，序号从 0001 起单调递增，不回收。
- 状态：`Proposed`（提议） → `Accepted`（已采纳） → `Deprecated`（弃用） / `Superseded by ADR-XXXX`（被某条取代）。
- 被取代时，在原文件顶部加一行 `**Superseded by ADR-XXXX**`，新文件在 Context 里说明取代关系，不要物理删除旧文件。

## 格式

见 [TEMPLATE.md](./TEMPLATE.md)。每条必须含：Context / Decision / Consequences / Alternatives Considered。

## 决策日志

| ADR | 标题 | 状态 | 日期 |
| --- | ---: | --- | --- |
| [0001](./0001-source-of-truth-format.md) | 真相源格式：CSV 为唯一事实源，JSON 为中间表示，SQLite 为派生只读层 | Accepted | 2026-09-04 |
