# Averia 整合能力矩阵

日期：2026-09-08。`jav-catalog`、`jav-idol-db` 为用户自有项目的只读迁移来源；JavBoss 仅作 GPL 隔离下的产品观察。

| 能力 | Averia 现状 | jav-catalog | jav-idol-db | 最终决定 / 保留位置 | 淘汰与风险 |
| --- | --- | --- | --- | --- | --- |
| 数据模型 | 16 表 CSV + 派生 SQLite | 关系型 SQLite、Repository、图片/描述表 | 扁平 JSON | 在 Averia 建唯一 SQLite canonical；保留稳定 Averia ID | 不整体复制 Catalog schema；先 round-trip |
| 番号 Normalize | `normalizeCatalogCode`，测试覆盖 | TypeScript 纯函数与特殊类型 | `idnorm.py` 等真实边界 | 合并 fixture 后只留 Averia core 规则 | 前导零/特殊番号差异必须阻断 |
| 女优 Matcher | NFKC 精确唯一名/别名/external ID | 保守 matcher | 别名脚本与真实脏数据 | Averia 唯一 matcher；禁止模糊合并 | 同名多人必须返回 ambiguous |
| 标签映射 | 规范 Genre + entity_aliases | canonicalizer | 多份映射脚本 | Observation 后人工/显式别名归并 | 禁止仅凭翻译自动合并 |
| Provider Contract | canonical JSON + Prepare | typed provider-neutral contract | Python adapters | 在 Averia 定义唯一 contract，逐个迁移 parser/fixture | 不长期保留两套同源 Provider |
| HTTP Client | Node/curl、代理发现、有限重试、脱敏 | Fetch、限速、缓存、health | 多套 requests | 保留并模块化 Averia 安全传输层 | Provider 私有网络逻辑逐步淘汰 |
| 溯源/Resolver | SourceRecord + Observation + FieldResolution | 事务型三层模型 | `_sources`/扁平字段 | SQLite 中唯一 Observation/Resolver | 标量与关系 resolver 分离 |
| 导入 | Prepare/Report/Apply、指纹、备份 | dry-run 事务 pipeline | 直接 JSON 工具 | 适配 SQLite revision 的 Averia 流程 | 禁止 legacy 直接覆盖 canonical |
| 导出 | 稳定 CSV/JSON/中文 XLSX | SQLite 多格式导出 | JSON/static/XLSX | 从 SQLite 生成全部发布视图 | CSV 切换后不可独立写入 |
| Web | 静态 Web/Docs | Next.js 完整目录与筛选 | 静态站 | 在 Averia clean-room 建唯一 Web | 不复制 JavBoss GPL 代码/资产 |
| NFO | 尚无 | XML 转义、预览/下载 | 有零散工具 | 独立移植至 Averia media-export 边界 | 不扫描/覆盖媒体目录 |
| 115 工具 | 无 | 明确排除 core | `tools/115rename.py` | 只设计 API/JSON 消费者合同 | 本轮不接 SDK、不真实改名 |

## 许可证结论

- jav-catalog 为 MIT，当前 Git 作者为用户；迁移前仍逐文件检查上游声明与 `THIRD_PARTY_NOTICES.md`。
- jav-idol-db 声明 MIT，当前 Git 作者为用户；真实数据的来源许可不随代码 MIT 自动转移。
- Averia 当前未声明统一代码/数据许可证，不能擅自修改许可证。
- JavBoss 为 `GPL-3.0-only` 且有独立贡献历史。其 JSX、CSS、Go、测试、图标、截图、Logo 和品牌资产均不得进入 Averia；仅记录作品网格、筛选、分页、URL 状态、滚动恢复等一般需求，并 clean-room 实现。

## 唯一化目标

最终只保留一套 canonical SQLite、Provider Contract、HTTP Client、Normalize/Matcher、Observation/Resolver、导入、导出和 Web。迁移期间的兼容适配器必须有明确删除条件，不能形成永久双轨。
