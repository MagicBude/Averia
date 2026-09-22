import "server-only";

import { resolveCatalogDataSource } from "./data-source";
import { demoCatalogRepository } from "./demo-repository";
import type { CatalogRepository } from "./types";

export async function getCatalogRepository(): Promise<CatalogRepository> {
  const source = resolveCatalogDataSource();
  if (source === "demo") return demoCatalogRepository;

  // 动态导入确保公开虚构预览不会初始化数据库驱动或误触生产连接。
  const { postgresCatalogRepository } = await import("./postgres-repository");
  return postgresCatalogRepository;
}
