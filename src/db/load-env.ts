import nextEnvironment from "@next/env";

const { loadEnvConfig } = nextEnvironment;

/**
 * 让独立数据库脚本采用与 Next.js 相同的环境变量加载顺序。
 *
 * `dotenv/config` 默认只读取 `.env`，容易让本地脚本漏掉被 Git 忽略的
 * `.env.local`。统一使用 Next.js 的加载器后，开发服务器、迁移和种子任务
 * 会读取同一份配置，同时仍不会把本地凭据提交到仓库。
 */
export function loadDatabaseEnvironment(): void {
  loadEnvConfig(process.cwd());
}
