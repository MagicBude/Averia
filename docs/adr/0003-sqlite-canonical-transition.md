# ADR-0003：SQLite canonical 真相源迁移

- 状态：提议（安全准备完成，尚未切换）
- 日期：2026-09-08

## 决定

Averia 的长期运行时 canonical 真相源将从分表 CSV 切换到 SQLite。当前阶段仍由 CSV 作为唯一可写事实源；只有完成本文验收门槛并获得正式数据写入授权后，才能修改 `AGENTS.md`、导入方向和发布流程。

SQLite 保存实体、关系、SourceRecord、Observation、FieldResolution、人工锁定和批次审计。Provider 只产生原始快照与标准化观察；Matcher 和 Resolver 在事务中形成候选决定。CSV、JSON、XLSX、API 和 Web 都是 SQLite 的确定性发布/查询视图。

## 为什么改变

CSV 适合 Git 审查和确定性发布，但不能可靠承载跨表事务、并发写入、Observation 历史、字段锁、可续跑批次和服务端组合查询。SQLite 提供外键、事务、在线备份和单文件可移植性，又不妨碍继续发布可读 CSV。

## 稳定 ID 与无损迁移

1. 首次迁移逐表读取现有 CSV，原样保留所有公开 `*_000001` ID；显示名和番号永不替代主键。
2. 在临时数据库执行正式 migration，开启 `PRAGMA foreign_keys=ON`，整批导入后运行 `foreign_key_check` 与 `integrity_check`。
3. 从临时 SQLite 导出 CSV，与当前 CSV 按显式表顺序、列顺序、NULL/空字段规则逐字段比较。
4. 只有零信息损失时才可生成正式库；若发布 CSV 不能表达完整 Observation/审计历史，必须明确标记为发布视图，不能称为备份。
5. 切换不修改既有 ID，也不复用已删除 ID；新 ID 由数据库中的单调分配记录生成。

## 确定性导出

每张表定义固定列与排序键；JSON 键序、CSV 换行、XLSX sheet/属性/ZIP 时间戳固定。相同数据库 revision 连续导出两次必须字节一致。导出器不得写入数据库，不加入无业务意义的当前时间。

## Prepare / Report / Apply 与回滚

Prepare 保存输入 SHA-256、数据库 schema version 和 canonical revision，只产生预览。Apply 必须重新验证三者，先做 SQLite online backup，再在单事务中写入 SourceRecord/Observation/Resolution/实体关系；任何校验失败整批回滚。成功批次记录幂等键。人工锁定由数据库约束和 Resolver 双重保护。

回滚优先恢复切换前只读备份并重新导出；旧 CSV 在验收期保持可用，不删除、不重写。正式切换属于破坏性真相源迁移，必须单独获得用户确认。

## 切换验收门槛

- 正式 migration、Repository、事务回滚、锁定保护测试通过；
- CSV → 临时 SQLite → CSV 全量逐字段比较通过；
- SQLite → CSV → 临时 SQLite 的实体、关系与关键字段 round-trip 通过；
- JSON/XLSX 两次导出字节一致；
- 当前 16 个数据集、1483 行和全部稳定 ID 无损；
- API/Web 只读走 Repository，不直接访问 Provider；
- 备份恢复演练通过；
- 用户明确授权正式切换。

## 当前兼容性结论

现在直接切换会违反仓库现行 `AGENTS.md`、README 与 ADR-0001 的 CSV-first 契约，并可能影响依赖 `data/*.csv` 的外部消费者。因此本 ADR 只完成架构决定和安全迁移设计，不执行正式真相源切换。
