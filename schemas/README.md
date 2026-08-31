# 数据 Schema

本目录中的 Schema 是 Averia 自己维护的**CSV 表结构契约**，并不是完整的 JSON Schema 标准文档。

它们主要定义：

- CSV 文件位置
- 精确字段顺序
- 主键
- 必填字段
- ID 格式
- 外键
- 日期 / 时间 / 整数 / 布尔值类型
- 枚举值
- XLSX 中文工作表名和中文表头

`scripts/validate-data.mjs` 会直接加载这些 Schema 对 CSV 进行校验。
