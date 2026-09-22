# 部署策略

GitHub 负责代码、评审和 CI/CD，不作为生产数据库或完整模式成人内容的托管方。

## 环境

- 本机：Next.js 直接运行，PostgreSQL 由 Docker Compose 隔离运行。
- 公网预览：前台公开、后台登录，只放虚构数据。
- 生产：必须选择条款明确允许合法成人资料的境外托管服务，并另行审核数据库、对象存储和图片政策。

每次推送先执行格式、Lint、类型检查、单元测试和生产构建；失败不部署。生产数据库、图片、举报材料、管理员配置和凭据禁止进入 Git。

## 数据源配置

- `AVERIA_DATA_SOURCE=demo`：默认的虚构公开预览，可在没有数据库的 CI 中完成静态构建。
- `AVERIA_DATA_SOURCE=postgres`：从 `DATABASE_URL` 指向的 PostgreSQL 读取已发布实体。迁移、种子、构建和运行环境都必须获得数据库连接。
- PostgreSQL 模式失败时禁止回退到 Demo。部署健康检查必须能暴露连接、迁移或查询错误。

本机已有 PostgreSQL 服务并不代表 Averia 已获授权使用其管理员账户。应创建项目专用数据库和最小权限账户，将凭据只放入被 Git 忽略的 `.env.local`。

## 本机 Docker 数据库

当前 Compose 仅承载 PostgreSQL，不把 Next.js 开发服务器装进容器。这样既能获得一致、隔离、可重建的数据库环境，又保留本机断点调试和热更新的学习体验。

首次启动：

```powershell
Copy-Item .env.example .env.local
docker compose -f compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
```

将 `.env.local` 中的连接配置设为：

```dotenv
DATABASE_URL=postgresql://averia:averia_dev_only@127.0.0.1:55432/averia
AVERIA_DATA_SOURCE=postgres
```

`averia_dev_only` 是提交在 Compose 文件中的公开本地开发口令，不能用于公网、生产环境或其他数据库。真实凭据仍必须放在仓库外。

日常使用：

```powershell
# 启动已有数据库
docker compose -f compose.dev.yml up -d

# 查看状态
docker compose -f compose.dev.yml ps

# 停止容器但保留数据
docker compose -f compose.dev.yml stop
```

`docker compose -f compose.dev.yml down` 会移除容器和网络，但默认保留命名数据卷。不要随意添加 `-v`；它会删除 Averia 本机数据库卷，只适用于明确需要清空开发数据时。

## 公开前门槛

- 安全模式和分享预览完成泄露检查
- 权利与安全举报流程可用
- 图片策略和托管条款通过人工确认
- 真实数据经过来源和年龄边界审核
- 用户实际完成桌面与手机验收
