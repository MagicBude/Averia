export function isValidUtcTimestamp(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text)) return false;
  const date = new Date(text);
  if (Number.isNaN(date.valueOf())) return false;

  // 防止 Date 对非法日历日期进行静默归一化，例如 2026-02-30。
  const normalized = date.toISOString();
  const inputWithoutFraction = text.replace(/\.\d{1,3}Z$/, "Z");
  const normalizedWithoutFraction = normalized.replace(/\.\d{3}Z$/, "Z");
  if (!text.includes(".")) return inputWithoutFraction === normalizedWithoutFraction;

  const [inputBase, inputFractionWithZ] = text.split(".");
  const inputFraction = inputFractionWithZ.slice(0, -1).padEnd(3, "0");
  const normalizedBase = normalized.slice(0, 19);
  const normalizedFraction = normalized.slice(20, 23);
  return inputBase === normalizedBase && inputFraction === normalizedFraction;
}
