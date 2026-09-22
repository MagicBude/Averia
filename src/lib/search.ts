export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[‐‑‒–—―ー]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchMatch = {
  index: number;
  kind: "exact" | "prefix" | "contains" | "fuzzy";
  score: number;
  value: string;
};

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

/**
 * 返回最可信的命中及其来源。模糊匹配只用于展示和排序，调用方不得据此
 * 合并人物或改写实体身份。
 */
export function findSearchMatch(query: string, values: readonly string[]): SearchMatch | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const candidates = values.flatMap((value, index) => {
    const normalizedValue = normalizeSearchText(value);
    let kind: SearchMatch["kind"] | null = null;
    let score = 0;

    if (normalizedValue === normalizedQuery) {
      kind = "exact";
      score = 100;
    } else if (normalizedValue.startsWith(normalizedQuery)) {
      kind = "prefix";
      score = 80;
    } else if (normalizedValue.includes(normalizedQuery)) {
      kind = "contains";
      score = 60;
    } else if (normalizedQuery.length >= 4) {
      const distance = editDistance(normalizedQuery, normalizedValue);
      const allowedDistance = Math.max(1, Math.floor(normalizedQuery.length * 0.25));
      if (distance <= allowedDistance) {
        kind = "fuzzy";
        score = 30 - distance;
      }
    }

    return kind ? [{ index, kind, score, value }] : [];
  });

  return (
    candidates.sort((left, right) => right.score - left.score || left.index - right.index)[0] ??
    null
  );
}

export function matchesSearch(query: string, values: readonly string[]): boolean {
  if (!normalizeSearchText(query)) return true;
  return findSearchMatch(query, values) !== null;
}
