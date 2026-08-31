import { loadCatalog } from "../../scripts/lib/catalog.mjs";

export function loadEmptyCatalog() {
  const catalog = loadCatalog();
  return Object.fromEntries(
    Object.entries(catalog).map(([name, dataset]) => [
      name,
      {
        ...dataset,
        records: [],
      },
    ]),
  );
}
