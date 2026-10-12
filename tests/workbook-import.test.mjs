import assert from "node:assert/strict";
import test from "node:test";
import { detectWorkbook, parseWorkbook } from "../lib/workbook-import.ts";

function sheet(rows) {
  const result = { "!ref": `A1:${String.fromCharCode(64 + Math.max(...rows.map((row) => row.length)))}${rows.length}` };
  rows.forEach((row, r) => row.forEach((value, c) => {
    result[`${String.fromCharCode(65 + c)}${r + 1}`] = typeof value === "object" && value !== null ? value : { v: value };
  }));
  return result;
}

const titles = ["ISTASYON", "FLIGHT", "Extgoms–Okunmayan Doküman Sayısı", "Yolcu Sayısı", "Vize Pasaport Doküman Aksaklıkları", "Emniyet Raporlaması", "Hasar Raporlama GSE", "Dijital Biniş Kartı Kullanım Oranı"];
function workbook(rows = [["TGS Haziran 2026"], [], [], titles, ["SAW", 10, 0, 100, 2, 3, 1, 0.75]]) {
  return { SheetNames: ["Açıklama", "Veri"], Sheets: { Açıklama: sheet([["Rapor açıklaması"]]), Veri: sheet(rows) } };
}

test("detects the data sheet and actual header row across a workbook", () => {
  const result = detectWorkbook(workbook(), "rapor.xlsx");
  assert.equal(result.needsReview, false);
  assert.equal(result.selection?.sheetName, "Veri");
  assert.equal(result.selection?.headerRow, 4);
  assert.equal(result.selection?.provider, "TGS");
  assert.equal(result.selection?.period, "2026-06");
  assert.equal(result.selection?.mappings.unreadDocuments, 2);
  assert.equal(result.selection?.mappings.digitalBoardingRatio, 7);
});

test("zero is preserved and optional missing measurements stay null", () => {
  const input = workbook([["TGS Haziran 2026"], titles, ["SAW", 10, 0, "", "", 0, "-", 0]]);
  const result = parseWorkbook(input, detectWorkbook(input, "rapor.xlsx").selection);
  assert.equal(result.errorCount, 0);
  assert.equal(result.rows[0].unreadDocuments, 0);
  assert.equal(result.rows[0].passengers, null);
  assert.equal(result.rows[0].visaPassportIssues, null);
  assert.equal(result.rows[0].safetyReports, 0);
  assert.equal(result.rows[0].gseDamageReports, null);
  assert.equal(result.rows[0].digitalBoardingRatio, 0);
});

test("missing and ambiguous period/provider require review without assumed values", () => {
  const missing = detectWorkbook(workbook([titles, ["SAW", 10, 1, 100]]), "rapor.xlsx");
  assert.equal(missing.selection?.provider, null);
  assert.equal(missing.selection?.period, null);
  assert.equal(missing.needsReview, true);
  const ambiguous = detectWorkbook(workbook([["TGS Havaş Haziran 2026 Temmuz 2026"], titles, ["SAW", 10]]), "rapor.xlsx");
  assert.equal(ambiguous.selection?.provider, null);
  assert.equal(ambiguous.selection?.period, null);
  assert.equal(ambiguous.needsReview, true);
});

test("equal sheet candidates require explicit selection and retain column positions", () => {
  const input = workbook();
  input.SheetNames.push("İkinci veri");
  input.Sheets["İkinci veri"] = sheet([["Çelebi Mayıs 2026"], titles, ["ADB", 20, 7, 200, 1, 4, 0, "50%"]]);
  assert.equal(detectWorkbook(input, "rapor.xlsx").selection, null);
  const selected = detectWorkbook(input, "rapor.xlsx", { sheetName: "İkinci veri", headerRow: 2 });
  assert.equal(selected.selection?.provider, "Çelebi");
  assert.equal(parseWorkbook(input, selected.selection).rows[0].digitalBoardingRatio, 0.5);
});

test("duplicate aliases cannot silently overwrite the selected measurement", () => {
  const input = workbook([["TGS Haziran 2026"], ["ISTASYON", "FLIGHT", "PASS", "Yolcu Sayısı"], ["SAW", 10, 100, 200]]);
  const detected = detectWorkbook(input, "rapor.xlsx");
  assert.equal(detected.needsReview, true);
  assert.equal(detected.selection?.mappings.passengers, undefined);
  const explicit = detectWorkbook(input, "rapor.xlsx", { mappings: { stationCode: 0, flights: 1, passengers: 3 } });
  assert.equal(explicit.needsReview, false);
  assert.equal(parseWorkbook(input, explicit.selection).rows[0].passengers, 200);
  assert.deepEqual(parseWorkbook(input, JSON.parse(JSON.stringify(explicit.selection))), parseWorkbook(input, explicit.selection));
});

test("count fields reject negatives fractions invalid text and unsafe integers", () => {
  for (const invalid of [-1, 1.5, "unknown", "10%", "10 min", Number.MAX_SAFE_INTEGER + 1]) {
    const input = workbook([["TGS Haziran 2026"], titles, ["SAW", 10, invalid, 100, 0, 0, 0, 0.5]]);
    const result = parseWorkbook(input, detectWorkbook(input, "rapor.xlsx").selection);
    assert.ok(result.issues.some((issue) => issue.level === "error" && issue.field === "unreadDocuments"), String(invalid));
  }
});

test("digital boarding ratio respects percentage text and Excel format but rejects raw 85", () => {
  for (const [value, expected] of [["85%", 0.85], ["85,5%", 0.855], [{ v: 0.85, z: "0.0%", w: "85.0%" }, 0.85], [1, 1]]) {
    const input = workbook([["TGS Haziran 2026"], titles, ["SAW", 10, 0, 100, 0, 0, 0, value]]);
    const result = parseWorkbook(input, detectWorkbook(input, "rapor.xlsx").selection);
    assert.equal(result.errorCount, 0);
    assert.equal(result.rows[0].digitalBoardingRatio, expected);
  }
  for (const invalid of [85, -0.1, "101%", "bad", { v: 1.1, z: "0%" }]) {
    const input = workbook([["TGS Haziran 2026"], titles, ["SAW", 10, 0, 100, 0, 0, 0, invalid]]);
    assert.ok(parseWorkbook(input, detectWorkbook(input, "rapor.xlsx").selection).errorCount > 0);
  }
});

test("duplicate station records and invalid source selections fail validation", () => {
  const input = workbook([["TGS Haziran 2026"], titles, ["SAW", 10], ["SAW", 20]]);
  const selection = detectWorkbook(input, "rapor.xlsx").selection;
  assert.ok(parseWorkbook(input, selection).issues.some((issue) => issue.code === "duplicate_station"));
  assert.ok(parseWorkbook(input, { ...selection, mappings: { stationCode: 0, flights: 50 } }).errorCount > 0);
  assert.ok(parseWorkbook(input, { ...selection, sheetName: "Missing" }).errorCount > 0);
});

test("numeric source cells use raw integers despite formatted thousands separators", () => {
  const input = workbook([["TGS Haziran 2026"], titles, ["SAW", { v: 2418, w: "2,418", z: "#,##0" }, 0, { v: 10000, w: "10.000", z: "#,##0" }, 0, 0, 0, 0.5]]);
  const result = parseWorkbook(input, detectWorkbook(input, "rapor.xlsx").selection);
  assert.equal(result.rows[0].flights, 2418);
  assert.equal(result.rows[0].passengers, 10000);
});

test("unambiguous month and year in separate metadata rows still determine the report period", () => {
  const result = detectWorkbook(workbook([["TGS"], ["Haziran"], [2026], titles, ["SAW", 10]]), "rapor.xlsx");
  assert.equal(result.selection?.period, "2026-06");
  assert.equal(result.needsReview, false);
});

test("cover-sheet metadata supplies missing context without overriding explicit data-sheet context", () => {
  const input = workbook([titles, ["SAW", 10]]);
  input.Sheets.Açıklama = sheet([["Handling Provider: TGS"], ["Haziran 2026"]]);
  assert.equal(detectWorkbook(input, "rapor.xlsx").selection?.provider, "TGS");
  assert.equal(detectWorkbook(input, "rapor.xlsx").selection?.period, "2026-06");
  input.Sheets.Veri = sheet([["Havaş Mayıs 2026"], titles, ["SAW", 10]]);
  assert.equal(detectWorkbook(input, "rapor.xlsx").selection?.provider, "Havaş");
  assert.equal(detectWorkbook(input, "rapor.xlsx").selection?.period, "2026-05");
});
