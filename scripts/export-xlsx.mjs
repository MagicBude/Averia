import path from "node:path";
import ExcelJS from "exceljs";
import { coerceForExport, loadCatalog, ROOT } from "./lib/catalog.mjs";
import {
  ACTRESS_OVERVIEW_COLUMNS,
  DATASET_SHEET_ORDER,
  NON_XLSX_DATASETS,
  WORK_OVERVIEW_COLUMNS,
  buildActressOverviewRows,
  buildWorkOverviewRows,
} from "./export/xlsx.mjs";

const catalog = loadCatalog();
const workbook = new ExcelJS.Workbook();
workbook.creator = "Averia";
workbook.subject = "结构化元数据导出";
workbook.title = "Averia 数据集";
workbook.company = "Averia";

const HEADER_FILL = "FFE8EEF7";
const OVERVIEW_HEADER_FILL = "FFDCEFEA";

function applyCommonSheetStyle(worksheet, { overview = false } = {}) {
  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: overview ? OVERVIEW_HEADER_FILL : HEADER_FILL } };
  header.height = 24;

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: worksheet.columnCount },
  };

  for (const column of worksheet.columns) {
    let maxLength = String(column.header ?? "").length;
    column.eachCell({ includeEmpty: false }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value ?? "").length);
      cell.alignment = { vertical: "top", wrapText: true };
    });
    column.width = Math.min(Math.max(maxLength + 4, 12), 40);
  }
}

function addOverviewSheet(name, columns, rows) {
  const worksheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = columns.map(([key, header]) => ({ key, header, width: Math.min(Math.max(header.length + 4, 12), 28) }));
  worksheet.addRows(rows);
  applyCommonSheetStyle(worksheet, { overview: true });
  return worksheet;
}

addOverviewSheet("女优总览", ACTRESS_OVERVIEW_COLUMNS, buildActressOverviewRows(catalog));
addOverviewSheet("作品总览", WORK_OVERVIEW_COLUMNS, buildWorkOverviewRows(catalog));

const orderedNames = [
  ...DATASET_SHEET_ORDER.filter((name) => catalog[name]),
  ...Object.keys(catalog).filter((name) => !DATASET_SHEET_ORDER.includes(name) && !NON_XLSX_DATASETS.includes(name)).sort(),
];

for (const name of orderedNames) {
  const dataset = catalog[name];
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

  for (const record of dataset.records) worksheet.addRow(coerceForExport(record, dataset.schema));
  applyCommonSheetStyle(worksheet);
}

const outPath = path.join(ROOT, "exports", "xlsx", "averia.xlsx");
await workbook.xlsx.writeFile(outPath);
console.log("已生成 exports/xlsx/averia.xlsx（女优总览、作品总览 + 规范化数据表；工作表顺序固定）。");
