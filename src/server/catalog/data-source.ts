export type CatalogDataSource = "demo" | "postgres";

export function resolveCatalogDataSource(
  value = process.env.AVERIA_DATA_SOURCE,
): CatalogDataSource {
  if (!value || value === "demo") return "demo";
  if (value === "postgres") return "postgres";
  throw new Error(`不支持的数据源 AVERIA_DATA_SOURCE=${value}，只能使用 demo 或 postgres。`);
}
