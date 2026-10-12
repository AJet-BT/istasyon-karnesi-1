import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PerformanceReport from "../app/performance-report.tsx";
import { KPI_LABELS } from "../lib/corporate-language.ts";
import { MAIN_METRICS } from "../lib/performance-metrics.ts";
import { formatMetricValue, formatPercentage, metricCatalog } from "../lib/visualization-engine.ts";

const files = {
  page: await readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  admin: await readFile(new URL("../app/admin-panel.tsx", import.meta.url), "utf8"),
  auth: await readFile(new URL("../app/auth-form.tsx", import.meta.url), "utf8"),
  port: await readFile(new URL("../app/port-master.tsx", import.meta.url), "utf8"),
  engine: await readFile(new URL("../app/visualization-engine.tsx", import.meta.url), "utf8"),
  language: await readFile(new URL("../lib/corporate-language.ts", import.meta.url), "utf8"),
  metricCatalog: await readFile(new URL("../lib/visualization-engine.ts", import.meta.url), "utf8"),
  platform: await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8"),
  report: await readFile(new URL("../app/performance-report.tsx", import.meta.url), "utf8"),
  upload: await readFile(new URL("../app/dataset-upload.tsx", import.meta.url), "utf8"),
};

const visibleUi = [files.page, files.admin, files.auth, files.port, files.engine, files.report, files.upload].join("\n");

test("Z1 — canonical corporate terminology is shared by UI, charts and reports", () => {
  for (const label of [
    "Genel Bakış", "Havalimanı", "İstasyon", "Karşılaştırma Dönemi", "Handling Provider",
    "Kaynak Dosya", "Veri Yükleme", "Veri Kalitesi", "Rapor Merkezi", "Çalışma Alanı",
    "Sütun Eşleştirme", "Kaynak Veri", "Dönemsel Eğilim",
  ]) assert.match(files.language, new RegExp(label));

  for (const label of [
    "Toplam Uçuş", "Yolcu Sayısı", "OTP", "OTA", "Toplam Tehir", "Hasarlı Bagaj %",
    "Kayıp Bagaj %", "Şikâyet Dönüş Süresi", "Safety %",
    "Extgoms–Okunmayan Doküman Sayısı", "Vize Pasaport Doküman Aksaklıkları", "Emniyet Raporlaması",
    "Hasar Raporlama GSE", "Dijital Biniş Kartı Kullanım Oranı",
  ]) assert.match(files.language, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Z2 — deprecated labels and broken Turkish encodings cannot re-enter production surfaces", () => {
  assert.doesNotMatch(visibleUi, /Hasarlı %/);
  assert.doesNotMatch(visibleUi, /Kayıp %/);
  assert.doesNotMatch(visibleUi, /Full Performance Report|Admin Paneli|Trend Chart|Comparison Chart|Performance Graph|Risk Graph|Metric Analysis|Non-Safety|Veri Soy Ağacı|KPI VERİ DETAYI/);
  assert.doesNotMatch(visibleUi, /Hizmet Sağlayıcı|Hizmet sağlayıcı|>Provider<|label: "Provider"|>Dashboard<|label: "Dashboard"|>Mapping<|title="Mapping"|<span>Delta<|>Complaint<|>Passenger<|>Flight</);
  assert.match(visibleUi, /Handling Provider/);
  assert.doesNotMatch(visibleUi, /Ã|Ä|Å|�/);
});

test("Z2b — period context and secondary safety terminology stay institutional", () => {
  assert.match(files.page, /Ana Dönem/);
  assert.match(files.page, /Karşılaştırma Dönemi/);
  assert.match(files.page, /Safety Dışı %/);
  assert.match(files.metricCatalog, /Safety Dışı Oran/);
  assert.match(files.page, /Veri Kaynağı ve Hesaplama/);
});

test("Z3 — missing data, process states and audit activity are user-facing", () => {
  assert.match(files.language, /MISSING_VALUE_LABEL = "Kaynakta Raporlanmamış"/);
  assert.match(files.language, /MISSING_VALUE_TOOLTIP = "Kaynak dosyada bu alan için veri raporlanmamış\."/);
  for (const helper of ["formatAuditAction", "formatAuditTarget", "formatAuditValue", "formatDataScope", "formatProcessStatus", "formatRoleLabel"]) {
    assert.match(files.language, new RegExp(`export function ${helper}`));
  }
  assert.match(files.admin, /formatAuditAction\(entry\.action\)/);
  assert.match(files.admin, /formatDataScope\(detail\.user\.dataScope\)/);
  assert.match(files.port, /formatAuditValue\(entry\.newValue\)/);
  assert.match(files.upload, /formatProcessStatus\(detail\.importStatus\)/);
});

test("Z4 — technical failures are replaced with operational messages", () => {
  assert.match(files.language, /TECHNICAL_ERROR_PATTERN/);
  for (const source of [files.page, files.admin, files.auth, files.port]) assert.match(source, /userFacingError\(/);
  assert.doesNotMatch(visibleUi, /Query failed: undefined filter_state|stack trace/i);
});

test("Z5 — frontend, Excel, CSV and PDF use the same KPI names", () => {
  assert.match(files.page, /"Handling Provider": record\.provider/);
  assert.match(files.page, /HASARLI_BAGAJ_YÜZDE/);
  assert.match(files.page, /KAYIP_BAGAJ_YÜZDE/);
  assert.match(files.page, /ŞİKÂYET_DÖNÜŞ_SÜRESİ_GÜN/);
  const html = renderToStaticMarkup(React.createElement(PerformanceReport, { snapshot: {
    scope: "summary", generatedAt: 1780272000000,
    records: [{ stationCode: "SAW", provider: "TGS", period: "2026-06", sourceFile: "source.xlsx", flights: 10, passengers: 100 }],
    comparison: [], history: [], issues: [], filters: { period: "2026-06", comparisonPeriod: "none", stations: [] },
  } }));
  for (const metric of MAIN_METRICS) assert.ok(html.includes(KPI_LABELS[metric]), metric);
  assert.equal(KPI_LABELS.passengers, "Yolcu Sayısı");
  assert.equal(metricCatalog.passengers.label, KPI_LABELS.passengers);
  assert.match(files.page, /"Yolcu Sayısı": record\.passengers/);
  for (const key of ["unreadDocuments", "visaPassportIssues", "safetyReports", "gseDamageReports", "digitalBoarding"]) assert.equal(metricCatalog[key].label, KPI_LABELS[key]);
});

test("Z6 — percent normalization and selected-period cutoff remain explicit", () => {
  assert.equal(formatMetricValue("digitalBoarding", 0.85), "%85,0");
  assert.equal(formatMetricValue("otp", 85), "%85,0");
  assert.equal(formatPercentage(0.85, 1, "ratio"), formatPercentage(85, 1, "percentage-points"));
  assert.match(files.platform, /otp: row\.otpRatio === null \? null : row\.otpRatio \* 100/);
  assert.match(files.metricCatalog, /sourceScale === "ratio" \? 100 : 1/);
  assert.match(files.page, /period <= selectedPeriod/);
  assert.match(files.page, /\.slice\(-limit\)/);
});
