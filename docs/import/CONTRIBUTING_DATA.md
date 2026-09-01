# 数据录入与修正规范

## 修改前

先阅读：

```text
docs/standards/DATA_STANDARD.md
```

并了解 `docs/standards/FIELD_DICTIONARY.md` 中的字段含义。

## 新增女优

1. 分配下一个未使用的 `actress_*` ID。
2. 在 `data/actresses/actresses.csv` 新增一行。
3. 已知的其他姓名、艺名、罗马字等写入 `actress_aliases.csv`。
4. 外部来源数据应增加对应来源记录。
5. 运行校验和导出。

## 新增作品

1. 分配新的 `work_*` ID。
2. 在 `works.csv` 中新增作品主记录。
3. 将主番号及其他番号形式写入 `work_codes.csv`。
4. 将女优参演关系写入 `work_cast.csv`。
5. 将作品分类写入 `work_genres.csv`。
6. 如果来源提供导演，将导演写入 `directors.csv`，并通过 `work_directors.csv` 建立关系。
6. 如果引用的厂商、厂牌、系列或分类尚不存在，先创建对应实体。
7. 增加数据来源记录。
8. 执行校验和导出。

## 修正数据

禁止直接修改自动生成的 JSON / XLSX。

正确方式是修改 CSV 主数据。

如果一次修正源于多个来源之间存在冲突，应保留足够的来源信息，使未来能够解释“为什么最终采用这个值”。

## 数据校验

执行：

```bash
pnpm data:validate
```

当前校验至少覆盖：

- CSV 表头是否完全匹配
- 主键是否重复
- ID 格式是否合法
- 外键引用是否存在
- 布尔值格式
- 日期和整数格式
- 重复关系记录
- 番号标准化一致性
