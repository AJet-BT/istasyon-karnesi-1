import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { MOCK_PERIODS, MOCK_ROWS, mockFileName } from "./mock-data-fixture.mjs";

const root = process.env.AJET_PROJECT_ROOT ? path.resolve(process.env.AJET_PROJECT_ROOT) : path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "public", "mock-data");
const previewDir = path.join(process.env.TMPDIR || "/tmp", "ajet-mock-workbook-previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const headers = ["STATION_CODE", "FLIGHT", "DELAY", "DOC", "DAM", "LOST", "IRSAFE", "NIRSAFE", "SAFE", "OTP", "OTA", "COMP", "PASS"];
const monthNames = { "01": "Ocak", "02": "Şubat", "03": "Mart", "04": "Nisan", "05": "Mayıs", "06": "Haziran", "07": "Temmuz", "08": "Ağustos", "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık" };

for (const period of MOCK_PERIODS) {
  const [year, month] = period.split("-");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add(`${monthNames[month]} ${year}`);
  sheet.showGridLines = false;
  sheet.mergeCells("A1:M1");
  sheet.mergeCells("A2:M2");
  sheet.getRange("A1").values = [[`AJET TGS İSTASYON PERFORMANSI · ${monthNames[month].toLocaleUpperCase("tr-TR")} ${year} · TEST VERİSİ`]];
  sheet.getRange("A2").values = [["12 aylık regression fixture · Gerçek operasyonel veri değildir"]];
  sheet.getRange("A4:M4").values = [headers];
  const periodRows = MOCK_ROWS.filter((row) => row.period === period);
  sheet.getRange("A5:M11").values = periodRows.map((row) => headers.map((header) => row[header]));

  sheet.getRange("A1:M1").format = { fill: "#002554", font: { bold: true, color: "#FFFFFF", size: 14 }, rowHeight: 30, verticalAlignment: "center" };
  sheet.getRange("A2:M2").format = { fill: "#EAF5FB", font: { color: "#456273", italic: true, size: 9 }, rowHeight: 22, verticalAlignment: "center" };
  sheet.getRange("A4:M4").format = { fill: "#008FDA", font: { bold: true, color: "#FFFFFF", size: 9 }, rowHeight: 24, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: "#0078B7" } };
  sheet.getRange("A5:M11").format = { font: { color: "#162A3A", size: 9 }, rowHeight: 22, borders: { insideHorizontal: { style: "thin", color: "#D8E2EA" } }, verticalAlignment: "center" };
  sheet.getRange("B5:C11").format.numberFormat = "#,##0";
  sheet.getRange("D5:H11").format.numberFormat = "0.00%";
  sheet.getRange("I5:I11").format.numberFormat = "#,##0";
  sheet.getRange("J5:K11").format.numberFormat = "0.0%";
  sheet.getRange("L5:L11").format.numberFormat = "0.00";
  sheet.getRange("M5:M11").format.numberFormat = "#,##0";
  sheet.getRange("A5:A11").format = { font: { bold: true, color: "#002554" }, horizontalAlignment: "center" };
  sheet.getRange("A1:A11").format.columnWidth = 17;
  for (const column of ["B", "C", "I", "M"]) sheet.getRange(`${column}1:${column}11`).format.columnWidth = 13;
  for (const column of ["D", "E", "F", "G", "H", "J", "K", "L"]) sheet.getRange(`${column}1:${column}11`).format.columnWidth = 12;
  sheet.freezePanes.freezeRows(4);

  const inspection = await workbook.inspect({ kind: "table", range: `${sheet.name}!A1:M11`, include: "values,formulas", tableMaxRows: 12, tableMaxCols: 13 });
  if (!inspection.ndjson.includes("STATION_CODE")) throw new Error(`${period}: header inspection failed`);
  const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: `${period} formula error scan` });
  if (/"matchCount":\s*[1-9]/.test(errors.ndjson)) throw new Error(`${period}: formula error detected`);
  const preview = await workbook.render({ sheetName: sheet.name, range: "A1:M11", scale: 1.25, format: "png" });
  await fs.writeFile(path.join(previewDir, `${period}.png`), new Uint8Array(await preview.arrayBuffer()));
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(path.join(outputDir, mockFileName(period)));
}

console.log(JSON.stringify({ months: MOCK_PERIODS.length, records: MOCK_ROWS.length, outputDir, previewDir }));
