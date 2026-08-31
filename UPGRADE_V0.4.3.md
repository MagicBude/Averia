# Averia V0.4.3 升级说明

V0.4.3 在第一次真实数据 Apply 前补齐 Director 数据模型。

## 新增

- `data/taxonomy/directors.csv`
- `data/relations/work_directors.csv`
- 对应两个 Schema
- canonical `works[].directors[]` 导入映射
- MOODYZ `監督` → Director / WorkDirector
- SourceRecord `entity_type=director` 预留支持

## 为什么现在改

真实 `MDVR-434` 页面提供 `監督：ジーニアス膝`，而 V0.4.2 只把它保存在来源备注中。此时正式数据仍为空，立即补齐模型不会产生历史迁移成本。

## 升级后

重新执行原批次的 `import:prepare` 和 `import:report`。原 Stage 的 catalog fingerprint 已过期，不应直接 Apply。
