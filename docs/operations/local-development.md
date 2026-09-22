# 本地开发手册

本文是 Averia 本机开发操作的唯一详细入口。README 只保留最短路径；遇到环境、数据库或启动问题时以本文为准。

## 组件边界

- Next.js、TypeScript 和测试命令直接运行在 Windows 上，便于热更新和断点调试。
- Docker 只运行 PostgreSQL 18，避免与电脑已有数据库互相影响。
- `.env.local` 保存本机选择和连接信息，已被 Git 忽略。
- Docker 命名卷保存数据库数据；停止或重建容器不会自动删除它。

## 首次准备

要求：Node.js 22 或更高版本、pnpm 11.21.0、Docker Desktop。

```powershell
pnpm install
Copy-Item .env.example .env.local
docker compose -f compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

打开 <http://127.0.0.1:3000>。首次创建的 `.env.local` 默认仍使用 `demo` 数据源；确认数据库迁移和种子成功后，将 `AVERIA_DATA_SOURCE` 改为 `postgres`，再重启开发服务器。

## 每天开始和结束

开始：

```powershell
docker compose -f compose.dev.yml up -d
pnpm dev
```

结束：

```powershell
# 先在运行 pnpm dev 的终端按 Ctrl+C，再停止数据库容器。
docker compose -f compose.dev.yml stop
```

`stop` 会保留数据库数据。Docker Desktop 关闭后，下次启动 Docker Desktop 并再次执行 `up -d` 即可。

## 数据源切换

无需数据库的虚构预览：

```dotenv
AVERIA_DATA_SOURCE=demo
```

读取本机 PostgreSQL：

```dotenv
DATABASE_URL=postgresql://averia:averia_dev_only@127.0.0.1:55432/averia
AVERIA_DATA_SOURCE=postgres
```

修改 `.env.local` 后应重启 `pnpm dev`。`postgres` 模式连接失败时会直接报错，不会回退到 Demo，以免把示例数据误认为数据库内容。

## 数据库日常操作

```powershell
# 查看容器健康状态
docker compose -f compose.dev.yml ps

# 应用尚未执行的迁移
pnpm db:migrate

# 写入可重复执行的虚构示例数据
pnpm db:seed

# 打开 Drizzle Studio 查看数据
pnpm db:studio
```

修改 Schema 后先运行 `pnpm db:generate` 生成迁移，检查迁移内容，再运行 `pnpm db:migrate`。不要直接修改已经提交并在其他环境执行过的迁移文件。

## 质量检查

提交前运行：

```powershell
pnpm check
```

该命令依次执行格式检查、ESLint、TypeScript 类型检查、单元测试和生产构建。自动检查通过不等于人工验收完成；仍需打开受影响页面验证交互和布局。

## 常见问题

### Docker 已启动但数据库不可用

```powershell
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs --tail 100 postgres
```

状态应为 `healthy`。端口使用 `55432`，不是系统 PostgreSQL 常见的 `5432`。

### 3000 端口被占用

先检查是否已经有 Averia 开发服务器在运行。优先使用现有的 <http://127.0.0.1:3000>，不要重复启动多个实例；需要重启时，在原终端按 `Ctrl+C` 后再执行 `pnpm dev`。

### 想重新创建容器

```powershell
docker compose -f compose.dev.yml down
docker compose -f compose.dev.yml up -d
```

这不会删除命名卷。不要随意执行 `docker compose -f compose.dev.yml down -v`；其中 `-v` 会永久删除 Averia 本机数据库数据。只有明确要清空全部开发数据时才可使用，并应先导出需要保留的内容。

## 不进入仓库的内容

生产数据库、`.env.local`、图片、管理员配置、举报记录和采集凭据都不得提交。仓库只保留公开的本地开发默认值、虚构示例数据和可审查的迁移文件。
