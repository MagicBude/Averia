# 目标架构

```text
浏览器
├─ 公开档案与检索
├─ 安全/完整模式（本地偏好）
└─ 收藏、标签、备注（仅本地）
        │
        ▼
Next.js 应用
├─ 页面与 Server Components
├─ 查询服务 / 管理 API
├─ GitHub OAuth 管理员白名单（后续）
└─ 草稿、审核、发布和举报用例
        │
        ▼
PostgreSQL 唯一事实源
├─ 已发布实体与关系
├─ Observation / Resolution
├─ 媒体权利状态
└─ 审计日志
```

## 边界

- 前后端使用 TypeScript，降低初学阶段的语言切换成本。
- Next.js 是模块化单体，不提前引入微服务、Redis、消息队列或独立搜索集群。
- PostgreSQL 同时用于本机和公网，避免 SQLite/PostgreSQL 行为漂移。
- 第一阶段使用 PostgreSQL 原生索引和搜索能力；只有量级与查询证据证明必要时才引入独立搜索服务。
- 数据访问逐步收敛到 Repository/Query Service；UI 不直接访问数据库。

## 教学策略

每个版本只引入少量新概念，并同时提供 README、ADR、自动测试和可运行验收路径。注释解释设计原因；通用语言教程只做精简说明并链接权威资料。
