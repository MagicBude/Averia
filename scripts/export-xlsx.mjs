import path from "node:path";
import ExcelJS from "exceljs";
import { coerceForExport, loadCatalog, ROOT } from "./lib/catalog.mjs";

const catalog = loadCatalog();
const workbook = new ExcelJS.Workbook();
workbook.creator = "Averia";
workbook.subject = "结构化元数据导出";
workbook.title = "Averia 数据集";
workbook.company = "Averia";

for (const [name, dataset] of Object.entries(catalog)) {
  const sheetName = (dataset.schema.displayNameZh ?? name).slice(0, 31);
  const labels = dataset.schema.columnLabelsZh ?? {};

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = dataset.headers.map((header) => ({
    header: labels[header] ?? header,
    key: header,
    width: Math.min(Math.max(String(labels[header] ?? header).length + 4, 12), 28),
  }));

  for (const record of dataset.records) {
    worksheet.addRow(coerceForExport(record, dataset.schema));
  }

  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: dataset.headers.length },
  };

  for (const column of worksheet.columns) {
    let maxLength = String(column.header ?? "").length;
    column.eachCell({ includeEmpty: false }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value ?? "").length);
    });
    column.width = Math.min(Math.max(maxLength + 4, 12), 40);
  }
}

const outPath = path.join(ROOT, "exports", "xlsx", "averia.xlsx");
await workbook.xlsx.writeFile(outPath);
console.log("已生成 exports/xlsx/averia.xlsx（中文工作表与中文表头）。");
