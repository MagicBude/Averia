import fs from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV 在引号字段内部意外结束。");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0];
  const records = rows
    .slice(1)
    .filter((row) => row.some((value) => value !== ""))
    .map((row, index) => {
      if (row.length !== headers.length) {
        throw new Error(
          `${filePath}: 第 ${index + 2} 行有 ${row.length} 列，预期 ${headers.length} 列。`,
        );
      }

      return Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    });

  return { headers, records };
}


export function stringifyCsv(headers, records) {
  const escapeField = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };

  const lines = [headers.map(escapeField).join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => escapeField(record[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function writeCsv(filePath, headers, records) {
  fs.writeFileSync(filePath, stringifyCsv(headers, records), "utf8");
}
