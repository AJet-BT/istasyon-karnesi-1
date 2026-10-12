import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import XLSX from "xlsx";
import { MOCK_PERIODS, MOCK_STATIONS, mockFileName } from "../scripts/mock-data-fixture.mjs";

const headers = ["STATION_CODE", "FLIGHT", "DELAY", "DOC", "DAM", "LOST", "IRSAFE", "NIRSAFE", "SAFE", "OTP", "OTA", "COMP", "PASS"];
const allRows = [];

test("12 monthly mock workbooks keep the canonical upload contract", async () => {
  for (const period of MOCK_PERIODS) {
    const fileName = mockFileName(period);
    const workbook = XLSX.read(await readFile(new URL(`../public/mock-data/${fileName}`, import.meta.url)), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: null });
    assert.match(String(rows[0][0]), /TEST VERİSİ/);
    assert.deepEqual(rows[3], headers);
    assert.equal(rows.length, 11, `${period} should contain seven station records`);
    const dataRows = rows.slice(4).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    assert.deepEqual(dataRows.map((row) => row.STATION_CODE), MOCK_STATIONS.map((station) => station.code));
    for (const row of dataRows) {
      for (const header of headers) assert.notEqual(row[header], null, `${period} ${row.STATION_CODE} ${header} must be complete`);
      assert.ok(row.FLIGHT >= 0 && row.DELAY >= 0 && row.PASS >= 0 && row.SAFE >= 0);
      assert.ok(row.OTP >= 0 && row.OTP <= 1 && row.OTA >= 0 && row.OTA <= 1);
      for (const key of ["DOC", "DAM", "LOST", "IRSAFE", "NIRSAFE"]) assert.ok(row[key] >= 0 && row[key] <= 1, `${key} canonical ratio`);
      assert.ok(row.COMP >= 0);
      allRows.push({ period, ...row });
    }
  }
  assert.equal(allRows.length, 84);
});

test("period order, percent scale and designed seasonality remain intact", () => {
  assert.deepEqual([...MOCK_PERIODS].sort(), MOCK_PERIODS);
  const juneSaw = allRows.find((row) => row.period === "2026-06" && row.STATION_CODE === "SAW");
  assert.ok(juneSaw);
  assert.ok(juneSaw.DAM < 0.01 && juneSaw.LOST < 0.01, "DAM/LOST stay canonical and are not multiplied twice");
  for (const code of ["AYT", "BJV", "DLM"]) {
    const summer = allRows.filter((row) => row.STATION_CODE === code && ["2025-07", "2025-08"].includes(row.period)).reduce((sum, row) => sum + row.FLIGHT, 0) / 2;
    const winter = allRows.filter((row) => row.STATION_CODE === code && ["2025-12", "2026-01", "2026-02"].includes(row.period)).reduce((sum, row) => sum + row.FLIGHT, 0) / 3;
    assert.ok(summer > winter * 2, `${code} summer traffic should materially exceed winter`);
  }
});
