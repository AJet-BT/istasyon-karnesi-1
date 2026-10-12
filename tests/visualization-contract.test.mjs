import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PerformanceReport, { PDF_OPTIONS } from "../app/performance-report.tsx";
import { aggregateMetric, captureReportSnapshot, MAIN_METRICS } from "../lib/performance-metrics.ts";
import { MISSING_VALUE_LABEL } from "../lib/corporate-language.ts";
import { formatMetricValue, metricCatalog, metricDeltaStatus, selectChartVariant } from "../lib/visualization-engine.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../app/visualization-engine.tsx", import.meta.url), "utf8");
const catalog = await readFile(new URL("../lib/visualization-engine.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8") + await readFile(new URL("../app/dashboard-compact.css", import.meta.url), "utf8");
const report = await readFile(new URL("../app/performance-report.tsx", import.meta.url), "utf8");
const row = (overrides = {}) => ({ stationCode: "SAW", provider: "TGS", period: "2026-06", sourceFile: "source.xlsx", title: "Haziran Raporu", flights: 100, passengers: 200, otp: 90, ota: 85, ...overrides });
const snapshot = (scope = "summary", comparisonPeriod = "none") => captureReportSnapshot({ scope, generatedAt: 1780272000000, records: [row()], comparison: [row({ period: "2026-05", title: "Mayıs Raporu", otp: 85 })], history: [row({ period: "2026-05", otp: 85 }), row()], issues: [], filters: { period: "2026-06", comparisonPeriod, stations: [] } });
const renderReport = (value) => renderToStaticMarkup(React.createElement(PerformanceReport, { snapshot: value }));

test("N — visualization decisions are centralized in a metric catalog", () => {
  for (const key of [...MAIN_METRICS, "delayPer100", "nonSafety", "quality"]) {
    assert.equal(metricCatalog[key].key, key);
    for (const property of ["unit", "storageUnit", "sourceScale", "displayUnit", "displayMultiplier", "precision", "direction", "color", "comparisonColor"]) assert.ok(Object.hasOwn(metricCatalog[key], property), `${key}.${property}`);
  }
  assert.match(catalog, /export function selectChartVariant/);
  assert.match(engine, /selectChartVariant\(context\)/);
});

test("O — station and period counts select bounded chart variants", () => {
  const context = (stationCount, periodCount = 1) => ({ metric: "otp", stationCount, periodCount, hasPreviousPeriod: true });
  for (const [count, variant] of [[0, "empty"], [1, "single"], [2, "compact-comparison"], [8, "ranked-bar"], [20, "scrollable-ranking"], [21, "top-bottom"]]) assert.equal(selectChartVariant(context(count)), variant);
  assert.equal(selectChartVariant(context(1, 2)), "slope");
  assert.equal(selectChartVariant(context(7, 3)), "line");
});

test("P — all core analysis screens use the reusable visualization engine", () => {
  assert.ok((page.match(/<VisualizationEngine/g) ?? []).length >= 10);
  for (const title of ["OTP ve OTA İstasyon Karşılaştırması", "BAGAJ RİSK MATRİSİ", "Uçuş Hacmi ve Normalize Tehir", "Doküman Hata Oranı", "Şikâyet Dönüş Süresi"]) assert.match(page, new RegExp(title));
  assert.match(page, /İstasyon × KPI Matrisi/);
  assert.match(page, /İstasyon × Kaynak Alanı Kapsamı/);
});

test("Q — missing values and Turkish formats are explicit and non-destructive", () => {
  assert.match(catalog, /return MISSING_VALUE_LABEL/);
  assert.match(catalog, /new Intl\.NumberFormat\("tr-TR"/);
  assert.match(catalog, /value \* definition\.displayMultiplier/);
  assert.match(catalog, /sourceScale === "ratio" \? 100 : 1/);
  assert.match(engine, /Karşılaştırılabilir dönem bulunamadı/);
  assert.equal(formatMetricValue("unreadDocuments", null), MISSING_VALUE_LABEL);
  assert.equal(formatMetricValue("unreadDocuments", 0), "0");
  assert.equal(formatMetricValue("passengers", 1234), "1.234");
  assert.match(renderReport(snapshot()), /Raporlanan sıfırlar korunur/);
  assert.doesNotMatch(page, /sum\(records, "damagedCount"\) \/ passengers \* 100/);
});

test("R — tooltips expose source, target, delta, numerator and denominator", () => {
  for (const label of ["Karşılaştırma", "Değişim", "Hedef", "Pay", "Payda", "Kaynak"]) assert.match(engine, new RegExp(label));
  assert.doesNotMatch(engine, /TEST VERİSİ/);
  assert.match(page, /heatmap-hover-tooltip/);
  assert.match(css, /\.heatmap-cell\.warning/);
  assert.match(css, /\.heatmap-cell\.critical/);
});

test("S — PDF mode is a static multi-page report and not a dashboard screenshot", () => {
  const html = renderReport(snapshot("full", "2026-05"));
  assert.ok((html.match(/class="print-page report-page/g) ?? []).length > 1);
  assert.match(html, /Veri Kalitesi ve Kapsam/);
  assert.doesNotMatch(html, /Kaynaklar ve İzlenebilirlik|source.xlsx/);
  assert.match(html, /data-report-section="cover"/);
  assert.match(html, /data-report-scope="full"/);
  assert.match(page, /type ReportSnapshot/);
  assert.match(html, /data-snapshot-at=/);
  assert.doesNotMatch(page + report, /html2canvas|dom-to-image|screenshot/i);
  assert.match(css, /@page \{ size: A4 landscape/);
  assert.match(css, /\.print-page \{[^}]*break-after: page/);
  assert.match(css, /\.report-table thead[^}]*display:\s*table-header-group/);
  assert.match(css, /animation: none !important/);
});

test("T — visualization layouts remain responsive and width bounded", () => {
  assert.match(css, /\.engine-chart \{ width: 100%; min-width: 0; max-width: 100%/);
  assert.match(css, /\.heatmap-scroll \{[^}]*overflow-x: auto/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.chart-triad \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.engine-standard, \.engine-large/);
  assert.match(engine, /isAnimationActive=\{!exportMode\}/);
});

test("U — shared semantic layer prevents double percent conversion", () => {
  assert.match(catalog, /damaged:[^\n]+sourceScale: "ratio"[^\n]+displayMultiplier: 100/);
  assert.match(catalog, /otp:[^\n]+sourceScale: "percentage-points"[^\n]+displayMultiplier: 1/);
  const rows = [row({ passengers: 100, damagedCount: 2, damagedRate: 0.02, docCount: 2, internationalPassengers: 100, docRatePct: 2 }), row({ stationCode: "ESB", passengers: 900, damagedCount: null, damagedRate: null, docCount: null, internationalPassengers: 900, docRatePct: null })];
  assert.equal(aggregateMetric(rows, "damaged"), 0.02);
  assert.equal(aggregateMetric(rows, "documents"), 2);
  assert.equal(formatMetricValue("damaged", aggregateMetric(rows, "damaged")), "%2,00");
  assert.equal(formatMetricValue("documents", aggregateMetric(rows, "documents")), "%2,000");
  assert.equal(metricDeltaStatus("safetyReports", 8, 2), "neutral");
});

test("V — reporting uses immutable scope snapshots and exactly Hızlı PDF and Master PDF", () => {
  assert.deepEqual(PDF_OPTIONS, [{ scope: "summary", label: "Hızlı PDF" }, { scope: "full", label: "Master PDF" }]);
  assert.match(page, /setReportSnapshot\(snapshot\)/);
  const input = snapshot();
  assert.ok(Object.isFrozen(input.records[0]));
  assert.throws(() => { input.records[0].passengers = 1; }, TypeError);
  assert.equal(input.comparison.length, 0);
  assert.match(renderReport(input), /Hızlı PDF/);
  assert.match(renderReport({ ...input, scope: "full" }), /Master PDF/);
});

test("W — loading and cross-filter interactions never show stale charts", () => {
  assert.match(page, /loading \? <DashboardSkeleton \/> : <>/);
  assert.match(page, /applyAirportSelection\(\[record\.stationCode\]\)/);
  assert.match(css, /\.dashboard-skeleton/);
});

test("X — overview trend and comparison visuals follow period-count rules", () => {
  assert.match(page, /Dönemsel eğilim için yeterli tarihsel dönem bulunamadı/);
  assert.match(page, /requestedVariant="line"/);
  assert.match(page, /value="none">Karşılaştırma yok/);
  assert.match(page, /compatibleHistory\.length >= 2/);
  assert.match(page, /\(\[3, 6, 12\] as const\)/);
  assert.match(engine, /function FinancialLine/);
  assert.match(engine, /financial-crosshair/);
  assert.match(engine, /metricDeltaStatus/);
  assert.match(engine, /function Slope/);
  assert.match(engine, /Hedef %\{primary\.target \?\? 90\} · düşük OTP üstte/);
  assert.match(engine, /OTP|primary\.shortLabel/);
  assert.match(page, /function PeriodComparisonChart/);
  assert.match(page, /periodComparisonMetrics/);
  assert.match(page, /period-direct-comparison/);
  assert.match(page, /period-comparison-tooltip/);
});

test("Y — Master PDF uses validated metric deltas, complete station charts and both source titles", () => {
  const html = renderReport(snapshot("full", "2026-05"));
  assert.match(html, /Haziran Raporu/);
  assert.match(html, /Mayıs Raporu/);
  assert.match(html, /\+5 puan/);
  assert.match(html, /İstasyon Karşılaştırması/);
  assert.match(html, /Tarihsel Eğilim/);
  assert.match(html, /Metrik kapsamı|Kaynakta Raporlanmamış/);
  assert.doesNotMatch(html, /risk puanı|Başarıyla kaydedildi/);
  assert.doesNotMatch(renderReport(snapshot("full")), /data-comparison="true"|Mayıs Raporu/);
});

test("Z — KPI micro trends expose bounded month context and prominent comparison deltas", () => {
  assert.match(page, /function sparklineLabelIndices/);
  assert.match(page, /length >= 9 \? 5/);
  assert.match(page, /formatSparklinePeriod/);
  assert.match(page, /periods = historicalPeriodsThrough\(scopedHistory, currentPeriod, 12\)/);
  assert.match(page, /className="metric-sparkline-axis"/);
  assert.match(page, /className=\{index === periods\.length - 1 \? "selected"/);
  assert.match(page, /<small>Değişim<\/small>/);
  assert.match(page, /aria-label=\{`Değişim \$\{comparison\.delta\}`\}/);
  assert.match(css, /\.metric-comparison-delta strong \{[^}]*font-size: 11px/);
  assert.match(css, /\.metric-sparkline \{[^}]*overflow: hidden/);
  assert.match(css, /\.metric-sparkline-axis \{[^}]*justify-content: space-between/);
});
