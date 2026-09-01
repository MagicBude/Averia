# Averia 安全导入 Pipeline — V0.2

## 设计目标

正式 `data/*.csv` 不接受 Provider 直接写入。流程固定为：

```text
来源数据
  ↓
统一导入 JSON
  ↓
Prepare：标准化 + 精确匹配 + 分配新 ID
  ↓
Stage：stage.json + report.md
  ↓
人工审核
  ↓
Apply：备份 + 写 CSV + 全量校验
  ↓
JSON / XLSX 导出 + Git diff
```

## 1. 准备批次

```bash
pnpm import:prepare -- --file imports/examples/canonical.example.json --batch demo-001
```

生成：

```text
var/imports/demo-001/input.json
var/imports/demo-001/stage.json
var/imports/demo-001/report.md
```

`prepare` **绝不会修改正式 CSV**。

## 2. 查看报告

```bash
pnpm import:report -- --batch demo-001
```

重点检查：

- `ambiguous-*`：一个输入精确匹配到多个实体；
- `unresolved-cast`：作品参演者无法确定；
- `proposals`：已有实体的字段补全建议，不会自动写入。

## 3. 应用批次

仅当阻塞错误为 0 时：

```bash
pnpm import:apply -- --batch demo-001
```

Apply 会：

1. 检查正式 CSV 指纹，确认 prepare 之后没有被别人修改；
2. 在 `var/backups/<batch>/` 创建数据备份；
3. 只追加 stage 中确定的记录；
4. 自动运行 `data:validate`；
5. 如果校验失败，自动恢复备份；
6. 成功后写入 `applied.json`，防止同一批次重复应用。

## 4. 最后检查

```bash
pnpm data:export
pnpm check
git diff
```

确认 diff 后再提交。

## 为什么暂时不让 Provider 直接抓取并入库

V0.2 先稳定统一数据合同和安全写入边界。V0.3 再增加具体 Provider；这样每增加一个来源，只需负责“获取 + 解析 → 统一 JSON”，不需要重复实现 ID、匹配、审核、备份和写库逻辑。
