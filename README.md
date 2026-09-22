# Averia

> 演员档案、作品关系与多维检索。

Averia 是一个中文优先、保留日文原名和罗马字的成人影视元数据档案项目。它强调可追溯来源、保守的身份归一、作品与发行版本分离，以及可组合的检索体验。

当前版本是 **0.1 重构预览**：只包含虚构数据、全新的产品文档、PostgreSQL Schema、响应式首页原型和自动质量门禁。真实资料、采集器、公开 API、账号系统和生产部署尚未实现。

## 快速开始

要求 Node.js 22+、pnpm 11.21.0。默认使用经过审查的虚构 Demo 数据，不要求数据库：

```powershell
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。

需要验证 PostgreSQL 链路时，准备独立数据库账户并修改 `.env.local`：

```powershell
pnpm install
Copy-Item .env.example .env.local
# 将 AVERIA_DATA_SOURCE 改为 postgres，并填写真实 DATABASE_URL。
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`postgres` 模式连接或查询失败时会明确报错，不会静默回退到 Demo 数据。

## 常用命令

| 命令               | 用途                             |
| ------------------ | -------------------------------- |
| `pnpm dev`         | 启动本地开发服务器               |
| `pnpm check`       | 格式、Lint、类型、测试和生产构建 |
| `pnpm db:generate` | 从 Drizzle Schema 生成迁移       |
| `pnpm db:migrate`  | 执行 PostgreSQL 迁移             |
| `pnpm db:seed`     | 写入虚构示例数据                 |
| `pnpm db:studio`   | 图形化查看数据库                 |

## 项目结构

```text
src/app/          Next.js 页面和全局设计系统
src/components/   可复用交互组件
src/data/         仅供公开预览的虚构数据
src/db/           PostgreSQL Schema、迁移和种子入口
src/server/       Repository 与仅服务端的数据访问实现
drizzle/          版本化数据库迁移
docs/             按产品、架构、数据、安全和运维分类的文档
```

## 关键边界

- 只收录职业演员、可验证的成人正式发行作品、非成人履历和公开职业社交链接。
- 排除年龄不明、疑似未成年、偷拍、泄露、非自愿和私人信息。
- 公共档案与浏览器本地收藏分离。
- 模糊搜索可以改变排序，但绝不自动合并人物。
- 图片能在来源站看到，不等于 Averia 有权复制或托管。
- 0.1 不接入真实数据和 Provider。

完整决策从 [`docs/README.md`](docs/README.md) 开始。

## License

源代码采用 [MIT License](LICENSE)。该许可证不自动覆盖数据、图片、品牌或第三方内容。
