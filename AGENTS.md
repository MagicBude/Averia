# Averia 协作规则

## 当前阶段

Averia 正在进行 0.1 全量重构。PostgreSQL 是唯一事实源；公开预览只允许虚构数据。旧实现可从 Git 标签 `legacy-v0.7` 查阅，但不得未经审查复制旧数据或 Provider。

## 工程原则

1. TypeScript 使用严格模式，不以 `any` 绕过领域建模。
2. 页面不得直接拼写 SQL；数据访问必须经过明确的 Repository/Query 边界。
3. 数据库变更必须提交 Schema、迁移、测试和对应文档。
4. 稳定 ID 不依赖姓名、标题、番号或译名。
5. 外部数据先形成 Observation，再经人工审核进入已发布实体；禁止 last-write-wins。
6. 模糊匹配只用于检索排序，禁止自动建立人物同一关系。
7. 注释解释原因、边界和陷阱，不逐行翻译语法。
8. 用户可见文案和项目文档默认使用简体中文；代码标识符使用英文。

## 安全与内容

- 禁止提交真实人物或作品数据、成人图片、Cookie、Token、API Key、举报材料和生产数据库。
- 禁止实现绕过登录、验证码、付费墙、地域限制或其他访问控制的功能。
- 新访客默认安全模式；完整模式必须由用户主动开启。
- 高风险举报对象应先隐藏再复核，内部只保留处理所需的最少信息。

## 完成定义

提交前运行 `pnpm check`。自动检查通过只证明工程门槛，不代表界面已由用户实际验收；交付状态必须区分“自动验证通过”和“待用户验收”。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
