# ADR-0001: 真相源格式 —— CSV 为唯一事实源，JSON 为中间表示，SQLite 为派生只读层

- **Status**: Accepted
- **Date**: 2026-09-04
- **Deciders**: MagicBude（Averia 所有者）

## Context

Averia 的数据本质是**关系型 + 嵌套数组**：一部作品带 `genres[]`、`cast[]`，演员有跨源别名（`name_ja` / `name_en` / 未来的 `name_zh`）。
用户曾纠结"CSV 当真相源、其他当产出是否不好，是不是该用 JSON 当来源"。需要明确：数据存储的**耐久真相源**究竟用哪种格式，其余格式各扮演什么角色。

作用力：

- 用户偏好表格 / Excel 文件，习惯在表格里直接核对与修正。
- 现有生态（16 个 schema、XLSX 导出、质量门禁、行级 git diff）已全部建在 CSV 之上。
- 数据需要被查询、被下游（未来的 API / Web / 本地影视库）消费。
- 只保留一个耐久真相源、其余全部派生可重生，是比"选哪种格式"更根本的正确性原则。

## Decision

1. **CSV 是唯一事实源**。`data/` 下的规范 CSV 是唯一可手工维护的耐久存储；一切写入最终落在这里。
2. **JSON（canonical）是中间 / 工作表示**。数据流为
   `Provider → canonical.json → Stage → Apply → CSV`。
   JSON 不单独承担真相源职责，它是管道里的通行格式。
3. **XLSX 是人类面向的导出物**，由 CSV 自动生成，禁止反过来当主数据维护。
4. **SQLite 是派生只读层（V0.9）**，不是事实源：每次 `import:apply` 后通过 `db:sync` 由 CSV 物化而来，供查询 / 搜索 / 下游消费；任何写操作都不直接落 SQLite。
5. **铁律**：只保留一个耐久真相源，其余全部派生、可重生。CSV / JSON / SQLite 只是序列化格式之争，不影响正确性。

## Consequences

**正面**：

- 保留 Excel 原生可编辑性，契合用户偏好。
- 列名即稳定数据协议（改一行即一行 git diff，人审极清楚）。
- SQLite 在 V0.9 提供查询 / 全文搜索能力，而**不改变**事实源，零迁移风险。
- 嵌套数组用 junction CSV（`work_genres` / `work_cast` / `entity_aliases`）表达，虽啰嗦但可控、可 diff。

**负面 / 风险**：

- 关系型数据用扁平文件表达略别扭（16 个文件、含 junction 表）。
- 若未来查询需求很强，CSV 的"先 load 再查"会有性能天花板 —— 此场景由 SQLite（派生层）承接，而非推翻 CSV。

## Alternatives Considered

- **JSON / NDJSON 当事实源**：拒绝。会破坏 Excel 偏好与现有 CSV 生态，需一次性大迁移；且普通漂亮打印 JSON 的数组插入会让 git diff 下移后续所有行（NDJSON 能缓解但仍牺牲 Excel 友好）。
- **SQLite 当事实源**：拒绝。CSV 必须保持可手工编辑的真相；SQLite 作为"算出来的产物"可随时从 CSV 重建，当事实源反而增加双写不一致风险。Localogue 已验证"SQLite 当主库 + 拒绝在线抓取"的路线，但 Averia 定位不同（采集与规范层），CSV 真相源 + SQLite 派生层更契合。
- **维持现状不立 ADR**：拒绝。用户曾在 CSV / JSON / SQLite 间反复纠结，固化决策可避免下次再议。
