import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import XLSX from "xlsx";
import DatasetUpload from "../app/dataset-upload.tsx";
import PerformanceReport, { PDF_OPTIONS } from "../app/performance-report.tsx";
import { aggregateMetric, compareMetricScopes, captureReportSnapshot, MAIN_METRICS } from "../lib/performance-metrics.ts";
import { KPI_LABELS } from "../lib/corporate-language.ts";
import { detectWorkbook, parseWorkbook } from "../lib/workbook-import.ts";
import { formatMetricValue, metricDeltaStatus } from "../lib/visualization-engine.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const platform = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/platform/route.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../app/admin-panel.tsx", import.meta.url), "utf8");
const upload = await readFile(new URL("../app/dataset-upload.tsx", import.meta.url), "utf8");
const row = (overrides = {}) => ({ stationCode: "SAW", provider: "TGS", period: "2026-06", sourceFile: "source.xlsx", flights: 100, passengers: 200, otp: 90, ota: 85, title: "Haziran Raporu", ...overrides });

test("A — navigation is grouped without rebuilding the existing information architecture", () => {
  for (const label of ["ANALİZ", "VERİ", "SİSTEM"]) assert.match(page, new RegExp(label));
  assert.match(page, /nav-section-label/);
});

test("B — global filters keep four primary controls and five advanced controls", () => {
  assert.match(page, /primary-filters/);
  assert.match(page, /Gelişmiş filtreler/);
  for (const label of ["Bölge", "Ülke", "Şehir", "Kaynak dosya", "Veri durumu"]) assert.match(page, new RegExp(label));
  assert.match(page, /\["admin", "upload"\]/);
  assert.match(route, /dataStatus/);
});

test("C — normal import requires a file and title, with mapping available as an exception", () => {
  const html = renderToStaticMarkup(React.createElement(DatasetUpload, { uploads: [], onChanged() {}, onOverview() {}, setToast() {} }));
  assert.match(html, /type="file"/);
  assert.match(html, /Rapor \/ Veri Kümesi Başlığı/);
  assert.match(html, /<input[^>]*required/);
  assert.match(html, /Veriyi İçe Aktar/);
  assert.match(html, /Excel Şablonunu İndir/);
  assert.doesNotMatch(html, /Metadata|Tamamlandı|<select/);
  assert.match(upload, /<details[^>]*import-exceptions/);
  assert.match(upload, /AJet_İstasyon_Performans_Şablonu\.xlsx/);
  assert.match(upload, /'İstasyon Performansı'/);
  assert.match(upload, /'Açıklama'/);
});

test("D — file lifecycle actions are real backend operations", () => {
  for (const action of ["Dosya ve Eşleştirme", "Kayıtlı sütun eşleştirmesi", "Yeni Sürüm", "Yeniden İşle", "Dosyayı Sil", "Geri Yükle"]) assert.match(upload, new RegExp(action));
  assert.match(platform, /export async function reprocessUpload/);
  assert.match(route, /payload\.action === "reprocess"/);
});

test("E — workspace and owner scope constrain uploads, exports and destructive actions", () => {
  assert.match(platform, /eq\(exportJobs\.workspaceId, actor\.workspaceId\)/);
  assert.match(platform, /actor\.isAdmin \? undefined : eq\(exportJobs\.userId, actor\.id\)/);
  assert.match(platform, /upload\.ownerUserId !== actor\.id && !actor\.isAdmin/);
});

test("F — percentage values use one canonical ratio path", () => {
  const workbook = { SheetNames: ["Veri"], Sheets: { Veri: XLSX.utils.aoa_to_sheet([["TGS Haziran 2026"], ["STATION_CODE", "FLIGHT", "DAM", "Yolcu Sayısı", "Dijital Biniş Kartı Kullanım Oranı"], ["SAW", 10, "2%", 100, { v: 0.85, t: "n", z: "0%" }]]) } };
  const parsed = parseWorkbook(workbook, detectWorkbook(workbook, "rapor.xlsx").selection);
  assert.equal(parsed.errorCount, 0);
  assert.equal(parsed.rows[0].damagedRatio, 0.02);
  assert.equal(parsed.rows[0].digitalBoardingRatio, 0.85);
  assert.equal(formatMetricValue("damaged", parsed.rows[0].damagedRatio), "%2,00");
  assert.equal(formatMetricValue("digitalBoarding", parsed.rows[0].digitalBoardingRatio), "%85,0");
  assert.match(page, /function formatPercentRatio/);
  assert.doesNotMatch(page, /formatPercentRatio\([^)]*\*\s*100/);
});

test("G — overview KPI comparisons are scope-validated, prominent and direction-aware", () => {
  assert.match(page, /function validateComparisonScope/);
  for (const overrides of [{ provider: "Havaş" }, { isTestData: true }, { stationCode: "ESB" }, { otp: null }]) assert.equal(compareMetricScopes([row()], [row(overrides)], "otp").comparable, false);
  assert.equal(compareMetricScopes([row()], [row()], "otp").comparable, true);
  assert.equal(metricDeltaStatus("otp", 95, 90), "improved");
  assert.equal(metricDeltaStatus("damaged", 0.02, 0.01), "worsened");
  assert.match(page, /metric-comparison-values/);
  assert.match(page, /MetricComparisonSlope/);
  assert.match(page, /metric-comparison-delta/);
  assert.match(page, /metric-scope-warning/);
  assert.match(css, /\.metric-comparison-values/);
  assert.match(css, /\.metric-mini-slope/);
  assert.match(css, /\.metric-scope-warning/);
  assert.doesNotMatch(page, /<MiniSparkline/);
});

test("G2 — overview removes decorative coverage and opaque risk scores", () => {
  assert.doesNotMatch(page, /className="coverage-ring"/);
  assert.doesNotMatch(page, /riskScore|\/100<\/b>/);
  assert.match(page, /function buildStationInsights/);
  assert.match(page, /Birleşik veya açıklanamayan risk puanı kullanılmaz/);
  assert.doesNotMatch(page, /Kayıp Bagaj Oranı — İlk 5 İstasyon/);
});

test("G3 — management overview uses every canonical KPI once with adjacent related metrics and a selectable overview trend defaulting to OTP/OTA", () => {
  assert.doesNotMatch(page, /Operasyonun tek, doğrulanmış görünümü/);
  assert.match(page, /executive-kpis/);
  for (const key of MAIN_METRICS) assert.ok(KPI_LABELS[key], `Missing canonical label for ${key}`);
  assert.equal(MAIN_METRICS.filter((key) => key === "passengers").length, 1);
  assert.equal(KPI_LABELS.passengers, "Yolcu Sayısı");
  for (const [first, second] of [["otp", "ota"], ["damaged", "lost"], ["safety", "safetyReports"]]) assert.equal(MAIN_METRICS.indexOf(second), MAIN_METRICS.indexOf(first) + 1);
  assert.match(page, /MAIN_METRICS\.map\(metric/);
  assert.match(page, /function OtpOtaDualTrend/);
  assert.match(page, /overview-trend-selector/);
  assert.match(page, /dual-crosshair/);
  assert.match(page, /dual-period-guide comparison/);
  assert.match(page, /dual-period-guide current/);
  assert.match(page, /function KpiDetailDrawer/);
  assert.match(css, /\.executive-kpis \.metric-card \{ height: 150px; min-height: 150px/);
  assert.match(css, /\.dual-line\.otp \{ stroke: var\(--blue\)/);
  assert.match(css, /\.dual-line\.ota \{ stroke: var\(--navy\)/);
});

test("G4 — Hızlı PDF contains all active KPI values and Master PDF adds actual charts and presentation covers", () => {
  assert.deepEqual(PDF_OPTIONS.map(({ label }) => label), ["Hızlı PDF", "Master PDF"]);
  const records = [row({ unreadDocuments: 0, safetyReports: 3 })];
  const snapshot = captureReportSnapshot({ scope: "summary", records, comparison: [], history: records, issues: [], filters: { period: "2026-06", comparisonPeriod: "none", stations: [] } });
  const quick = renderToStaticMarkup(React.createElement(PerformanceReport, { snapshot }));
  const master = renderToStaticMarkup(React.createElement(PerformanceReport, { snapshot: { ...snapshot, scope: "full" } }));
  for (const key of MAIN_METRICS) assert.ok(quick.includes(`data-report-metric="${key}"`), key);
  assert.match(quick, /0 adet/);
  assert.match(quick, /Haziran Raporu/);
  assert.doesNotMatch(quick, /data-comparison="true"/);
  assert.match(master, /<svg/);
  assert.doesNotMatch(master, /Kaynaklar ve İzlenebilirlik|source.xlsx/);
  assert.match(master, /data-report-section="cover"/);
  assert.match(master, /data-report-station="SAW\|TGS"/);
  assert.match(master, /Veri Kalitesi ve Kapsam/);
  assert.equal(aggregateMetric(records, "safetyReports"), 3);
});

test("G5 — selected period is the canonical end date and comparison is optional secondary context", () => {
  assert.match(page, /function historicalPeriodsThrough/);
  assert.match(page, /period <= selectedPeriod/);
  assert.ok((page.match(/historicalPeriodsThrough\(/g) ?? []).length >= 5);
  assert.match(page, /comparisonEnabled && <PeriodComparisonChart/);
  assert.match(page, /availablePairs\.length === 1/);
  assert.match(page, /period-series comparison/);
  assert.match(page, /period-series current/);
});

test("G6 — baggage labels are canonical across frontend and PDF", () => {
  assert.doesNotMatch(page, /Hasarlı %/);
  assert.doesNotMatch(page, /Kayıp %/);
  assert.match(page, /Hasarlı Bagaj %/);
  assert.match(page, /Kayıp Bagaj %/);
});

test("H — metric-selectable trend supports the ten required operational metrics", () => {
  for (const key of ["flights", "passengers", "otp", "ota", "delay", "delayPer100", "damaged", "lost", "documents", "safety", "nonSafety", "complaint"]) assert.match(page, new RegExp(`${key}: \\{ label:`));
  assert.match(page, /trend-toolbar/);
  assert.match(page, /history=\{history\}/);
});

test("I — detail pages include page-specific trends and baggage scatter", () => {
  for (const title of ["Tehir Dönemsel Eğilimi", "Bagaj Oranları Dönemsel Eğilimi", "Doküman Hata Oranı Dönemsel Eğilimi", "Safety \/ Safety Dışı Dönemsel Eğilimi", "Dönem Değişimi ve Hedef Mesafesi"]) assert.match(page, new RegExp(title));
  assert.match(page, /BAGAJ RİSK MATRİSİ/);
  assert.match(page, /metric="damaged" secondaryMetric="lost"/);
});

test("J — quality score is expandable and explains components and lineage", () => {
  assert.match(page, /Kırılımı görüntüle/);
  for (const label of ["Tamlık", "Geçerlilik", "Benzersizlik", "Tutarlılık", "VERİ KAYNAĞI VE HESAPLAMA"]) assert.match(page, new RegExp(label));
});

test("K — report center records rich user-scoped history and supports deletion", () => {
  for (const label of ["Kullanıcı", "Filtre Özeti", "Durum", "Boyut", "İşlemler"]) assert.match(page, new RegExp(label));
  assert.match(platform, /export async function deleteExportJob/);
  assert.match(route, /delete_export/);
});

test("L — admin panel includes data scopes while preserving airport master management", () => {
  assert.match(admin, /\["scopes", "Veri Kapsamları"\]/);
  assert.match(admin, /\["airports", "Havalimanı Master Verisi"\]/);
  assert.match(admin, /Sistem sorgularında çalışma alanı zorunlu/);
});

test("M — global filter summary is bounded, responsive and independently actionable", () => {
  assert.match(page, /function ActiveFilterSummary/);
  assert.match(page, /selectedAirports\.slice\(0, 3\)/);
  assert.match(page, /selectedAirports\.slice\(0, 2\)/);
  assert.match(page, /havalimanı seçili/);
  assert.match(page, /active-filter-popover/);
  assert.match(page, /Filtreleri Temizle/);
  assert.match(page, /!selectedAirports\.length/);
  assert.match(css, /\.app-shell \{ width: 100%; max-width: 100%; min-width: 0;/);
  assert.match(css, /\.app-shell \{[^}]*overflow-x: clip/);
  assert.doesNotMatch(css, /\.app-shell \{[^}]*overflow-x: hidden/);
  assert.match(css, /\.main-area \{ width: calc\(100% - 260px\); max-width: calc\(100% - 260px\); min-width: 0;/);
  assert.match(css, /\.filterbar \{[^}]*position: sticky;[^}]*width: 100%;[^}]*min-width: 0/);
  assert.match(css, /\.filter-summary-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.active-filter-summary \{[^}]*overflow: hidden/);
  assert.match(css, /@media \(max-width: 1599px\) and \(min-width: 1200px\)/);
  assert.match(css, /@media \(max-width: 1199px\)/);
  assert.match(css, /\.filter-actions \{[^}]*flex: 0 0 auto/);
});
