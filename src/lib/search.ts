export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[‐‑‒–—―ー]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearch(query: string, values: readonly string[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}
