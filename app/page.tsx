"use client";
/* eslint-disable @next/next/no-img-element */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  Download,
  FileOutput,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  LayoutDashboard,
  Luggage,
  Menu,
  MessageSquareText,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Table2,
  Target,
  TimerReset,
  UploadCloud,
  UserRound,
  UserCog,
  X,
} from "lucide-react";
import AdminPanel from "@/app/admin-panel";
import DatasetUpload from "@/app/dataset-upload";
import OverviewTrend from "@/app/overview-trend";
import {OVERVIEW_TREND_METRICS,trendLabel,type OverviewTrendMetric} from "@/lib/overview-trend";
import PrintReport, { PDF_OPTIONS } from "@/app/performance-report";
import { aggregateMetric, compareMetricScopes, captureReportSnapshot, MAIN_METRICS, METRIC_METHODS, metricCoverage, metricRecordValue, reportedFieldSum, historicalMetricValue, type PerformanceMetric } from "@/lib/performance-metrics";
import { VisualizationEngine, VisualizationDatum } from "@/app/visualization-engine";
import { formatAuditAction, formatAuditTarget, formatProcessStatus, formatRoleLabel, KPI_LABELS, MISSING_VALUE_LABEL, MISSING_VALUE_TOOLTIP, userFacingError } from "@/lib/corporate-language";
import { formatLocalizedNumber, formatMetricDelta, formatMetricValue, formatPercentage, metricCatalog, metricDeltaStatus, metricStatus, MetricKey } from "@/lib/visualization-engine";

type ViewKey =
  | "overview"
  | "stations"
  | "ontime"
  | "delay"
  | "baggage"
  | "documents"
  | "safety"
  | "complaints"
  | "quality"
  | "upload"
  | "reports"
  | "management"
  | "admin";

type NullableNumber = number | null;

type StationRecord = {
  id: string;
  provider: string;
  period: string;
  stationCode: string;
  rawStationCode?: string;
  stationName: string;
  portId?: string | null;
  airportName?: string | null;
  shortName?: string | null;
  displayCity?: string | null;
  countryNameEn?: string | null;
  locationMappingStatus?: "resolved" | "unresolved" | "excluded";
  flights: number;
  passengers: NullableNumber;
  unreadDocuments?: NullableNumber;
  visaPassportIssues?: NullableNumber;
  gseDamageReports?: NullableNumber;
  digitalBoardingRatio?: NullableNumber;
  sourceTitle?: string | null;
  title?: string | null;
  delayMinutes: NullableNumber;
  docRatePct: NullableNumber;
  docCount: NullableNumber;
  internationalPassengers: NullableNumber;
  damagedRate: NullableNumber;
  damagedCount: NullableNumber;
  lostRate: NullableNumber;
  lostCount: NullableNumber;
  safetyPct: NullableNumber;
  safetyCount: NullableNumber;
  nonSafetyPct: NullableNumber;
  nonSafetyCount: NullableNumber;
  safetyReports: NullableNumber;
  otp: NullableNumber;
  ota: NullableNumber;
  complaintDays: NullableNumber;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  mappingVersion: string;
  calculationVersion: string;
  validationStatus: "valid" | "warning" | "error";
  region?: string | null;
  regionCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  uploadId?: string;
  isTestData?: boolean;
};

type QualityIssue = {
  level: "error" | "warning" | "info";
  row: number;
  field: string;
  message: string;
};

type ReportScope = "summary" | "full";

type ReportSnapshot = {
  trendMetric?:OverviewTrendMetric;
  scope: ReportScope;
  generatedAt: number;
  records: StationRecord[];
  comparison: StationRecord[];
  history: StationRecord[];
  issues: QualityIssue[];
  filters: {
    period: string;
    comparisonPeriod: string;
    provider: string;
    region: string;
    country: string;
    city: string;
    stations: string[];
    source: string;
    dataStatus: string;
  };
};

type ImportEntry = {
  id: string;
  fileName: string;
  title?: string | null;
  importSelection?: string | null;
  provider: string;
  period: string;
  rows: number;
  valid: number;
  warnings: number;
  errors: number;
  duration: string;
  createdAt: string;
  status: string;
};

type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  roleCode: string;
  workspaceName: string;
  isAdmin: boolean;
  workspaceId?: string;
};

type UploadEntry = {
  id: string;
  fileName: string;
  title?: string | null;
  importSelection?: string | null;
  provider: string;
  period: string;
  rowCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  versionNumber: number;
  isActiveVersion: boolean;
  isTestData: boolean;
  deletionStatus: string;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  ownerUserId: string;
  ownerName: string;
  sourceSheet: string;
  mappingVersion: string;
  importStatus: string;
  deletionReason?: string | null;
};

type GeographyEntry = {
  id: string;
  stationCode: string;
  iataCode: string | null;
  airportName: string | null;
  shortName: string | null;
  displayCity: string | null;
  cityId: string | null;
  cityName: string | null;
  cityDisplayName: string | null;
  countryId: string | null;
  countryCode: string | null;
  countryName: string | null;
  countryNameEn: string | null;
  regionId: string | null;
  regionCode: string | null;
  regionName: string | null;
  activeStatus: string;
};

type DashboardPayload = {
  session: { user: SessionUser; permissions: string[]; signOutPath: string; workspaces?: Array<{id:string;name:string}> };
  current: StationRecord[];
  comparison: StationRecord[];
  history: StationRecord[];
  periods: string[];
  mainPeriod: string;
  comparisonPeriod: string;
  uploads: UploadEntry[];
  latestDataAt: number | null;
  geography: GeographyEntry[];
  quality: { score: number | null; components: Record<string, unknown> | null };
  exports: Array<{ id: string; exportType: string; fileName: string; createdAt: number; includeTestData: boolean; userName: string; userId: string; filterState: string; status: string; sizeBytes: number | null }>;
  audit: Array<{ id: string; action: string; targetType: string; targetId: string; createdAt: number }>;
  savedViews: Array<{ id: string; name: string; filterState: string; isDefault: boolean }>;
  mappingIssues: Array<{ level: "warning"; field: string; stationCode: string; message: string }>;
  missingMockPeriods: string[];
  testMockMissing: boolean;
};

const AJET_BLUE = "#008FDA";
const AJET_NAVY = "#002554";

const monthNames: Record<string, string> = {
  "01": "Ocak",
  "02": "Şubat",
  "03": "Mart",
  "04": "Nisan",
  "05": "Mayıs",
  "06": "Haziran",
  "07": "Temmuz",
  "08": "Ağustos",
  "09": "Eylül",
  "10": "Ekim",
  "11": "Kasım",
  "12": "Aralık",
};

const stationNames: Record<string, string> = {
  ADB: "Adnan Menderes",
  AYT: "Antalya",
  BJV: "Milas Bodrum",
  COV: "Çukurova",
  DLM: "Dalaman",
  ESB: "Esenboğa",
  SAW: "Sabiha Gökçen",
};

const seedRecords: StationRecord[] = [
  ["ADB", 405, 70013, null, null, null, null, 0.0054, 375, 0.0003, 24, null, null, null, null, null, 86, 84, 0.92],
  ["AYT", 451, 78745, 66, null, null, null, 0.0056, 441, 0.0004, 28, null, null, null, null, null, 88, 89, 0.96],
  ["BJV", 245, 38111, null, null, null, null, 0.0058, 221, 0.0001, 2, null, null, null, null, null, 91, 89, 1.31],
  ["COV", 209, 36238, null, null, null, null, 0.0063, 230, 0.0002, 9, null, null, null, null, null, 90, 91, 0.87],
  ["DLM", 158, 25057, null, null, null, null, 0.0045, 112, 0.0001, 2, null, null, null, null, null, 96, 94, 0.5],
  ["ESB", 2316, 398208, 273, 0.001, 1, 82247, 0.0035, 1404, 0.0013, 529, 0.13, 3, 0.09, 2, null, 91, 90, 0.58],
  ["SAW", 4080, 707669, 369, 0.005, 16, 299928, 0.0038, 2683, 0.0022, 1556, 0.32, 13, 0.05, 2, 2, 92, 92, 1.87],
].map((row, index) => {
  const [code, flights, passengers, delay, docRate, docCount, internationalPassengers, damagedRate, damagedCount, lostRate, lostCount, safetyPct, safetyCount, nonSafetyPct, nonSafetyCount, safetyReports, otp, ota, complaintDays] = row as [string, number, number, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber, NullableNumber];
  return {
    id: `TGS-2026-06-${code}`,
    provider: "TGS",
    period: "2026-06",
    stationCode: code,
    stationName: stationNames[code],
    flights,
    passengers,
    delayMinutes: delay,
    docRatePct: docRate,
    docCount,
    internationalPassengers,
    damagedRate,
    damagedCount,
    lostRate,
    lostCount,
    safetyPct,
    safetyCount,
    nonSafetyPct,
    nonSafetyCount,
    safetyReports,
    otp,
    ota,
    complaintDays,
    sourceFile: "Haziran 2026 TGS İstasyon Performans Karnesi(2).pdf",
    sourceSheet: "Genel",
    sourceRow: index + 2,
    mappingVersion: "TGS-v1.0",
    calculationVersion: "KPI-v1.0",
    validationStatus: code === "ESB" || code === "SAW" ? "valid" : "warning",
  };
});

const initialIssues: QualityIssue[] = [
  { level: "warning", row: 2, field: "DELAY", message: "ADB için tehir değeri raporlanmamış; sıfıra çevrilmedi." },
  { level: "warning", row: 3, field: "DOC", message: "AYT için doküman pay ve paydası kaynakta bulunmuyor." },
  { level: "warning", row: 4, field: "IRSAFE", message: "BJV safety oranı raporlanmamış; veri kapsamı eksik." },
  { level: "info", row: 7, field: "DAM", message: "Türkçe ondalık biçimi 0,0035 → 0.0035 olarak dönüştürüldü." },
  { level: "info", row: 8, field: "PASS", message: "Binlik ayracı 707.669 → 707669 olarak dönüştürüldü." },
];

const navItems: { key: ViewKey; label: string; icon: typeof LayoutDashboard; group: "ANALİZ" | "VERİ" | "SİSTEM" }[] = [
  { key: "overview", label: "Genel Bakış", icon: LayoutDashboard, group: "ANALİZ" },
  { key: "stations", label: "İstasyon Karşılaştırması", icon: Table2, group: "ANALİZ" },
  { key: "ontime", label: "Zamanında Performans", icon: Clock3, group: "ANALİZ" },
  { key: "delay", label: "Tehir Analizi", icon: TimerReset, group: "ANALİZ" },
  { key: "baggage", label: "Bagaj Performansı", icon: Luggage, group: "ANALİZ" },
  { key: "documents", label: "Doküman ve Yolcu", icon: FileText, group: "ANALİZ" },
  { key: "safety", label: "Safety ve Operasyon", icon: ShieldCheck, group: "ANALİZ" },
  { key: "complaints", label: "Şikâyet Performansı", icon: MessageSquareText, group: "ANALİZ" },
  { key: "quality", label: "Veri Kalitesi", icon: BadgeCheck, group: "VERİ" },
  { key: "upload", label: "Veri Yükleme", icon: UploadCloud, group: "VERİ" },
  { key: "reports", label: "Rapor Merkezi", icon: FileOutput, group: "VERİ" },
  { key: "management", label: "Yönetim", icon: Settings2, group: "SİSTEM" },
  { key: "admin", label: "Kullanıcı ve Erişim Yönetimi", icon: UserCog, group: "SİSTEM" },
];

function formatNumber(value: NullableNumber, digits = 0) {
  return formatLocalizedNumber(value, digits);
}

function formatPeriod(period: string) {
  if (!period || period === "none") return "Karşılaştırma yok";
  const [year, month] = period.split("-");
  return `${monthNames[month] ?? month} ${year}`;
}

function formatRate(value: NullableNumber, digits = 2) {
  return formatPercentage(value, digits, "percentage-points");
}

function formatPercentRatio(value: NullableNumber, digits = 2) {
  return formatPercentage(value, digits, "ratio");
}

function formatDateTime(value: number | null | undefined) {
  if (!value) return "Henüz veri yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number | null | undefined) {
  if (!value) return MISSING_VALUE_LABEL;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${formatNumber(value / 1024, 1)} KB`;
  return `${formatNumber(value / 1024 / 1024, 1)} MB`;
}

function roleLabel(role: string) {
  return formatRoleLabel(role);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
}

function sum(records: StationRecord[], key: keyof StationRecord) {
  return records.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readSavedFilter(key: "provider" | "station" | "period", fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem("ajet-performance-filters");
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed[key] === "string" ? parsed[key] as string : fallback;
  } catch {
    return fallback;
  }
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone = "blue",
  progress,
  target,
  coverage,
  priority = "secondary",
  comparison,
  sparkline,
  onOpen,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: typeof Plane;
  tone?: "blue" | "navy" | "soft" | "warning";
  progress?: number;
  target?: string;
  coverage?: string;
  priority?: "primary" | "secondary";
  comparison?: {
    period: string;
    currentPeriod: string;
    previous: string;
    current: string;
    delta: string;
    previousValue: number | null;
    currentValue: number | null;
    status: "improved" | "worsened" | "neutral";
    comparable: boolean;
    reason?: string;
  };
  sparkline?: { metric: MetricKey; values: Array<number | null>; periods: string[] };
  onOpen?: () => void;
}) {
  const historyValues = sparkline?.values.filter((item): item is number => item !== null) ?? [];
  const historyHigh = historyValues.length && sparkline ? formatMetricValue(sparkline.metric, Math.max(...historyValues)) : MISSING_VALUE_LABEL;
  const historyLow = historyValues.length && sparkline ? formatMetricValue(sparkline.metric, Math.min(...historyValues)) : MISSING_VALUE_LABEL;
  return (
    <article
      className={`metric-card tone-${tone} metric-${priority} ${onOpen ? "metric-card-actionable" : ""}`}
      onClick={onOpen}
      onKeyDown={(event) => { if (onOpen && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `${label} veri detayını aç` : undefined}
    >
      <div className="metric-top">
        <div className="metric-heading"><span className="metric-icon"><Icon size={17} /></span><span className="metric-label">{label}</span></div>
        {target && <span className="metric-target">Hedef {target}</span>}
      </div>
      {comparison?.comparable ? <>
        <div className="metric-comparison-values">
          <div className="current"><small>{comparison.currentPeriod}</small><strong><i className="metric-current-dot" />{comparison.current}</strong></div>
          <div><small>{comparison.period}</small><strong>{comparison.previous}</strong></div>
        </div>
        <div className={`metric-comparison-delta ${comparison.status}`} aria-label={`Değişim ${comparison.delta}`}>
          <small>Değişim</small>
          <strong><span>{comparison.currentValue === null || comparison.previousValue === null || comparison.currentValue === comparison.previousValue ? "•" : comparison.currentValue > comparison.previousValue ? "▲" : "▼"}</span>{comparison.delta}</strong>
        </div>
        <MetricComparisonSlope current={comparison.currentValue} previous={comparison.previousValue} status={comparison.status} />
      </> : <div className={`metric-value ${value === MISSING_VALUE_LABEL ? "metric-missing" : ""}`}><i className="metric-current-dot" />{value}{unit && <small>{unit}</small>}</div>}
      {progress !== undefined && !comparison && (
        <div className="metric-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /></div>
      )}
      {comparison && !comparison.comparable && <div className="metric-scope-warning" title={comparison.reason}><b>Karşılaştırılamıyor</b></div>}
      {coverage && <div className="metric-coverage">{coverage}</div>}
      {!comparison && sparkline && <MetricSparkline metric={sparkline.metric} values={sparkline.values} periods={sparkline.periods} />}
      <div className="metric-detail" role="tooltip"><b>{label}</b><span>{detail}</span>{comparison?.comparable && <span>{comparison.currentPeriod}: {comparison.current} · {comparison.period}: {comparison.previous} · {comparison.delta}</span>}{comparison && !comparison.comparable && <span>{comparison.reason}</span>}{target && <span>Hedef: {target}</span>}<span>12A yüksek: {historyHigh} · 12A düşük: {historyLow}</span><small>Tıklayın: tanım, formül, tarihçe ve kaynak</small></div>
    </article>
  );
}

function MetricComparisonSlope({ current, previous, status }: { current: number | null; previous: number | null; status: "improved" | "worsened" | "neutral" }) {
  if (current === null || previous === null) return null;
  const min = Math.min(current, previous);
  const max = Math.max(current, previous);
  const y = (value: number) => max === min ? 17 : 27 - (value - min) / (max - min) * 20;
  return <div className="metric-mini-slope" aria-hidden="true"><svg viewBox="0 0 160 34" preserveAspectRatio="none"><line className={status} x1="7" y1={y(previous)} x2="153" y2={y(current)} /><circle className="previous" cx="7" cy={y(previous)} r="4" /><circle className="current" cx="153" cy={y(current)} r="4" /></svg></div>;
}

function sparklineLabelIndices(length: number) {
  if (length <= 0) return [];
  const labelCount = length >= 9 ? 5 : length >= 5 ? 4 : Math.min(length, 3);
  return Array.from(new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (length - 1) / Math.max(labelCount - 1, 1)))));
}

function formatSparklinePeriod(period: string) {
  const [year, month] = period.split("-");
  const monthLabel = (monthNames[month] ?? month).slice(0, 3);
  return `${monthLabel} ${year?.slice(-2) ?? ""}`.trim();
}

function MetricSparkline({ metric, values, periods }: { metric: MetricKey; values: Array<number | null>; periods: string[] }) {
  const usable = values.filter((value): value is number => value !== null);
  if (usable.length < 2) return null;
  const width = 160; const height = 28; const min = Math.min(...usable); const max = Math.max(...usable); const spread = Math.max(max - min, 0.000001);
  const pointValues = values.map((value, index) => value === null ? null : `${index / Math.max(values.length - 1, 1) * width},${height - 3 - (value - min) / spread * (height - 8)}`).filter((value): value is string => Boolean(value));
  const last = usable[usable.length - 1]; const previous = usable[usable.length - 2]; const status = metricDeltaStatus(metric, last, previous);
  const labels = sparklineLabelIndices(Math.min(values.length, periods.length));
  return <div className="metric-sparkline" title={`Son ${usable.length} dönem · ${status === "improved" ? "iyileşme" : status === "worsened" ? "kötüleşme" : "değişmedi"}`} aria-label={`${usable.length} aylık dönemsel eğilim; ${labels.map((index) => formatSparklinePeriod(periods[index])).join(", ")}`}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pointValues.join(" ")} /><circle cx={Number(pointValues.at(-1)?.split(",")[0] ?? width)} cy={Number(pointValues.at(-1)?.split(",")[1] ?? height / 2)} r="3.5" className={status} /></svg>
    <div className="metric-sparkline-axis" aria-hidden="true">{labels.map((index, labelIndex) => <span className={index === periods.length - 1 ? "selected" : ""} key={periods[index]} data-label-index={labelIndex}>{formatSparklinePeriod(periods[index])}</span>)}</div>
  </div>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: "valid" | "warning" | "error" }) {
  const label = status === "valid" ? "Doğrulandı" : status === "warning" ? "Uyarı Var" : "Geçersiz Değer";
  return <span className={`status-pill ${status}`}><span />{label}</span>;
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" role="status" aria-live="polite" aria-label="Genel Bakış verileri yükleniyor">
    <div className="skeleton-heading"><i /><span><b /><b /></span></div>
    <div className="skeleton-kpis">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
    <div className="skeleton-panels"><i /><i /></div>
  </div>;
}

type TrendMetric = PerformanceMetric;

const trendMetricConfig: Record<TrendMetric, { label: string; unit: string; color: string }> = {
  ...Object.fromEntries(MAIN_METRICS.map(key => [key,{label:KPI_LABELS[key as keyof typeof KPI_LABELS] ?? metricCatalog[key].label,unit:metricCatalog[key].displayUnit === "percent" ? "%" : "",color:metricCatalog[key].color}])) as Record<TrendMetric, {label:string;unit:string;color:string}>,
  flights: { label: "Uçuş", unit: "", color: AJET_NAVY }, passengers: { label: "Yolcu", unit: "", color: AJET_BLUE },
  otp: { label: "OTP", unit: "%", color: AJET_BLUE }, ota: { label: "OTA", unit: "%", color: AJET_NAVY },
  delay: { label: KPI_LABELS.delay, unit: " dk", color: "#B66C13" }, delayPer100: { label: "100 Uçuş Başına Tehir", unit: " dk", color: AJET_BLUE }, damaged: { label: KPI_LABELS.damaged, unit: "%", color: AJET_BLUE },
  lost: { label: KPI_LABELS.lost, unit: "%", color: AJET_NAVY }, safety: { label: KPI_LABELS.safety, unit: "%", color: AJET_BLUE },
  nonSafety: { label: "Safety Dışı %", unit: "%", color: AJET_NAVY }, complaint: { label: KPI_LABELS.complaint, unit: " gün", color: "#19896A" },
  documents: { label: "Doküman hata oranı", unit: "%", color: AJET_NAVY },
};

const trendMetricToCatalog: Record<TrendMetric, MetricKey> = {
  ...Object.fromEntries(MAIN_METRICS.map(key => [key,key])) as Record<TrendMetric, MetricKey>,
  flights: "flights", passengers: "passengers", otp: "otp", ota: "ota", delay: "delay", delayPer100: "delayPer100",
  damaged: "damaged", lost: "lost", safety: "safety", nonSafety: "nonSafety",
  complaint: "complaint", documents: "documents",
};

function historicalPeriodsThrough(records: StationRecord[], selectedPeriod: string, limit = 12) {
  return Array.from(new Set(records.map((record) => record.period)))
    .filter((period) => /^\d{4}-\d{2}$/.test(period) && period <= selectedPeriod)
    .sort()
    .slice(-limit);
}

function trendValue(records: StationRecord[], metric: TrendMetric) { return aggregateMetric(records, metric); }
type ComparisonScope = ReturnType<typeof compareMetricScopes>;
function validateComparisonScope(current:StationRecord[], comparison:StationRecord[], metric:TrendMetric):ComparisonScope { return compareMetricScopes(current,comparison,metric); }

type StationInsight = { record: StationRecord; metric: string; reason: string };

function buildStationInsights(records: StationRecord[]): StationInsight[] {
  const insights: StationInsight[] = [];
  const used = new Set<string>();
  const take = (ordered: StationRecord[], factory: (record: StationRecord) => Omit<StationInsight, "record">) => {
    const record = ordered.find((item) => !used.has(item.stationCode));
    if (!record || insights.length >= 3) return;
    used.add(record.stationCode);
    insights.push({ record, ...factory(record) });
  };
  take([...records].filter((record) => record.otp !== null).sort((a, b) => (a.otp ?? 100) - (b.otp ?? 100)), (record) => ({ metric: `OTP ${formatRate(record.otp, 1)}`, reason: (record.otp ?? 100) < 90 ? `Hedefin ${formatNumber(90 - (record.otp ?? 90), 1)} puan altında` : "Seçili dönemin en düşük OTP değeri" }));
  take([...records].filter((record) => record.ota !== null).sort((a, b) => (a.ota ?? 100) - (b.ota ?? 100)), (record) => ({ metric: `OTA ${formatRate(record.ota, 1)}`, reason: (record.ota ?? 100) < 90 ? `Hedefin ${formatNumber(90 - (record.ota ?? 90), 1)} puan altında` : "Seçili dönemin en düşük OTA değeri" }));
  take([...records].filter((record) => record.lostRate !== null).sort((a, b) => (b.lostRate ?? 0) - (a.lostRate ?? 0)), (record) => ({ metric: `Kayıp bagaj ${formatPercentRatio(record.lostRate)}`, reason: "Seçili dönemin en yüksek kayıp bagaj oranı" }));
  take([...records].filter((record) => record.delayMinutes !== null && record.flights > 0).sort((a, b) => ((b.delayMinutes ?? 0) / b.flights) - ((a.delayMinutes ?? 0) / a.flights)), (record) => ({ metric: `${formatNumber((record.delayMinutes ?? 0) / record.flights * 100, 1)} dk / 100 uçuş`, reason: "Seçili kapsamın en yüksek normalize tehir değeri" }));
  if (insights.length < 3) take(records.filter((record) => record.validationStatus !== "valid"), (record) => ({ metric: record.validationStatus === "error" ? "Veri kalitesi hatası" : "Veri kalitesi uyarısı", reason: "Kaynak veya doğrulama incelemesi gerekiyor" }));
  return insights;
}

function visualizationContext(record: StationRecord) {
  return {
    airportName: record.airportName ?? record.stationName,
    city: record.city,
    country: record.country,
    provider: record.provider,
    period: record.period,
    sourceFile: record.sourceFile,
    sourceSheet: record.sourceSheet,
    sourceRow: record.sourceRow,
    isTestData: record.isTestData,
  };
}

function PeriodTrend({ current, comparison, history = [], currentPeriod, comparisonPeriod, defaultMetric = "otp", metrics = [...MAIN_METRICS,"nonSafety"], compact = false }: { current: StationRecord[]; comparison: StationRecord[]; history?: StationRecord[]; currentPeriod: string; comparisonPeriod: string; defaultMetric?: TrendMetric; metrics?: TrendMetric[]; compact?: boolean }) {
  const [metric, setMetric] = useState<TrendMetric>(defaultMetric);
  const [range, setRange] = useState<3 | 6 | 12>(12);
  const [selectedPoint, setSelectedPoint] = useState<VisualizationDatum | null>(null);
  const config = trendMetricConfig[metric];
  const catalogMetric = trendMetricToCatalog[metric];
  const comparisonEnabled = comparisonPeriod !== "none" && comparison.length > 0;
  const comparisonWithinHistory = comparisonEnabled && comparisonPeriod <= currentPeriod;
  const scope = comparisonEnabled ? validateComparisonScope(current, comparison, metric) : { comparable: false, label: "Karşılaştırma yok" as const, reason: "Karşılaştırma dönemi seçilmedi." };
  const previous = comparisonEnabled ? trendValue(comparison, metric) : null;
  const currentValue = trendValue(current, metric);
  const historicalPeriods = historicalPeriodsThrough(history, currentPeriod, 12);
  const compatibleHistory = historicalPeriods.flatMap((period) => {
    const periodRecords = history.filter((record) => record.period === period);
    const compatible = period === currentPeriod || validateComparisonScope(current, periodRecords, metric).comparable;
    if (!compatible) return [];
    return [{ id: period, label: formatPeriod(period), period, value: trendValue(periodRecords, metric), isCurrent: period === currentPeriod, isComparison: comparisonWithinHistory && period === comparisonPeriod, stationCoverage: periodRecords.length, rawRecordCount: periodRecords.length, isTestData: periodRecords.some((row) => row.isTestData), sourceFile: periodRecords.map((row) => row.sourceFile).filter((value, index, values) => values.indexOf(value) === index).join(", ") } satisfies VisualizationDatum];
  });
  const completeData: VisualizationDatum[] = compatibleHistory.length >= 2 ? compatibleHistory : scope.comparable && comparisonWithinHistory ? [
    { id: comparisonPeriod, label: formatPeriod(comparisonPeriod), period: comparisonPeriod, value: previous, isTestData: comparison.some((row) => row.isTestData), sourceFile: comparison[0]?.sourceFile },
    { id: currentPeriod, label: formatPeriod(currentPeriod), period: currentPeriod, value: currentValue, isTestData: current.some((row) => row.isTestData), sourceFile: current[0]?.sourceFile },
  ] : [{ id: currentPeriod, label: formatPeriod(currentPeriod), period: currentPeriod, value: currentValue, isTestData: current.some((row) => row.isTestData), sourceFile: current[0]?.sourceFile }];
  const data = completeData.slice(-range).map((point, index, values) => ({ ...point, previous: index > 0 ? values[index - 1].value : undefined }));
  const comparablePeriods = data.filter((item) => item.value !== null);
  const emptyMessage = scope.label === "Kapsam farklı" && completeData.length < 2 ? `Kapsam farklı — ${scope.reason}` : "Dönemsel eğilim için yeterli tarihsel dönem bulunamadı.";
  const selectedRows = selectedPoint?.period ? history.filter((record) => record.period === selectedPoint.period) : [];
  return (
    <div className={`period-trend ${compact ? "compact" : ""}`}>
      <div className="trend-toolbar"><span><i style={{ background: config.color }} />{config.label}</span>{metrics.length > 1 && <label><span>Metrik</span><select value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)}>{metrics.map((value) => <option key={value} value={value}>{trendMetricConfig[value].label}</option>)}</select></label>}<div className="trend-range" aria-label="Dönemsel eğilim aralığı">{([3, 6, 12] as const).map((value) => <button type="button" key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value}A</button>)}</div></div>
      {comparablePeriods.length < 2 ? <div className="chart-empty">{emptyMessage}</div> : <VisualizationEngine metric={catalogMetric} data={data} periodCount={comparablePeriods.length} hasPreviousPeriod requestedVariant="line" height={compact ? "compact" : "standard"} onSelect={setSelectedPoint} />}
      <div className="trend-legend"><span><i className="improved" />Performans iyileşmesi</span><span><i className="worsened" />Performans kötüleşmesi</span><span><i className="neutral" />Değişmedi</span><b>{range} aylık görünüm</b></div>
      <p className="chart-footnote">{comparisonEnabled ? scope.comparable && previous !== null && currentValue !== null ? `${formatPeriod(comparisonPeriod)} → ${formatPeriod(currentPeriod)}: ${formatMetricDelta(catalogMetric, currentValue, previous)}.` : `${scope.label} — ${scope.reason}` : `${completeData.length} dönemlik tarihsel seri · karşılaştırma seçilmedi.`}</p>
      {selectedPoint && <div className="drawer-backdrop trend-drawer-backdrop" onMouseDown={() => setSelectedPoint(null)}><aside className="trend-detail-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span>{selectedPoint.period?.slice(5)}</span><div><small>{config.label} · dönemsel eğilim noktası</small><h2>{selectedPoint.label}</h2></div></div><button onClick={() => setSelectedPoint(null)} aria-label="Kapat"><X size={20} /></button></div><div className="drawer-body"><section className="drawer-kpis"><div><span>Değer</span><strong>{formatMetricValue(catalogMetric, selectedPoint.value)}</strong></div><div><span>Önceki Ay</span><strong>{formatMetricValue(catalogMetric, selectedPoint.previous)}</strong></div><div><span>Değişim</span><strong>{formatMetricDelta(catalogMetric, selectedPoint.value, selectedPoint.previous)}</strong></div><div><span>İstasyon Kapsamı</span><strong>{selectedRows.length}</strong></div></section><section className="drawer-section source-lineage"><SectionHeader eyebrow="KAYNAK DETAYI" title="Dosyalar ve Kaynak Kayıtlar" /><dl><div><dt>Ay</dt><dd>{selectedPoint.label}</dd></div><div><dt>Metrik</dt><dd>{config.label}</dd></div><div><dt>Kaynak Dosyalar</dt><dd>{Array.from(new Set(selectedRows.map((record) => record.sourceFile))).join(", ")}</dd></div><div><dt>Kaynak Kayıtlar</dt><dd>{selectedRows.map((record) => `${record.stationCode} · satır ${record.sourceRow}`).join("; ")}</dd></div></dl></section></div></aside></div>}
    </div>
  );
}

type DualTrendPoint = {
  period: string;
  label: string;
  otp: number | null;
  ota: number | null;
  rows: StationRecord[];
};

function OtpOtaDualTrend({ current, comparison, history, currentPeriod, comparisonPeriod, onSelect }: { current: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onSelect?: () => void }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const selectedCodes = new Set(current.map((record) => record.stationCode));
  const selectedProviders = new Set(current.map((record) => record.provider));
  const scopedHistory = history.filter((record) => selectedCodes.has(record.stationCode) && selectedProviders.has(record.provider));
  const periods = historicalPeriodsThrough(scopedHistory, currentPeriod, 12);
  const points: DualTrendPoint[] = periods.flatMap((period) => {
    const rows = scopedHistory.filter((record) => record.period === period);
    const isCompatible = period === currentPeriod || (validateComparisonScope(current, rows, "otp").comparable && validateComparisonScope(current, rows, "ota").comparable);
    if (!isCompatible) return [];
    return [{ period, label: formatPeriod(period), otp: trendValue(rows, "otp"), ota: trendValue(rows, "ota"), rows }];
  });
  const comparisonEnabled = comparisonPeriod !== "none" && comparison.length > 0;
  const currentPoint = points.find((point) => point.period === currentPeriod);
  const comparisonPoint = comparisonEnabled ? points.find((point) => point.period === comparisonPeriod) : undefined;
  const values = points.flatMap((point) => [point.otp, point.ota]).filter((value): value is number => value !== null);
  const width = 960;
  const height = 286;
  const plot = { left: 54, right: 936, top: 24, bottom: 238 };
  const rawMin = values.length ? Math.min(...values) : 75;
  const rawMax = values.length ? Math.max(...values) : 100;
  const min = Math.max(0, Math.floor((rawMin - 2) / 2) * 2);
  const max = Math.min(100, Math.ceil((rawMax + 2) / 2) * 2 || 100);
  const x = (index: number) => plot.left + index / Math.max(points.length - 1, 1) * (plot.right - plot.left);
  const y = (value: number) => plot.bottom - (value - min) / Math.max(max - min, 1) * (plot.bottom - plot.top);
  const polyline = (key: "otp" | "ota") => points.flatMap((point, index) => point[key] === null ? [] : [`${x(index)},${y(point[key]!)}`]).join(" ");
  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  const previousHovered = hoveredIndex !== null && hoveredIndex > 0 ? points[hoveredIndex - 1] : null;
  const yTicks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4);
  const currentIndex = points.findIndex((point) => point.period === currentPeriod);
  const comparisonIndex = comparisonEnabled ? points.findIndex((point) => point.period === comparisonPeriod) : -1;

  if (points.length < 2 || values.length < 4) return <div className="chart-empty">OTP ve OTA dönemsel eğilimi için en az iki uyumlu dönem gereklidir.</div>;

  return <div className="dual-trend">
    <div className="dual-trend-toolbar">
      <div className="dual-trend-legend"><span><i className="otp" />OTP</span><span><i className="ota" />OTA</span><span><i className="current" />Ana Dönem</span>{comparisonEnabled && <span><i className="comparison" />Karşılaştırma Dönemi</span>}</div>
      {comparisonEnabled && currentPoint && comparisonPoint && <div className="dual-comparison-summary"><span>OTP <b>{formatMetricDelta("otp", currentPoint.otp, comparisonPoint.otp)}</b></span><span>OTA <b>{formatMetricDelta("ota", currentPoint.ota, comparisonPoint.ota)}</b></span></div>}
    </div>
    <div className="dual-trend-canvas" onMouseLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="12 aylık OTP ve OTA performansı">
        {yTicks.map((tick) => <g key={tick}><line className="dual-grid" x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} /><text className="dual-axis-label" x={plot.left - 12} y={y(tick) + 4} textAnchor="end">%{formatNumber(tick, 0)}</text></g>)}
        {comparisonIndex >= 0 && <line className="dual-period-guide comparison" x1={x(comparisonIndex)} x2={x(comparisonIndex)} y1={plot.top} y2={plot.bottom} />}
        {currentIndex >= 0 && <line className="dual-period-guide current" x1={x(currentIndex)} x2={x(currentIndex)} y1={plot.top} y2={plot.bottom} />}
        <polyline className="dual-line otp" points={polyline("otp")} />
        <polyline className="dual-line ota" points={polyline("ota")} />
        {hoveredIndex !== null && <line className="dual-crosshair" x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1={plot.top} y2={plot.bottom} />}
        {points.map((point, index) => {
          const isCurrent = point.period === currentPeriod;
          const isComparison = comparisonEnabled && point.period === comparisonPeriod;
          const className = isCurrent ? "current" : isComparison ? "comparison" : "";
          return <g key={point.period} className="dual-point-group" tabIndex={0} role="button" aria-label={`${point.label}: OTP ${formatRate(point.otp, 1)}, OTA ${formatRate(point.ota, 1)}`} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(); } }}>
            <rect className="dual-hit-area" x={x(index) - Math.max(18, (plot.right - plot.left) / points.length / 2)} y={plot.top} width={Math.max(36, (plot.right - plot.left) / points.length)} height={plot.bottom - plot.top} />
            {point.otp !== null && <circle className={`dual-marker otp ${className}`} cx={x(index)} cy={y(point.otp)} r={isCurrent ? 6 : isComparison ? 5.5 : 3.5} />}
            {point.ota !== null && <circle className={`dual-marker ota ${className}`} cx={x(index)} cy={y(point.ota)} r={isCurrent ? 6 : isComparison ? 5.5 : 3.5} />}
            <text className="dual-month-label" x={x(index)} y={263} textAnchor="middle">{point.label.replace(" 20", " ’")}</text>
            {(isCurrent || isComparison) && <text className={`dual-period-label ${className}`} x={x(index)} y={14} textAnchor="middle">{isCurrent ? "Ana Dönem" : "Karşılaştırma Dönemi"}</text>}
          </g>;
        })}
      </svg>
      {hovered && hoveredIndex !== null && <div className="dual-tooltip" role="tooltip" style={{ left: `${Math.min(86, Math.max(12, x(hoveredIndex) / width * 100))}%` }}>
        <strong>{hovered.label}</strong><small>{hovered.rows.length} istasyon · uçuş ağırlıklı</small>
        <div><span className="otp" />OTP <b>{formatRate(hovered.otp, 1)}</b><em className={`trend-status-${metricDeltaStatus("otp", hovered.otp, previousHovered?.otp)}`}>{previousHovered ? formatMetricDelta("otp", hovered.otp, previousHovered.otp) : "İlk dönem"}</em></div>
        <div><span className="ota" />OTA <b>{formatRate(hovered.ota, 1)}</b><em className={`trend-status-${metricDeltaStatus("ota", hovered.ota, previousHovered?.ota)}`}>{previousHovered ? formatMetricDelta("ota", hovered.ota, previousHovered.ota) : "İlk dönem"}</em></div>
      </div>}
    </div>
    <p className="chart-footnote">OTP ve OTA aynı eksende, 12 aylık düz çizgi serisi olarak gösterilir. Yeşil/kırmızı yalnız değişim bilgisinde vurgu rengidir.</p>
  </div>;
}

const periodComparisonMetrics: TrendMetric[] = MAIN_METRICS;
const periodComparisonMetricLabels: Partial<Record<TrendMetric, string>> = { otp: "OTP", ota: "OTA", flights: "Toplam Uçuş", passengers: "Toplam Yolcu", delay: "Toplam Tehir", damaged: "Hasarlı Bagaj %", lost: "Kayıp Bagaj %", complaint: "Şikâyet Dönüş Süresi", safety: "Safety %" };

function PeriodComparisonChart({ current, comparison, currentPeriod, comparisonPeriod, onStation }: { current: StationRecord[]; comparison: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const [metric, setMetric] = useState<TrendMetric>("otp");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const catalogMetric = trendMetricToCatalog[metric];
  const scope = validateComparisonScope(current, comparison, metric);
  const comparisonByCode = new Map(comparison.map((record) => [`${record.provider}|${record.stationCode}`, record]));
  const pairs = [...current].sort((left, right) => left.stationCode.localeCompare(right.stationCode)).flatMap((record) => {
    const previousRecord = comparisonByCode.get(`${record.provider}|${record.stationCode}`);
    if (!previousRecord) return [];
    return [{ record, previousRecord, currentValue: trendValue([record], metric), previousValue: trendValue([previousRecord], metric) }];
  });
  const availablePairs = pairs.filter((pair) => pair.currentValue !== null && pair.previousValue !== null);
  const hovered = availablePairs.find((pair) => pair.record.stationCode === hoveredCode);
  const statusFor = (currentValue: number | null, previousValue: number | null) => metricDeltaStatus(catalogMetric, currentValue, previousValue);

  return <section className="panel chart-panel period-comparison-panel">
    <SectionHeader eyebrow="DÖNEM KARŞILAŞTIRMASI" title={`${formatPeriod(currentPeriod)} ve ${formatPeriod(comparisonPeriod)}`} action={<label className="period-metric-selector"><span>Metrik</span><select value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)}>{periodComparisonMetrics.map((value) => <option key={value} value={value}>{periodComparisonMetricLabels[value]}</option>)}</select></label>} />
    <div className="period-series-legend"><span><i className="current" />{formatPeriod(currentPeriod)}</span><span><i className="comparison" />{formatPeriod(comparisonPeriod)}</span><small>Yeşil ve kırmızı yalnız performans değişimini gösterir.</small></div>
    {!scope.comparable || !availablePairs.length ? <div className="chart-empty"><b>{scope.label}</b><span>{scope.reason}</span></div> : availablePairs.length === 1 ? (() => {
      const pair = availablePairs[0];
      const previousValue = pair.previousValue!;
      const currentValue = pair.currentValue!;
      const min = Math.min(previousValue, currentValue);
      const max = Math.max(previousValue, currentValue);
      const y = (value: number) => max === min ? 42 : 60 - (value - min) / (max - min) * 36;
      const status = statusFor(currentValue, previousValue);
      return <button type="button" className="period-direct-comparison" onClick={() => onStation(pair.record)}>
        <div><small>{formatPeriod(comparisonPeriod)}</small><strong>{formatMetricValue(catalogMetric, previousValue)}</strong></div>
        <svg viewBox="0 0 240 82" role="img" aria-label={`${pair.record.stationCode} ${metricCatalog[catalogMetric].label} dönem karşılaştırması`}><line className={status} x1="18" y1={y(previousValue)} x2="222" y2={y(currentValue)} /><circle className="comparison" cx="18" cy={y(previousValue)} r="7" /><circle className="current" cx="222" cy={y(currentValue)} r="7" /></svg>
        <div><small>{formatPeriod(currentPeriod)}</small><strong>{formatMetricValue(catalogMetric, currentValue)}</strong></div>
        <span className={`period-delta-badge ${status}`}>{formatMetricDelta(catalogMetric, currentValue, previousValue)}</span>
        <em>{pair.record.stationCode} — {pair.record.airportName ?? pair.record.stationName}</em>
      </button>;
    })() : (() => {
      const allValues = availablePairs.flatMap((pair) => [pair.currentValue!, pair.previousValue!]);
      const rawMin = Math.min(...allValues);
      const rawMax = Math.max(...allValues);
      const padding = Math.max((rawMax - rawMin) * .12, Math.abs(rawMax) * .02, .0001);
      const min = rawMin - padding;
      const max = rawMax + padding;
      const width = 960; const height = 286; const plot = { left: 62, right: 930, top: 24, bottom: 216 };
      const x = (index: number) => plot.left + index / Math.max(availablePairs.length - 1, 1) * (plot.right - plot.left);
      const y = (value: number) => plot.bottom - (value - min) / Math.max(max - min, .000001) * (plot.bottom - plot.top);
      const yTicks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4);
      const currentPoints = availablePairs.map((pair, index) => `${x(index)},${y(pair.currentValue!)}`).join(" ");
      const previousPoints = availablePairs.map((pair, index) => `${x(index)},${y(pair.previousValue!)}`).join(" ");
      return <div className="period-comparison-canvas" onMouseLeave={() => setHoveredCode(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricCatalog[catalogMetric].label} için iki dönemli istasyon karşılaştırması`}>
          {yTicks.map((tick) => <g key={tick}><line className="period-grid" x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} /><text className="period-axis-label" x={plot.left - 10} y={y(tick) + 4} textAnchor="end">{formatMetricValue(catalogMetric, tick)}</text></g>)}
          <polyline className="period-series comparison" points={previousPoints} />
          <polyline className="period-series current" points={currentPoints} />
          {availablePairs.map((pair, index) => { const status = statusFor(pair.currentValue, pair.previousValue); return <g key={pair.record.stationCode} className="period-station-point" tabIndex={0} role="button" onClick={() => onStation(pair.record)} onMouseEnter={() => setHoveredCode(pair.record.stationCode)} onFocus={() => setHoveredCode(pair.record.stationCode)} onBlur={() => setHoveredCode(null)}>
            <rect x={x(index) - 34} y={plot.top} width="68" height={plot.bottom - plot.top + 54} className="period-hit-area" />
            <line className={`period-delta-line ${status}`} x1={x(index)} x2={x(index)} y1={y(pair.previousValue!)} y2={y(pair.currentValue!)} />
            <circle className="period-marker comparison" cx={x(index)} cy={y(pair.previousValue!)} r="5" />
            <circle className="period-marker current" cx={x(index)} cy={y(pair.currentValue!)} r="5" />
            <text className="period-station-label" x={x(index)} y="240" textAnchor="middle">{pair.record.stationCode}</text>
            <text className={`period-delta-label ${status}`} x={x(index)} y="258" textAnchor="middle">{formatMetricDelta(catalogMetric, pair.currentValue, pair.previousValue)}</text>
          </g>; })}
        </svg>
        {hovered && <div className="period-comparison-tooltip" role="tooltip"><strong>{hovered.record.stationCode} — {hovered.record.city ?? hovered.record.stationName}</strong><span>{formatPeriod(currentPeriod)} <b>{formatMetricValue(catalogMetric, hovered.currentValue)}</b></span><span>{formatPeriod(comparisonPeriod)} <b>{formatMetricValue(catalogMetric, hovered.previousValue)}</b></span><em className={statusFor(hovered.currentValue, hovered.previousValue)}>{formatMetricDelta(catalogMetric, hovered.currentValue, hovered.previousValue)}</em></div>}
      </div>;
    })()}
  </section>;
}

function KpiDetailDrawer({ metric, records, comparison, history, currentPeriod, comparisonPeriod, onClose }: { metric: TrendMetric; records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onClose: () => void }) {
  const catalogMetric = trendMetricToCatalog[metric];
  const config = trendMetricConfig[metric];
  const copy = {definition:METRIC_METHODS[metric],formula:METRIC_METHODS[metric]};
  const currentValue = trendValue(records, metric);
  const previousValue = comparisonPeriod === "none" ? null : trendValue(comparison, metric);
  const detailScope = validateComparisonScope(records,comparison,metric);
  const stationCodes = new Set(records.map((record) => record.stationCode));
  const providers = new Set(records.map((record) => record.provider));
  const scopedHistory = history.filter((record) => stationCodes.has(record.stationCode) && providers.has(record.provider));
  const historyRows = historicalPeriodsThrough(scopedHistory, currentPeriod, 12).map((period) => ({ period, value: trendValue(scopedHistory.filter((record) => record.period === period), metric) }));
  const stationRows = records.map((record) => ({ record, value: trendValue([record], metric) })).sort((left, right) => metricCatalog[catalogMetric].direction === "lower-better" ? (right.value ?? -Infinity) - (left.value ?? -Infinity) : (left.value ?? Infinity) - (right.value ?? Infinity)).slice(0, 7);
  const sources = Array.from(new Set(records.map((record) => `${record.sourceFile} · ${record.sourceSheet}`)));
  return <div className="drawer-backdrop trend-drawer-backdrop" onMouseDown={onClose}><aside className="trend-detail-drawer kpi-detail-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={`${config.label} veri detayları`}>
    <div className="drawer-head"><div><span>{config.label.slice(0, 3).toLocaleUpperCase("tr-TR")}</span><div><small>KPI VERİ AYRINTISI · {formatPeriod(currentPeriod)}</small><h2>{config.label}</h2></div></div><button onClick={onClose} aria-label="Kapat"><X size={20} /></button></div>
    <div className="drawer-body">
      <section className="drawer-kpis"><div><span>{formatPeriod(currentPeriod)}</span><strong>{formatMetricValue(catalogMetric, currentValue)}</strong></div><div><span>{comparisonPeriod === "none" ? "Karşılaştırma" : formatPeriod(comparisonPeriod)}</span><strong>{comparisonPeriod === "none" ? "Karşılaştırma yok" : formatMetricValue(catalogMetric, previousValue)}</strong></div><div><span>Değişim</span><strong>{comparisonPeriod === "none" ? "Karşılaştırma yok" : detailScope.comparable ? formatMetricDelta(catalogMetric, currentValue, previousValue) : detailScope.reason}</strong></div></section>
      <section className="drawer-section kpi-definition"><SectionHeader eyebrow="TANIM VE FORMÜL" title="Nasıl hesaplanır?" /><p>{copy.definition}</p><code>{copy.formula}</code></section>
      <section className="drawer-section"><SectionHeader eyebrow="12 AYLIK TARİHÇE" title="Aylık değerler" /><div className="kpi-history-list">{historyRows.map((row) => <div key={row.period}><span>{formatPeriod(row.period)}</span><strong>{formatMetricValue(catalogMetric, row.value)}</strong><small>{row.period === currentPeriod ? "Ana Dönem" : row.period === comparisonPeriod ? "Karşılaştırma Dönemi" : ""}</small></div>)}</div></section>
      <section className="drawer-section"><SectionHeader eyebrow="İSTASYONLAR" title="Katkı ve performans görünümü" /><div className="kpi-station-list">{stationRows.map(({ record, value }) => <div key={record.id}><b>{record.stationCode}</b><span>{record.city ?? record.stationName}</span><strong>{formatMetricValue(catalogMetric, value)}</strong></div>)}</div></section>
      <section className="drawer-section source-lineage"><SectionHeader eyebrow="KAYNAK" title="Veri Kaynağı ve Hesaplama" /><dl><div><dt>Handling Provider</dt><dd>{Array.from(new Set(records.map((record) => record.provider))).join(", ")}</dd></div><div><dt>Kaynaklar</dt><dd>{sources.join("; ")}</dd></div><div><dt>Sütun Eşleştirme</dt><dd>{Array.from(new Set(records.map((record) => record.mappingVersion))).join(", ")}</dd></div><div><dt>Hesaplama</dt><dd>{Array.from(new Set(records.map((record) => record.calculationVersion))).join(", ")}</dd></div></dl></section>
    </div>
  </aside></div>;
}

function AirportMultiSelect({ entries, selectedCodes, onChange }: { entries: GeographyEntry[]; selectedCodes: string[]; onChange: (codes: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visible = entries.filter((entry) => [
    entry.stationCode, entry.iataCode, entry.airportName, entry.shortName,
    entry.cityName, entry.displayCity, entry.countryName, entry.countryNameEn,
  ].some((value) => value?.toLocaleLowerCase("tr-TR").includes(normalizedQuery)));
  const selected = selectedCodes.map((code) => entries.find((entry) => entry.stationCode === code)).filter((entry): entry is GeographyEntry => Boolean(entry));
  const label = selected.length === 0
    ? "Tüm havalimanları"
    : selected.length === 1
      ? `${selected[0].stationCode} — ${selected[0].shortName ?? selected[0].airportName ?? selected[0].stationCode}`
      : `${selected.length} seçili`;
  const toggle = (code: string) => onChange(selectedCodes.includes(code) ? selectedCodes.filter((item) => item !== code) : [...selectedCodes, code]);

  return (
    <div className="airport-multi-select">
      <button type="button" className={`airport-select-trigger ${open ? "open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{label}</span><ChevronDown size={15} />
      </button>
      {open && <div className="airport-select-menu">
        <label className="airport-search"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kod, ad, şehir veya ülke ara" /></label>
        <div className="airport-options">
          {visible.map((entry) => {
            const checked = selectedCodes.includes(entry.stationCode);
            const detail = `${entry.airportName ?? entry.stationCode}, ${entry.cityName ?? MISSING_VALUE_LABEL}, ${entry.countryName ?? MISSING_VALUE_LABEL}`;
            return <button type="button" key={entry.id} className={checked ? "selected" : ""} onClick={() => toggle(entry.stationCode)} title={detail}>
              <span className="airport-checkbox">{checked && <Check size={13} />}</span>
              <span><b>{entry.stationCode} — {entry.shortName ?? entry.airportName ?? entry.stationCode}</b><small>{entry.cityName} · {entry.countryName}</small></span>
            </button>;
          })}
          {!visible.length && <p>Aramayla eşleşen havalimanı bulunamadı.</p>}
        </div>
        <div className="airport-select-actions"><button type="button" onClick={() => onChange([])}>Havalimanı Seçimini Temizle</button><button type="button" onClick={() => setOpen(false)}>Seçimi Uygula</button></div>
      </div>}
    </div>
  );
}

type ActiveFilterSummaryProps = {
  geography: GeographyEntry[];
  selectedStations: string[];
  provider: string;
  period: string;
  comparisonPeriod: string;
  region: string;
  country: string;
  city: string;
  source: string;
  dataStatus: string;
  uploads: UploadEntry[];
  filteredCount: number;
  latestDataAt: number | null;
  savedViews: DashboardPayload["savedViews"];
  onApplySavedView: (id: string) => void;
  onRemoveStation: (code: string) => void;
  onClearProvider: () => void;
  onClearRegion: () => void;
  onClearCountry: () => void;
  onClearCity: () => void;
  onClearSource: () => void;
  onClearDataStatus: () => void;
  onClearAll: () => void;
  onSaveView: () => void;
};

function ActiveFilterSummary({
  geography, selectedStations, provider, period, comparisonPeriod, region, country, city, source, dataStatus,
  uploads, filteredCount, latestDataAt, savedViews, onApplySavedView, onRemoveStation, onClearProvider,
  onClearRegion, onClearCountry, onClearCity, onClearSource, onClearDataStatus, onClearAll, onSaveView,
}: ActiveFilterSummaryProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedAirports = selectedStations.map((code) => geography.find((entry) => entry.stationCode === code) ?? {
    id: code, stationCode: code, iataCode: code, airportName: null, shortName: null, displayCity: null,
    cityId: null, cityName: null, cityDisplayName: null, countryId: null, countryCode: null,
    countryName: null, countryNameEn: null, regionId: null, regionCode: null, regionName: null, activeStatus: "active",
  });
  const regionName = geography.find((entry) => entry.regionCode === region)?.regionName ?? region;
  const countryName = geography.find((entry) => entry.countryCode === country)?.countryName ?? country;
  const sourceName = uploads.find((entry) => entry.id === source)?.title || uploads.find((entry) => entry.id === source)?.fileName || source;
  const optionalFilters = [provider, region, country, city, source, dataStatus].filter((value) => !["Tümü", "Çoklu"].includes(value));
  const hasFilters = selectedStations.length > 0 || optionalFilters.length > 0;
  const compactCount = selectedStations.length || optionalFilters.length;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const airportChip = (airport: GeographyEntry) => (
    <span className="airport-filter-chip" key={airport.stationCode} title={`${airport.airportName ?? airport.stationCode}\n${airport.cityName ?? MISSING_VALUE_LABEL} · ${airport.countryName ?? MISSING_VALUE_LABEL} · ${airport.regionName ?? MISSING_VALUE_LABEL}`}>
      {airport.stationCode} · {airport.cityName ?? "Eşleşmemiş"}
    </span>
  );
  const geographicSummary = !["Tümü", "Çoklu"].includes(city) ? city
    : !["Tümü", "Çoklu"].includes(country) ? countryName
      : !["Tümü", "Çoklu"].includes(region) ? regionName : null;
  const fallbackSummary = selectedAirports.length === 1
    ? `${selectedAirports[0].stationCode} · ${selectedAirports[0].cityName ?? "Eşleşmemiş"}`
    : selectedAirports.length > 1
      ? `${selectedAirports.length} havalimanı seçili`
      : geographicSummary ?? (provider !== "Tümü" ? `Handling Provider · ${provider}` : `${compactCount} aktif filtre`);

  return (
    <div className="filter-summary-row" ref={popoverRef}>
      <div className="active-filter-summary" aria-label="Aktif filtre özeti">
        {selectedAirports.length > 0 && <div className="station-chip-set station-chip-wide">
          {selectedAirports.slice(0, 3).map(airportChip)}
          {selectedAirports.length > 3 && <button type="button" className="filter-overflow-chip" onClick={() => setOpen(true)}>+{selectedAirports.length - 3} daha</button>}
        </div>}
        {selectedAirports.length > 0 && <div className="station-chip-set station-chip-laptop">
          {selectedAirports.slice(0, 2).map(airportChip)}
          {selectedAirports.length > 2 && <button type="button" className="filter-overflow-chip" onClick={() => setOpen(true)}>+{selectedAirports.length - 2} daha</button>}
        </div>}
        {hasFilters && <button type="button" className="station-summary-chip" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="active-filter-popover">{fallbackSummary}</button>}
        {!selectedAirports.length && hasFilters && <button type="button" className="filter-scope-default" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="active-filter-popover">{fallbackSummary}</button>}
      </div>
      {open && <div className="active-filter-popover" id="active-filter-popover" role="dialog" aria-label="Seçili filtreler">
          <div className="filter-popover-heading"><div><small>AKTİF KAPSAM</small><h3>Seçili filtreler</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Kapat"><X size={16} /></button></div>
          <div className="filter-popover-body">
            {selectedAirports.length > 0 && <section><b>HAVALİMANI</b>{selectedAirports.map((airport) => <div className="filter-popover-item" key={airport.stationCode}><span><strong>{airport.stationCode} — {airport.shortName ?? airport.airportName ?? airport.stationCode}</strong><small>{airport.cityName ?? MISSING_VALUE_LABEL} · {airport.countryName ?? MISSING_VALUE_LABEL} · {airport.regionName ?? MISSING_VALUE_LABEL}</small></span><button type="button" onClick={() => onRemoveStation(airport.stationCode)} aria-label={`${airport.stationCode} seçimini kaldır`}><X size={14} /></button></div>)}</section>}
            {provider !== "Tümü" && <section><b>Handling Provider</b><div className="filter-popover-item"><span><strong>{provider}</strong></span><button type="button" onClick={onClearProvider} aria-label="Handling Provider filtresini kaldır"><X size={14} /></button></div></section>}
            {!selectedAirports.length && [region, country, city].some((value) => value !== "Tümü") && <section><b>COĞRAFİ BAĞLAM</b>{region !== "Tümü" && <div className="filter-popover-item"><span><strong>{regionName}</strong><small>Bölge</small></span><button type="button" onClick={onClearRegion} aria-label="Bölge filtresini kaldır"><X size={14} /></button></div>}{country !== "Tümü" && <div className="filter-popover-item"><span><strong>{countryName}</strong><small>Ülke</small></span><button type="button" onClick={onClearCountry} aria-label="Ülke filtresini kaldır"><X size={14} /></button></div>}{city !== "Tümü" && <div className="filter-popover-item"><span><strong>{city}</strong><small>Şehir</small></span><button type="button" onClick={onClearCity} aria-label="Şehir filtresini kaldır"><X size={14} /></button></div>}</section>}
            {source !== "Tümü" && <section><b>KAYNAK</b><div className="filter-popover-item"><span><strong>{sourceName}</strong></span><button type="button" onClick={onClearSource} aria-label="Kaynak filtresini kaldır"><X size={14} /></button></div></section>}
            {dataStatus !== "Tümü" && <section><b>VERİ DURUMU</b><div className="filter-popover-item"><span><strong>{dataStatus}</strong></span><button type="button" onClick={onClearDataStatus} aria-label="Veri durumu filtresini kaldır"><X size={14} /></button></div></section>}
            <section className="filter-context-grid"><div><b>DÖNEM</b><strong>{formatPeriod(period)}</strong></div><div><b>KARŞILAŞTIRMA</b><strong>{formatPeriod(comparisonPeriod)}</strong></div></section>
          </div>
          <div className="filter-popover-actions"><button type="button" onClick={onClearAll} disabled={!hasFilters}>Filtreleri Temizle</button><button type="button" onClick={() => setOpen(false)}>Kapat</button></div>
        </div>}
      <div className="filter-actions">
        <label className="saved-view-select"><select defaultValue="" onChange={(event) => onApplySavedView(event.target.value)} aria-label="Kayıtlı görünüm"><option value="">Kayıtlı görünüm</option>{savedViews.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? " · Varsayılan" : ""}</option>)}</select></label>
        <span className="record-count-chip"><Filter size={14} /> {filteredCount} kayıt</span>
        {hasFilters && <button type="button" className="clear-filter-button" onClick={onClearAll}>Filtreleri Temizle <X size={14} /></button>}
        <button type="button" className="save-view-button" onClick={onSaveView}><Save size={14} /><span className="save-view-full">Görünümü Kaydet</span><span className="save-view-short">Kaydet</span></button>
        <small className="latest-data-label">Son veri: {formatDateTime(latestDataAt)}</small>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("overview");
  const [workspaceId,setWorkspaceId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [records, setRecords] = useState<StationRecord[]>(seedRecords);
  const [comparisonRecords, setComparisonRecords] = useState<StationRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<StationRecord[]>(seedRecords);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>(initialIssues);
  const [providerFilter, setProviderFilter] = useState(() => readSavedFilter("provider", "Tümü"));
  const [stationFilter, setStationFilter] = useState(() => readSavedFilter("station", "Tümü"));
  const [periodFilter, setPeriodFilter] = useState(() => readSavedFilter("period", "2026-06"));
  const [comparisonPeriodFilter, setComparisonPeriodFilter] = useState("none");
  const [regionFilter, setRegionFilter] = useState("Tümü");
  const [countryFilter, setCountryFilter] = useState("Tümü");
  const [cityFilter, setCityFilter] = useState("Tümü");
  const [sourceFilter, setSourceFilter] = useState("Tümü");
  const [dataStatusFilter, setDataStatusFilter] = useState("Tümü");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stationDetail, setStationDetail] = useState<StationRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [overviewTrendMetric,setOverviewTrendMetric]=useState<OverviewTrendMetric>("otpOta");
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot | null>(null);
  const [session, setSession] = useState<DashboardPayload["session"] | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>(["2026-06"]);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [geography, setGeography] = useState<GeographyEntry[]>([]);
  const [latestDataAt, setLatestDataAt] = useState<number | null>(null);
  const [qualityScore, setQualityScore] = useState<DashboardPayload["quality"]>({ score: null, components: null });
  const [exportHistory, setExportHistory] = useState<DashboardPayload["exports"]>([]);
  const [auditRows, setAuditRows] = useState<DashboardPayload["audit"]>([]);
  const [savedViews, setSavedViews] = useState<DashboardPayload["savedViews"]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const autoImportStarted = useRef(false);
  const [importHistory, setImportHistory] = useState<ImportEntry[]>([
    {
      id: "IMP-202606-TGS-001",
      fileName: "Haziran 2026 TGS İstasyon Performans Karnesi(2).pdf",
      provider: "TGS",
      period: "2026-06",
      rows: 7,
      valid: 7,
      warnings: 3,
      errors: 0,
      duration: "Kaynak mutabakatı",
      createdAt: "05.08.2026 12:40",
      status: "Doğrulandı",
    },
  ]);

  useEffect(() => {
    localStorage.setItem("ajet-performance-filters", JSON.stringify({ provider: providerFilter, station: stationFilter, period: periodFilter }));
  }, [providerFilter, stationFilter, periodFilter]);

  useEffect(() => {
    const controller = new AbortController();
    let requestTimedOut = false;
    const timeoutId = window.setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, 15_000);
    const loadDashboard = async () => {
      setLoading(true);
      const params = new URLSearchParams({ resource: "dashboard", period: periodFilter, comparisonPeriod: comparisonPeriodFilter });
      if (workspaceId) params.set("workspaceId", workspaceId);
      if (providerFilter !== "Tümü") params.set("provider", providerFilter);
      if (!['Tümü', 'Çoklu'].includes(regionFilter)) params.set("region", regionFilter);
      if (!['Tümü', 'Çoklu'].includes(countryFilter)) params.set("country", countryFilter);
      if (!['Tümü', 'Çoklu'].includes(cityFilter)) params.set("city", cityFilter);
      if (stationFilter !== "Tümü") params.set("ports", stationFilter);
      if (sourceFilter !== "Tümü") params.set("sourceFile", sourceFilter);
      if (dataStatusFilter !== "Tümü") params.set("dataStatus", dataStatusFilter);
      try {
        const response = await fetch(`/api/platform?${params}`, { signal: controller.signal });
        const payload = await response.json() as DashboardPayload & { error?: string };
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (response.status === 428) { window.location.assign("/change-password"); return; }
        if (!response.ok) throw new Error(payload.error || "Veri alınamadı.");
        setRecords(payload.current.map(record=>({...record,title:record.sourceTitle})));
        setComparisonRecords(payload.comparison.map(record=>({...record,title:record.sourceTitle})));
        setHistoryRecords((payload.history ?? [...payload.current, ...payload.comparison]).map(record=>({...record,title:record.sourceTitle})));
        setSession(payload.session);
        setAvailablePeriods(Array.from(new Set([payload.mainPeriod, payload.comparisonPeriod, ...payload.periods])).filter((period) => /^\d{4}-\d{2}$/.test(period)));
        setUploads(payload.uploads);
        setGeography(payload.geography);
        setLatestDataAt(payload.latestDataAt);
        setQualityScore(payload.quality);
        setExportHistory(payload.exports);
        setAuditRows(payload.audit);
        setSavedViews(payload.savedViews);
        setQualityIssues((payload.mappingIssues ?? []).map((issue) => ({ level: "warning" as const, row: 0, field: issue.field, message: issue.message })));
        setImportHistory(payload.uploads.map((upload) => ({
          id: upload.id, fileName: upload.fileName, provider: upload.provider, period: upload.period,
          rows: upload.rowCount, valid: upload.validCount, warnings: upload.warningCount, errors: upload.errorCount,
          duration: `v${upload.versionNumber}`, createdAt: formatDateTime(upload.createdAt), status: upload.deletionStatus,
        })));
        setLoadError(null);
        if (payload.missingMockPeriods?.length && !autoImportStarted.current) {
          autoImportStarted.current = true;
          for (const mockPeriod of payload.missingMockPeriods) {
            const fileName = `AJet_TGS_${mockPeriod}_test_mock.xlsx`;
            const fileResponse = await fetch(`/mock-data/${fileName}`);
            if (!fileResponse.ok) throw new Error(`${fileName} fixture dosyası bulunamadı.`);
            const file = new File([await fileResponse.blob()], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const form = new FormData();
            form.set("file", file); form.set("provider", "TGS"); form.set("period", mockPeriod); form.set("isTestData", "true"); form.set("mode", "replace");
            const importResponse = await fetch("/api/platform", { method: "POST", body: form });
            const importResult = await importResponse.json() as { error?: string };
            if (!importResponse.ok) throw new Error(importResult.error || `${mockPeriod} dönemi yüklenemedi.`);
          }
          setToast(`${payload.missingMockPeriods.length} dönem veri yükleme hattından eklendi.`);
          setReloadKey((value) => value + 1);
        }
      } catch (error) {
        if (controller.signal.aborted && !requestTimedOut) return;
        setLoadError(requestTimedOut
          ? "Veri isteği zaman aşımına uğradı. Lütfen yeniden deneyin."
          : userFacingError(error, "Veriler yüklenirken bir sorun oluştu. Lütfen yeniden deneyin."));
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted || requestTimedOut) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [periodFilter, comparisonPeriodFilter, providerFilter, stationFilter, regionFilter, countryFilter, cityFilter, sourceFilter, dataStatusFilter, reloadKey, workspaceId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const providers = useMemo(() => Array.from(new Set([...records, ...comparisonRecords].map((record) => record.provider))).sort(), [records, comparisonRecords]);
  const periods = useMemo(() => [...availablePeriods].sort().reverse(), [availablePeriods]);
  const selectedStations = useMemo(() => stationFilter === "Tümü" ? [] : stationFilter.split(",").filter(Boolean), [stationFilter]);
  const regions = useMemo(() => Array.from(new Map(geography.filter((item) => item.regionCode && item.regionName).map((item) => [item.regionCode!, item.regionName!])).entries()), [geography]);
  const countries = useMemo(() => Array.from(new Map(geography.filter((item) => (['Tümü', 'Çoklu'].includes(regionFilter) || item.regionCode === regionFilter) && item.countryCode && item.countryName).map((item) => [item.countryCode!, item.countryName!])).entries()), [geography, regionFilter]);
  const cities = useMemo(() => Array.from(new Set(
    geography
      .filter((item) => (['Tümü', 'Çoklu'].includes(regionFilter) || item.regionCode === regionFilter) && (['Tümü', 'Çoklu'].includes(countryFilter) || item.countryCode === countryFilter) && item.cityName)
      .map((item) => item.cityName!),
  )).sort(), [geography, regionFilter, countryFilter]);
  const stations = useMemo(() => selectedStations.length ? geography : geography.filter((item) =>
    (['Tümü', 'Çoklu'].includes(regionFilter) || item.regionCode === regionFilter)
    && (['Tümü', 'Çoklu'].includes(countryFilter) || item.countryCode === countryFilter)
    && (['Tümü', 'Çoklu'].includes(cityFilter) || item.cityName === cityFilter),
  ), [geography, regionFilter, countryFilter, cityFilter, selectedStations]);

  const applyAirportSelection = (codes: string[]) => {
    const uniqueCodes = Array.from(new Set(codes));
    setStationFilter(uniqueCodes.length ? uniqueCodes.join(",") : "Tümü");
    const selectedPorts = uniqueCodes.map((code) => geography.find((item) => item.stationCode === code)).filter((item): item is GeographyEntry => Boolean(item));
    if (!selectedPorts.length) {
      setRegionFilter("Tümü"); setCountryFilter("Tümü"); setCityFilter("Tümü");
      return;
    }
    const context = (values: Array<string | null>) => {
      const distinct = Array.from(new Set(values.filter((value): value is string => Boolean(value))));
      return distinct.length === 1 ? distinct[0] : distinct.length > 1 ? "Çoklu" : "Tümü";
    };
    setRegionFilter(context(selectedPorts.map((port) => port.regionCode)));
    setCountryFilter(context(selectedPorts.map((port) => port.countryCode)));
    setCityFilter(context(selectedPorts.map((port) => port.cityName)));
  };

  const filteredRecords = useMemo(() => records.filter((record) => {
    return (providerFilter === "Tümü" || record.provider === providerFilter)
      && (!selectedStations.length || selectedStations.includes(record.stationCode))
      && (!periodFilter || record.period === periodFilter)
      && (dataStatusFilter === "Tümü" || record.validationStatus === dataStatusFilter);
  }), [records, providerFilter, selectedStations, periodFilter, dataStatusFilter]);

  const activeAdvancedCount = [regionFilter, countryFilter, cityFilter, sourceFilter, dataStatusFilter]
    .filter((value) => value !== "Tümü").length;

  const currentTitle = navItems.find((item) => item.key === view)?.label ?? "Genel Bakış";

  const clearFilters = () => {
    setProviderFilter("Tümü");
    setStationFilter("Tümü");
    setPeriodFilter(periods[0] ?? "2026-06");
    setComparisonPeriodFilter("none");
    setRegionFilter("Tümü"); setCountryFilter("Tümü"); setCityFilter("Tümü"); setSourceFilter("Tümü"); setDataStatusFilter("Tümü");
    setToast("Filtreler temizlendi");
  };

  const openStation = (record: StationRecord) => {
    applyAirportSelection([record.stationCode]);
    setStationDetail(record);
  };

  const applySavedView = (id: string) => {
    const selected = savedViews.find((item) => item.id === id);
    if (!selected) return;
    try {
      const filters = JSON.parse(selected.filterState) as Record<string, string>;
      if (filters.periodFilter) setPeriodFilter(filters.periodFilter);
      if (filters.comparisonPeriodFilter) setComparisonPeriodFilter(filters.comparisonPeriodFilter);
      if (filters.providerFilter) setProviderFilter(filters.providerFilter);
      if (filters.regionFilter) setRegionFilter(filters.regionFilter);
      if (filters.countryFilter) setCountryFilter(filters.countryFilter);
      if (filters.cityFilter) setCityFilter(filters.cityFilter);
      if (filters.stationFilter) setStationFilter(filters.stationFilter);
      if (filters.sourceFilter) setSourceFilter(filters.sourceFilter);
      if (filters.dataStatusFilter) setDataStatusFilter(filters.dataStatusFilter);
      setToast(`${selected.name} görünümü uygulandı`);
    } catch { setToast("Kayıtlı görünüm okunamadı"); }
  };

  const saveCurrentView = () => {
    const name = window.prompt("Görünüm adı");
    if (!name) return;
    fetch("/api/platform", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_view",
        name,
        filters: { periodFilter, comparisonPeriodFilter, providerFilter, regionFilter, countryFilter, cityFilter, stationFilter, sourceFilter, dataStatusFilter },
      }),
    }).then(() => { setToast("Filtre görünümü kaydedildi"); setReloadKey((value) => value + 1); });
  };

  const platformUrl = `/api/platform${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`;
  const recordExport = (type: "pdf" | "excel" | "csv", fileName:string, sizeBytes?:number, snapshot?:ReportSnapshot) => fetch(platformUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"export",type,fileName,sizeBytes,records:type === "pdf" ? undefined : filteredRecords,reportSnapshot:snapshot,scope:snapshot?.scope,filters:{periodFilter,comparisonPeriodFilter,providerFilter,regionFilter,countryFilter,cityFilter,stationFilter,sourceFilter,dataStatusFilter}})}).then(response=>{if(response.ok)setReloadKey(value=>value+1);}).catch(()=>setToast("Rapor geçmişi kaydedilemedi."));
  const printReport = (scope:ReportScope = "summary", scopedStation?:StationRecord) => {
    const scopedRecords = scopedStation ? [scopedStation] : filteredRecords;
    const codes = new Set(scopedRecords.map(record=>`${record.provider}|${record.stationCode}`));
    const snapshot = captureReportSnapshot<ReportSnapshot>({scope,generatedAt:Date.now(),trendMetric:overviewTrendMetric,records:scopedRecords.map(record=>({...record})),comparison:comparisonPeriodFilter === "none" ? [] : (scopedStation ? comparisonRecords.filter(record=>codes.has(`${record.provider}|${record.stationCode}`)) : comparisonRecords).map(record=>({...record})),history:historyRecords.filter(record=>codes.has(`${record.provider}|${record.stationCode}`)).map(record=>({...record})),issues:qualityIssues.map(issue=>({...issue})),filters:{period:periodFilter,comparisonPeriod:comparisonPeriodFilter,provider:providerFilter,region:regionFilter,country:countryFilter,city:cityFilter,stations:scopedStation?[scopedStation.stationCode]:[...selectedStations],source:sourceFilter,dataStatus:dataStatusFilter}});
    setReportSnapshot(snapshot);
    void recordExport("pdf",`AJet_${periodFilter}_${scope}.pdf`,undefined,snapshot);
    setToast("PDF yazdırma için hazırlandı. Kaydetme sonucu tarayıcı tarafından doğrulanmaz.");
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{void document.fonts.ready.then(()=>window.print());}));
  };

  const exportCsv = () => {
    const rows = filteredRecords.map((record) => ({
      "Veri Kümesi Başlığı": record.title || record.sourceFile,
      "Handling Provider": record.provider,
      Dönem: record.period,
      İstasyon: record.stationCode,
      Havalimanı: record.airportName ?? record.stationName,
      Şehir: record.city ?? "",
      Ülke: record.country ?? "",
      Bölge: record.region ?? "",
      Uçuş: record.flights,
      "Yolcu Sayısı": record.passengers ?? "",
      "Extgoms–Okunmayan Doküman Sayısı": record.unreadDocuments ?? "",
      "Vize Pasaport Doküman Aksaklıkları": record.visaPassportIssues ?? "",
      "Emniyet Raporlaması": record.safetyReports ?? "",
      "Hasar Raporlama GSE": record.gseDamageReports ?? "",
      "Dijital Biniş Kartı Kullanım Oranı (%)": record.digitalBoardingRatio == null ? "" : record.digitalBoardingRatio * 100,
      "Doküman Hata Oranı (%)": record.docRatePct ?? "",
      OTP: record.otp,
      OTA: record.ota,
      Tehir: record.delayMinutes ?? "",
      Hasarlı_Bagaj_Yüzde: record.damagedRate === null ? "" : record.damagedRate * 100,
      Kayıp_Bagaj_Yüzde: record.lostRate === null ? "" : record.lostRate * 100,
      Safety: record.safetyPct ?? "",
      Non_Safety: record.nonSafetyPct ?? "",
      Şikâyet_Dönüş_Süresi_Gün: record.complaintDays ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
    const content = `\uFEFF${csv}`;
    downloadBlob(content, `TGS_${periodFilter}_Filtreli_Performans.csv`, "text/csv;charset=utf-8");
    void recordExport("csv", `TGS_${periodFilter}_Filtreli_Performans.csv`, new TextEncoder().encode(content).byteLength);
    setToast("Filtrelenmiş CSV indirildi");
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const rows = filteredRecords.map((record) => ({
      "Veri Kümesi Başlığı": record.title || record.sourceFile,
      "Handling Provider": record.provider,
      DÖNEM: record.period,
      İSTASYON: record.stationCode,
      HAVALİMANI: record.airportName ?? record.stationName,
      ŞEHİR: record.city,
      ÜLKE_KODU: record.countryCode,
      ÜLKE: record.country,
      BÖLGE: record.region,
      TOPLAM_UÇUŞ: record.flights,
      "Yolcu Sayısı": record.passengers,
      "Extgoms–Okunmayan Doküman Sayısı": record.unreadDocuments,
      "Vize Pasaport Doküman Aksaklıkları": record.visaPassportIssues,
      "Hasar Raporlama GSE": record.gseDamageReports,
      "Dijital Biniş Kartı Kullanım Oranı (%)": record.digitalBoardingRatio == null ? null : record.digitalBoardingRatio * 100,
      "Doküman Hata Oranı (%)": record.docRatePct,
      OTP: record.otp,
      OTA: record.ota,
      TOPLAM_TEHİR: record.delayMinutes,
      HASARLI_BAGAJ_YÜZDE: record.damagedRate === null ? null : record.damagedRate * 100,
      KAYIP_BAGAJ_YÜZDE: record.lostRate === null ? null : record.lostRate * 100,
      SAFETY_YÜZDE: record.safetyPct,
      NON_SAFETY_YÜZDE: record.nonSafetyPct,
      "Emniyet Raporlaması": record.safetyReports,
      ŞİKÂYET_DÖNÜŞ_SÜRESİ_GÜN: record.complaintDays,
      VERİ_DURUMU: record.validationStatus === "valid" ? "Doğrulandı" : record.validationStatus === "warning" ? "Uyarı Var" : "Geçersiz Değer",
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Filtreli Performans");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    downloadBlob(bytes, `TGS_${periodFilter}_Filtreli_Performans.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    void recordExport("excel", `TGS_${periodFilter}_Filtreli_Performans.xlsx`, bytes.byteLength);
    setToast("Filtrelenmiş Excel indirildi");
  };

  return (
    <>
      <div className="app-shell">
        <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
          <div className="brand-block">
            <div className="brand-logo-wrap">
              <img src="/ajet-logo.png" alt="AJet" />
            </div>
            {!collapsed && <div className="brand-subtitle">İstasyon performansı</div>}
          </div>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><X size={20} /></button>
          <nav className="side-nav" aria-label="Ana navigasyon">
            {(["ANALİZ", "VERİ", "SİSTEM"] as const).map((group) => {
              const visibleItems = navItems.filter((item) => item.group === group).filter((item) => {
                if (item.key === "management" || item.key === "admin") return session?.user.isAdmin;
                if (item.key === "upload") return !session || session.permissions.includes("upload.create");
                if (item.key === "reports") return !session || session.permissions.some((permission) => permission.startsWith("export."));
                return true;
              });
              if (!visibleItems.length) return null;
              return <div className="nav-section" key={group}>
                {!collapsed && <span className="nav-section-label">{group}</span>}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => { setView(item.key); setMobileOpen(false); }} title={item.label}>
                    <Icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.key === "quality" && <b>{qualityIssues.filter((issue) => issue.level !== "info").length}</b>}
                  </button>;
                })}
              </div>;
            })}
          </nav>
          <div className="sidebar-foot">
            {!collapsed && (
              <div className="data-status">
                <span className="live-dot" />
                <div><strong>{loadError ? "Bağlantı uyarısı" : loading ? "Veri yenileniyor" : "Veri güncel"}</strong><small>{formatDateTime(latestDataAt)}</small></div>
              </div>
            )}
            <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Menüyü daralt</span></>}
            </button>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="topbar-title">
              <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç"><Menu size={21} /></button>
              <div><span>Yer İşletme Başkanlığı</span><h1>{currentTitle}</h1></div>
            </div>
            <div className="topbar-actions">
              {(session?.workspaces?.length ?? 0)>1 && <select className="workspace-switch" aria-label="Çalışma Alanı" value={workspaceId || session?.user.workspaceId || ""} onChange={event=>{setWorkspaceId(event.target.value);setSourceFilter("Tümü");setStationFilter("Tümü");setComparisonPeriodFilter("none");}}>{session?.workspaces?.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>}
              <button className="quick-pdf" onClick={()=>printReport("full")}><FileOutput size={17}/> Master PDF</button>
              <button className="quick-pdf" onClick={() => printReport("summary")}><FileOutput size={17} /> Hızlı PDF</button>
              <button className="profile-button" onClick={() => { fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.assign("/login")); }} title="Oturumu kapat">
                <span>{initials(session?.user.fullName ?? "AJet Kullanıcı")}</span>
                <div><strong>{session?.user.fullName ?? "AJet Kullanıcı"}</strong><small>{roleLabel(session?.user.roleCode ?? "analyst")}</small></div>
                <ChevronDown size={16} />
              </button>
            </div>
          </header>

          {!(["admin", "upload"] as ViewKey[]).includes(view) && <section className={`filterbar ${advancedOpen ? "advanced-visible" : ""}`}>
            <div className="filter-main-row">
              <div className="filter-group primary-filters">
              <label><span>Dönem</span><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>{periods.map((period) => <option key={period} value={period}>{formatPeriod(period)}</option>)}</select></label>
              <label><span>Karşılaştırma</span><select value={comparisonPeriodFilter} onChange={(event) => setComparisonPeriodFilter(event.target.value)}><option value="none">Karşılaştırma yok</option>{periods.filter((period) => period !== periodFilter).map((period) => <option key={period} value={period}>{formatPeriod(period)}</option>)}</select></label>
              <label><span lang="en">Handling Provider</span><select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}><option>Tümü</option>{providers.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
              <label className="airport-filter-label"><span>Havalimanı</span><AirportMultiSelect entries={stations} selectedCodes={selectedStations} onChange={applyAirportSelection} /></label>
              </div>
              <button type="button" className={`advanced-filter-button ${advancedOpen ? "active" : ""}`} onClick={() => setAdvancedOpen((value) => !value)}><Settings2 size={15} /> Gelişmiş filtreler {activeAdvancedCount > 0 && <b>{activeAdvancedCount}</b>}<ChevronDown size={14} /></button>
            </div>
            {advancedOpen && <div className="advanced-filter-panel">
              <div className="filter-group advanced-filters">
                <label><span>Bölge</span><select value={regionFilter} onChange={(event) => { setRegionFilter(event.target.value); setCountryFilter("Tümü"); setCityFilter("Tümü"); setStationFilter("Tümü"); }}><option>Tümü</option>{regionFilter === "Çoklu" && <option value="Çoklu">Çoklu</option>}{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
                <label><span>Ülke</span><select value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setCityFilter("Tümü"); setStationFilter("Tümü"); }}><option>Tümü</option>{countryFilter === "Çoklu" && <option value="Çoklu">Çoklu</option>}{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
                <label><span>Şehir</span><select value={cityFilter} onChange={(event) => { setCityFilter(event.target.value); setStationFilter("Tümü"); }}><option>Tümü</option>{cityFilter === "Çoklu" && <option value="Çoklu">Çoklu</option>}{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
                <label><span>Kaynak dosya</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>Tümü</option>{uploads.filter((item) => !item.deletedAt).map((upload) => <option key={upload.id} value={upload.id}>{upload.title || upload.fileName}</option>)}</select></label>
                <label><span>Veri Durumu</span><select value={dataStatusFilter} onChange={(event) => setDataStatusFilter(event.target.value)}><option>Tümü</option><option value="valid">Doğrulandı</option><option value="warning">Uyarı Var</option><option value="error">Geçersiz Değer</option></select></label>
              </div>
            </div>}
            <ActiveFilterSummary
              geography={geography}
              selectedStations={selectedStations}
              provider={providerFilter}
              period={periodFilter}
              comparisonPeriod={comparisonPeriodFilter}
              region={regionFilter}
              country={countryFilter}
              city={cityFilter}
              source={sourceFilter}
              dataStatus={dataStatusFilter}
              uploads={uploads}
              filteredCount={filteredRecords.length}
              latestDataAt={latestDataAt}
              savedViews={savedViews}
              onApplySavedView={applySavedView}
              onRemoveStation={(code) => applyAirportSelection(selectedStations.filter((item) => item !== code))}
              onClearProvider={() => setProviderFilter("Tümü")}
              onClearRegion={() => { setRegionFilter("Tümü"); setCountryFilter("Tümü"); setCityFilter("Tümü"); }}
              onClearCountry={() => { setCountryFilter("Tümü"); setCityFilter("Tümü"); }}
              onClearCity={() => setCityFilter("Tümü")}
              onClearSource={() => setSourceFilter("Tümü")}
              onClearDataStatus={() => setDataStatusFilter("Tümü")}
              onClearAll={clearFilters}
              onSaveView={saveCurrentView}
            />
          </section>}

          <div className="content-area">
            {loading ? <DashboardSkeleton /> : <>
            {loadError && <div className="quality-callout warning"><AlertCircle size={20} /><div><strong>Veriler yüklenemedi</strong><p>{loadError} Mevcut görünüm son kullanılabilir veriyi gösteriyor.</p></div></div>}
            {!loading && !loadError && filteredRecords.length === 0 && view !== "upload" && view !== "reports" && view !== "management" && view !== "admin" && <div className="panel empty-state"><FileSpreadsheet size={30} /><h2>Seçilen filtrelerle eşleşen veri bulunamadı.</h2><p>Filtreleri değiştirerek yeniden deneyebilir veya yeni bir Excel dosyası yükleyebilirsiniz.</p><button className="primary-button" onClick={() => setView("upload")}>Veri Yükle <ArrowRight size={16} /></button></div>}
            {view === "overview" && filteredRecords.length > 0 && <Overview trendMetric={overviewTrendMetric} onTrendMetric={setOverviewTrendMetric} records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} setView={setView} />}
            {view === "stations" && <StationComparison records={filteredRecords} comparison={comparisonRecords} onStation={openStation} exportExcel={exportExcel} />}
            {view === "ontime" && <OnTimePerformance records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} />}
            {view === "delay" && <DelayAnalysis records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} />}
            {view === "baggage" && <BaggagePerformance records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} />}
            {view === "documents" && <DocumentPerformance records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} />}
            {view === "safety" && <SafetyPerformance records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} />}
            {view === "complaints" && <ComplaintPerformance records={filteredRecords} comparison={comparisonRecords} history={historyRecords} currentPeriod={periodFilter} comparisonPeriod={comparisonPeriodFilter} onStation={openStation} />}
            {view === "quality" && <DataQuality records={filteredRecords} issues={qualityIssues} history={importHistory} quality={qualityScore} setView={setView} />}
            {view === "upload" && (
              <DatasetUpload uploads={uploads} workspaceId={workspaceId || session?.user.workspaceId} onChanged={()=>setReloadKey(value=>value+1)} setToast={setToast} onOverview={()=>setView("overview")} />
            )}
            {view === "reports" && <ReportCenter records={filteredRecords} exports={exportHistory} printReport={printReport} exportCsv={exportCsv} exportExcel={exportExcel} onChanged={() => setReloadKey((value) => value + 1)} setToast={setToast} />}
            {view === "management" && session?.user.isAdmin && <Management history={importHistory} session={session.user} audit={auditRows} onChanged={() => setReloadKey((value) => value + 1)} />}
            {view === "admin" && session?.user.isAdmin && <AdminPanel onChanged={() => setReloadKey((value) => value + 1)} onToast={setToast} />}
            </>}
          </div>
        </main>
      </div>

      {stationDetail && <StationDrawer record={stationDetail} onClose={() => setStationDetail(null)} onPrint={() => printReport("summary", stationDetail)} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
      {reportSnapshot && <PrintReport snapshot={reportSnapshot} />}
    </>
  );
}

function Overview({ trendMetric,onTrendMetric,records, comparison, history, currentPeriod, comparisonPeriod, onStation, setView }: { trendMetric:OverviewTrendMetric;onTrendMetric:(metric:OverviewTrendMetric)=>void;records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void; setView: (view: ViewKey) => void }) {
  const [selectedKpi, setSelectedKpi] = useState<TrendMetric | null>(null);
  const comparisonEnabled = comparisonPeriod !== "none" && comparison.length > 0;
  const makeComparison = (metric: TrendMetric, previousValue: number | null, currentValue: number | null, previous: string, current: string, delta: string) => {
    if (!comparisonEnabled) return undefined;
    const scope = validateComparisonScope(records, comparison, metric);
    return { period: formatPeriod(comparisonPeriod), currentPeriod: formatPeriod(currentPeriod), previous, current, previousValue, currentValue, delta, status: metricDeltaStatus(trendMetricToCatalog[metric], currentValue, previousValue), comparable: scope.comparable, reason: scope.reason };
  };
  const chartData: VisualizationDatum[] = records.map((record) => ({
    id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.otp, value2: record.ota,
    previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.otp,
    target: 90, volume: record.flights, volumeLabel: "Uçuş",
  })).sort((a, b) => (a.value ?? 100) - (b.value ?? 100));
  const insights = buildStationInsights(records);
  const stationCodes = new Set(records.map((record) => record.stationCode));
  const providers = new Set(records.map((record) => record.provider));
  const scopedHistory = history.filter((record) => stationCodes.has(record.stationCode) && providers.has(record.provider));
  const sparklineFor = (metric: TrendMetric) => {
    const periods = historicalPeriodsThrough(scopedHistory, currentPeriod, 12);
    return {
      metric: trendMetricToCatalog[metric],
      periods,
      values: periods.map((period) => historicalMetricValue(scopedHistory.filter((record) => record.period === period), records, metric)),
    };
  };

  return (
    <div className="page-stack">
      <section className={`metrics-grid executive-kpis ${comparisonEnabled ? "comparison-active" : ""}`} aria-label="Yönetici KPI özeti">
        {MAIN_METRICS.map(metric=>{const value=aggregateMetric(records,metric);const previous=aggregateMetric(comparison,metric);const icon=metric === "flights"?Plane:metric === "passengers"?UserRound:["damaged","lost"].includes(metric)?Luggage:["safety","safetyReports","gseDamageReports"].includes(metric)?ShieldCheck:["documents","visaPassportIssues","unreadDocuments"].includes(metric)?FileText:metric === "complaint"?MessageSquareText:metric === "delay"?TimerReset:Target;return <MetricCard key={metric} label={KPI_LABELS[metric as keyof typeof KPI_LABELS] ?? metricCatalog[metric].label} value={formatMetricValue(metric,value)} unit={value !== null && metricCatalog[metric].unit === "count" ? metric === "flights" ? "uçuş" : metric === "passengers" ? "yolcu" : "adet" : undefined} priority={MAIN_METRICS.indexOf(metric)<4?"primary":"secondary"} comparison={makeComparison(metric,previous,value,formatMetricValue(metric,previous),formatMetricValue(metric,value),formatMetricDelta(metric,value,previous))} sparkline={sparklineFor(metric)} coverage={`${metricCoverage(records,metric)}/${records.length} istasyon`} detail={METRIC_METHODS[metric]} icon={icon} tone={metric === "flights" || metric === "complaint" ? "navy" : "blue"} onOpen={()=>setSelectedKpi(metric)} />;})}
      </section>

      {comparisonEnabled && <PeriodComparisonChart current={records} comparison={comparison} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} onStation={onStation} />}

      <section className="panel chart-panel overview-dual-trend">
        <SectionHeader eyebrow="12 AYLIK PERFORMANS" title={`12 Aylık ${trendLabel(trendMetric)} Performansı`} action={<button className="text-button" onClick={() => setView("ontime")}>Zamanında performans <ArrowRight size={15} /></button>} />
        <label className="overview-trend-selector"><span>Metrik</span><select aria-label="Ana sayfa trend metriği" value={trendMetric} onChange={event=>onTrendMetric(event.target.value as OverviewTrendMetric)}><option value="otpOta">OTP / OTA</option>{OVERVIEW_TREND_METRICS.map(metric=><option key={metric} value={metric}>{trendLabel(metric)}</option>)}</select></label>
        <OverviewTrend records={records} history={scopedHistory} period={currentPeriod} comparisonPeriod={comparisonPeriod} selection={trendMetric} onSelect={setSelectedKpi}/>
      </section>

      <section className="dashboard-grid two-one">
        <article className="panel chart-panel">
          <SectionHeader eyebrow="ZAMANINDA PERFORMANS" title="OTP ve OTA İstasyon Karşılaştırması" action={<button className="text-button" onClick={() => setView("ontime")}>İstasyon Detayını Gör <ArrowRight size={15} /></button>} />
          <p className="chart-description">İstasyonlar OTP değeri düşükten yükseğe sıralanır. Değerler grafikte doğrudan gösterilir.</p>
          <VisualizationEngine metric="otp" secondaryMetric="ota" data={chartData} requestedVariant="dumbbell" height="large" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} />
        </article>

        <article className="panel risk-panel">
          <SectionHeader eyebrow="ŞEFFAF SEÇİM KURALLARI" title="Öne Çıkan İstasyonlar" />
          <div className="risk-list">
            {insights.map((insight, index) => (
              <button key={`${insight.record.id}-${insight.metric}`} onClick={() => onStation(insight.record)}>
                <span className="rank">0{index + 1}</span>
                <div><strong>{insight.record.stationCode} — {insight.record.city ?? insight.record.stationName}</strong><small>{insight.reason}</small></div>
                <div className="risk-metric"><b>{insight.metric}</b><small>Doğrulanmış kural</small></div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="risk-note"><Info size={16} /><p>Her istasyon yalnız görünür KPI kurallarıyla seçilir. Birleşik veya açıklanamayan risk puanı kullanılmaz.</p></div>
        </article>
      </section>
      {selectedKpi && <KpiDetailDrawer metric={selectedKpi} records={records} comparison={comparison} history={scopedHistory} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} onClose={() => setSelectedKpi(null)} />}
    </div>
  );
}

function StationComparison({ records, comparison, onStation, exportExcel }: { records: StationRecord[]; comparison: StationRecord[]; onStation: (record: StationRecord) => void; exportExcel: () => void }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof StationRecord>("flights");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const visible = useMemo(() => records
    .filter((record) => `${record.stationCode} ${record.stationName}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")))
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === "number" && typeof bv === "number") return sortDirection === "asc" ? av - bv : bv - av;
      return String(av).localeCompare(String(bv)) * (sortDirection === "asc" ? 1 : -1);
    }), [records, query, sortKey, sortDirection]);

  const sort = (key: keyof StationRecord) => {
    if (key === sortKey) setSortDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("desc"); }
  };
  const heatmapMetrics: Array<{key:MetricKey;label:string;value:(record:StationRecord)=>number|null}> = [...MAIN_METRICS,"nonSafety" as const].map(key=>({key,label:KPI_LABELS[key as keyof typeof KPI_LABELS] ?? metricCatalog[key].label,value:record=>metricRecordValue(record,key)}));
  const comparisonByStation = new Map(comparison.map((record) => [`${record.provider}|${record.stationCode}`, record]));
  const metricAverages = new Map(heatmapMetrics.map((metric) => { const values = records.map(metric.value).filter((value): value is number => value !== null); return [metric.key, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null]; }));
  const heatStatus = (metric: MetricKey, value: number | null) => {
    if (value === null) return "missing";
    const targeted = metricStatus(metric, value);
    if (targeted !== "neutral") return targeted;
    const average = metricAverages.get(metric);
    if (average === null || average === undefined) return "neutral";
    const good = metricCatalog[metric].direction === "lower-better" ? value <= average : value >= average;
    return good ? "good" : "warning";
  };

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>DETAY TABLO</span><h2>İstasyon Performans Matrisi</h2><p>Seçili kapsam için istasyon performansını karşılaştırın ve sıralayın.</p></div><button className="secondary-button" onClick={exportExcel}><Download size={16} /> Excel’e Aktar</button></div>
      <article className="panel performance-heatmap"><SectionHeader eyebrow="PERFORMANS MATRİSİ" title="İstasyon × KPI Matrisi" /><p className="chart-description">Ok, karşılaştırma dönemine göre yönü; renk, KPI tanımındaki performans durumunu gösterir.</p><div className="heatmap-scroll"><div className="heatmap-grid" style={{ gridTemplateColumns: `82px repeat(${heatmapMetrics.length}, minmax(82px, 1fr))` }}><b className="heatmap-corner">İstasyon</b>{heatmapMetrics.map((metric) => <b key={metric.key}>{metric.label}</b>)}{visible.map((record) => <Fragment key={record.id}><button type="button" className="heatmap-station" onClick={() => onStation(record)}>{record.stationCode}<small>{record.city ?? record.stationName}</small></button>{heatmapMetrics.map((metric) => { const value = metric.value(record); const previous = comparisonByStation.get(`${record.provider}|${record.stationCode}`); const previousValue = previous ? metric.value(previous) : null; const delta = value !== null && previousValue !== null ? value - previousValue : null; const numerator = metric.key === "damaged" ? record.damagedCount : metric.key === "lost" ? record.lostCount : metric.key === "safety" ? record.safetyCount : metric.key === "nonSafety" ? record.nonSafetyCount : null; const denominator = ["damaged", "lost"].includes(metric.key) ? record.passengers : ["safety", "nonSafety"].includes(metric.key) ? record.flights : null; return <button type="button" key={metric.key} className={`heatmap-cell ${heatStatus(metric.key, value)}`} onClick={() => onStation(record)}><strong>{formatMetricValue(metric.key, value)}</strong><small title={delta === null ? MISSING_VALUE_TOOLTIP : undefined}>{delta === null ? MISSING_VALUE_LABEL : delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {delta === null ? "" : "karşılaştırma"}</small><span className="heatmap-hover-tooltip chart-tooltip engine-tooltip" role="tooltip"><strong>{record.stationCode} — {record.airportName ?? record.stationName}</strong><small>{record.city ?? MISSING_VALUE_LABEL} · {record.country ?? MISSING_VALUE_LABEL}</small><div>Handling Provider: <b>{record.provider}</b></div><div>Dönem: <b>{formatPeriod(record.period)}</b></div><div>{metric.label}: <b>{formatMetricValue(metric.key, value)}</b></div><div>Karşılaştırma: <b>{formatMetricValue(metric.key, previousValue)}</b></div><div>Değişim: <b>{formatMetricDelta(metric.key, value, previousValue)}</b></div>{metricCatalog[metric.key].target !== undefined && <div>Hedef: <b>{formatMetricValue(metric.key, metricCatalog[metric.key].target)}</b></div>}{numerator !== null && <div>Pay: <b>{formatNumber(numerator)}</b></div>}{denominator !== null && <div>Payda: <b>{formatNumber(denominator)}</b></div>}<div className="tooltip-source">Kaynak: <b>{record.sourceFile} · {record.sourceSheet} · satır {record.sourceRow}</b></div></span></button>; })}</Fragment>)}</div></div></article>
      <article className="panel table-panel">
        <div className="table-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İstasyon ara" /></label>
          <div><span className="result-count">{visible.length} istasyon</span><button className="ghost-button"><Settings2 size={16} /> Sütunlar</button></div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr className="table-groups"><th colSpan={4}>KİMLİK</th><th colSpan={2}>HACİM</th><th colSpan={2}>ZAMAN</th><th colSpan={2}>BAGAJ</th><th colSpan={3}>OPERASYON</th><th>MÜŞTERİ</th><th>KALİTE</th><th /></tr><tr>
              <th className="sticky">İstasyon</th><th>Şehir</th><th>Ülke</th><th lang="en">Handling Provider</th>
              {["flights", "passengers", "otp", "ota", "damagedRate", "lostRate", "delayMinutes", "safetyPct", "nonSafetyPct", "complaintDays"].map((key) => <th key={key}><button onClick={() => sort(key as keyof StationRecord)}>{({ flights: "Uçuş", passengers: "Yolcu", otp: "OTP", ota: "OTA", delayMinutes: "Tehir", damagedRate: "Hasarlı Bagaj %", lostRate: "Kayıp Bagaj %", safetyPct: "Safety", nonSafetyPct: "Safety Dışı", complaintDays: "Şikâyet" } as Record<string, string>)[key]} {sortKey === key && (sortDirection === "desc" ? "↓" : "↑")}</button></th>)}
              <th>Durum</th><th />
            </tr></thead>
            <tbody>{visible.map((record) => (
              <tr key={record.id} onClick={() => onStation(record)}>
                <td className="sticky station-cell"><b>{record.stationCode}</b><span>{record.stationName}<small>{record.provider}</small></span></td>
                <td title={record.city ? undefined : MISSING_VALUE_TOOLTIP}>{record.city ?? MISSING_VALUE_LABEL}</td><td title={record.country ? undefined : MISSING_VALUE_TOOLTIP}>{record.country ?? MISSING_VALUE_LABEL}</td><td>{record.provider}</td>
                <td>{formatNumber(record.flights)}</td><td>{formatNumber(record.passengers)}</td>
                <td><span className={`heat ${record.otp && record.otp >= 90 ? "good" : "watch"}`}>{formatRate(record.otp, 0)}</span></td>
                <td><span className={`heat ${record.ota && record.ota >= 90 ? "good" : "watch"}`}>{formatRate(record.ota, 0)}</span></td>
                <td>{formatPercentRatio(record.damagedRate)}</td><td>{formatPercentRatio(record.lostRate)}</td><td title={record.delayMinutes === null ? MISSING_VALUE_TOOLTIP : undefined}>{record.delayMinutes === null ? MISSING_VALUE_LABEL : `${formatNumber(record.delayMinutes)} dk`}</td><td>{formatRate(record.safetyPct, 2)}</td><td>{formatRate(record.nonSafetyPct, 2)}</td><td title={record.complaintDays === null ? MISSING_VALUE_TOOLTIP : undefined}>{record.complaintDays === null ? MISSING_VALUE_LABEL : `${formatNumber(record.complaintDays, 2)} gün`}</td>
                <td><StatusPill status={record.validationStatus} /></td><td><ChevronRight size={17} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="table-footer"><span>1–{visible.length} / {visible.length}</span><div><button disabled><ChevronLeft size={16} /></button><button className="active">1</button><button disabled><ChevronRight size={16} /></button></div></div>
      </article>
    </div>
  );
}

function OnTimePerformance({ records, comparison, history, currentPeriod, comparisonPeriod, onStation }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const data = records.map((record) => ({ ...record, name: record.stationCode, gap: (record.ota ?? 0) - (record.otp ?? 0) }));
  const engineData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.otp, value2: record.ota, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.otp, target: 90, volume: record.flights, volumeLabel: "Uçuş" }));
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>STD / STA +15</span><h2>Zamanında kalkış ve varış</h2><p>Kaynakta yalnızca oran bulunduğu için sonuçlar “kaynak tarafından raporlanan oran” olarak gösterilir.</p></div></div>
      <section className="dashboard-grid two-one">
        <article className="panel chart-panel">
          <SectionHeader eyebrow="İSTASYON KARŞILAŞTIRMASI" title="OTP ve OTA İstasyon Karşılaştırması" />
          <p className="chart-description">Her satır iki oran arasındaki farkı ve %90 hedef çizgisini aynı ölçekte gösterir.</p>
          <VisualizationEngine metric="otp" secondaryMetric="ota" data={engineData} requestedVariant="dumbbell" height="large" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} />
        </article>
        <article className="panel ranking-panel">
          <SectionHeader eyebrow="ÖNE ÇIKANLAR" title="Hedef durumu" />
          {[...data].sort((a, b) => (b.otp ?? 0) - (a.otp ?? 0)).map((record, index) => (
            <button key={record.id} onClick={() => onStation(record)}><span>{index + 1}</span><div><strong>{record.stationCode}</strong><small>{record.stationName}</small></div><b>{formatRate(record.otp, 0)}</b><i className={(record.otp ?? 0) >= 90 ? "pass" : "watch"}>{(record.otp ?? 0) >= 90 ? "Hedefte" : "İzle"}</i></button>
          ))}
        </article>
      </section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL TREND" title="12 Aylık OTP / OTA Performansı" /><OtpOtaDualTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} /></section>
    </div>
  );
}

function DelayAnalysis({ records, comparison, history, currentPeriod, comparisonPeriod, onStation }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const data = records.filter((record) => record.delayMinutes !== null).map((record) => ({ ...record, per100: record.flights > 0 ? record.delayMinutes! / record.flights * 100 : null }));
  const delayData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.delayMinutes, value2: record.per100, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.delayMinutes, volume: record.flights, volumeLabel: "Uçuş" }));
  const total = aggregateMetric(records,"delay");
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>İSTASYON KAYNAKLI</span><h2>Tehir analizi</h2><p>Toplam dakikayı ve normalize edilmiş 100 uçuş başına dakikayı ayrı eksenlerde değerlendirin.</p></div></div>
      <section className="metrics-grid compact">
        <MetricCard label="Toplam tehir" value={formatNumber(total)} unit="dk" detail={`${data.length} istasyon değer raporladı`} icon={TimerReset} tone="warning" />
        <MetricCard label="100 uçuş başına" value={formatNumber(aggregateMetric(records,"delayPer100"),1)} unit="dk" detail="Tüm filtre kapsamı" icon={CircleGauge} />
        <MetricCard label="En yüksek katkı" value={data.sort((a, b) => b.delayMinutes! - a.delayMinutes!)[0]?.stationCode ?? MISSING_VALUE_LABEL} detail={`${formatNumber(data[0]?.delayMinutes ?? null)} dakika`} icon={ArrowDownRight} tone="navy" />
      </section>
      <section className="dashboard-grid one-one">
        <article className="panel chart-panel"><SectionHeader eyebrow="TOPLAM TEHİR KATKISI" title="İstasyon katkısı" /><VisualizationEngine metric="delay" data={delayData} requestedVariant="ranked-bar" height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article>
        <article className="panel chart-panel"><SectionHeader eyebrow="NORMALİZE TEHİR" title="100 uçuş başına tehir dakikası" /><VisualizationEngine metric="delayPer100" data={delayData.map((datum) => ({ ...datum, value: datum.value2 ?? null }))} requestedVariant="ranked-bar" height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article>
      </section>
      <section className="panel chart-panel"><SectionHeader eyebrow="HACİM × TEHİR" title="Uçuş Hacmi ve Normalize Tehir" /><p className="chart-description">X ekseni uçuş sayısını, Y ekseni 100 uçuş başına tehir dakikasını gösterir.</p><VisualizationEngine metric="flights" secondaryMetric="delayPer100" data={delayData.map((datum) => ({ ...datum, value: datum.volume ?? null, value2: datum.value2 }))} requestedVariant="scatter" hasVolume height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL EĞİLİM" title="Tehir Dönemsel Eğilimi" /><PeriodTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} defaultMetric="delay" metrics={["delay", "delayPer100"]} compact /></section>
      <div className="quality-callout info"><Info size={20} /><div><strong>Hacim etkisi ayrıştırıldı</strong><p>Toplam tehir ile 100 uçuş başına tehir aynı 12 aylık kaynak seriden ayrı metrikler olarak hesaplanır.</p></div></div>
    </div>
  );
}

function BaggagePerformance({ records, comparison, history, currentPeriod, comparisonPeriod, onStation }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const data = records.map((record) => ({ ...record, name: record.stationCode, damagedPercent: record.damagedRate === null ? null : record.damagedRate * 100, lostPercent: record.lostRate === null ? null : record.lostRate * 100 }));
  const baggageData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.damagedRate, value2: record.lostRate, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.damagedRate, volume: record.passengers ?? undefined, volumeLabel: "Yolcu", numerator: record.damagedCount, denominator: record.passengers }));
  const passengers = aggregateMetric(records,"passengers");
  const damagedCount = reportedFieldSum(records,"damagedCount");
  const lostCount = reportedFieldSum(records,"lostCount");
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>BAGAJ OPERASYONU</span><h2>Hasarlı ve kayıp bagaj</h2><p>Ham vaka ile yolcu başına yüzde oranı aynı bağlamda, açık birimlerle gösterilir.</p></div></div>
      <section className="metrics-grid compact"><MetricCard label="Hasarlı bagaj" value={formatNumber(damagedCount)} unit="vaka" detail={formatPercentRatio(aggregateMetric(records,"damaged"))} icon={Luggage} /><MetricCard label="Kayıp bagaj" value={formatNumber(lostCount)} unit="vaka" detail={formatPercentRatio(aggregateMetric(records,"lost"))} icon={AlertCircle} tone="navy" /><MetricCard label="Kapsanan yolcu" value={formatNumber(passengers)} detail={`${records.length} istasyon · aktif filtre`} icon={UserRound} tone="soft" /></section>
      <section className="chart-triad">
        <article className="panel chart-panel"><SectionHeader eyebrow="DPR" title="Hasarlı Bagaj Oranı" /><VisualizationEngine metric="damaged" data={baggageData} requestedVariant="ranked-bar" height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article>
        <article className="panel chart-panel"><SectionHeader eyebrow="AHL" title="Kayıp Bagaj Oranı" /><VisualizationEngine metric="lost" data={baggageData.map((datum) => ({ ...datum, value: datum.value2 ?? null, previous: comparison.find((item) => item.stationCode === datum.stationCode)?.lostRate, numerator: records.find((item) => item.id === datum.id)?.lostCount }))} requestedVariant="ranked-bar" height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article>
        <article className="panel chart-panel baggage-risk-panel"><SectionHeader eyebrow="BAGAJ RİSK MATRİSİ" title="Hacim ve problem oranı" /><p className="chart-description">Balon büyüklüğü yolcu hacmini gösterir; minimum ve maksimum boyut sınırlandırılmıştır.</p><VisualizationEngine metric="damaged" secondaryMetric="lost" data={baggageData} requestedVariant="scatter" hasVolume hasDenominator height="standard" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article>
      </section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL EĞİLİM" title="Bagaj Oranları Dönemsel Eğilimi" /><PeriodTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} defaultMetric="damaged" metrics={["damaged", "lost"]} compact /></section>
      <article className="panel table-panel compact-table"><SectionHeader eyebrow="MUTABAKAT" title="Vaka ve yüzde görünümü" /><div className="table-scroll"><table className="data-table"><thead><tr><th>İstasyon</th><th>Yolcu</th><th>Hasarlı vaka</th><th>Hasarlı Bagaj %</th><th>Kayıp vaka</th><th>Kayıp Bagaj %</th><th>Durum</th></tr></thead><tbody>{data.map((record) => <tr key={record.id} onClick={() => onStation(record)}><td><b>{record.stationCode}</b></td><td>{formatNumber(record.passengers)}</td><td>{formatNumber(record.damagedCount)}</td><td>{formatPercentRatio(record.damagedRate)}</td><td>{formatNumber(record.lostCount)}</td><td>{formatPercentRatio(record.lostRate)}</td><td><StatusPill status="valid" /></td></tr>)}</tbody></table></div></article>
    </div>
  );
}

function DocumentPerformance({ records, comparison, history, currentPeriod, comparisonPeriod, onStation }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const data = records.filter((record) => record.docRatePct !== null);
  const aggregateDoc = trendValue(records, "documents");
  const documentData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.docRatePct, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.docRatePct, numerator: record.docCount, denominator: record.internationalPassengers }));
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>VİZE / PASAPORT</span><h2>Doküman ve yolcu süreçleri</h2><p>Tek haneli hata sayısı ile yüz binlerce yolcu aynı eksende birleştirilmez.</p></div></div>
      <section className="metrics-grid compact"><MetricCard label="Doküman hata oranı" value={formatRate(aggregateDoc, 3)} detail="Uçuş hacmi ağırlıklı" icon={FileText} tone="navy" /><MetricCard label="Kapsanan uçuş" value={formatNumber(sum(data, "flights"))} detail="Oran kaynağı bulunan kapsam" icon={Plane} /><MetricCard label="Veri kapsamı" value={`${data.length}/${records.length}`} unit="istasyon" detail="Raporlanan kaynak kapsamı" icon={BookOpenCheck} tone="soft" /></section>
<section className="metrics-grid compact">{(["visaPassportIssues","unreadDocuments","digitalBoarding"] as TrendMetric[]).map(metric=><MetricCard key={metric} label={KPI_LABELS[metric as keyof typeof KPI_LABELS] ?? metricCatalog[metric].label} value={formatMetricValue(metric,aggregateMetric(records,metric))} unit={metricCatalog[metric].unit === "count" ? "adet" : undefined} coverage={`${metricCoverage(records,metric)}/${records.length} istasyon`} detail={METRIC_METHODS[metric]} icon={FileText} />)}</section>
      <section className="dashboard-grid two-one"><article className="panel chart-panel"><SectionHeader eyebrow="ANA METRİK" title="Doküman Hata Oranı" /><p className="chart-description">Kaynak oranı istasyon bazında gösterilir; düşük değer daha iyi performansı ifade eder.</p><VisualizationEngine metric="documents" data={documentData} requestedVariant="ranked-bar" height="compact" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article><article className="panel document-comparison"><SectionHeader eyebrow="ORTAK ORAN" title="İstasyon Kapsamı" />{data.map((record) => <button type="button" key={record.id} onClick={() => onStation(record)}><b>{record.stationCode}</b><strong>{formatRate(record.docRatePct, 3)}</strong><span>Kaynak oranı</span><small>{formatNumber(record.flights)} uçuş ağırlığı</small></button>)}</article></section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL EĞİLİM" title="Doküman Hata Oranı Dönemsel Eğilimi" /><PeriodTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} defaultMetric="documents" metrics={["documents","visaPassportIssues","unreadDocuments","digitalBoarding","passengers"]} compact /></section>
      <div className="quality-callout info"><Info size={20} /><div><strong>Oran metodolojisi</strong><p>Pay ve paydası bulunmayan DOC oranları mevcut KPI kuralına göre uçuş hacmiyle ağırlıklandırılır.</p></div></div>
    </div>
  );
}

function SafetyPerformance({ records, comparison, history, currentPeriod, comparisonPeriod }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string }) {
  const data = records.filter((record) => record.safetyPct !== null || record.nonSafetyPct !== null).map((record) => ({ ...record, totalCount: [record.safetyCount, record.nonSafetyCount].filter((value): value is number => value !== null).reduce((total, value) => total + value, 0) }));
  const safetyData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.safetyPct, value2: record.nonSafetyPct, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.safetyPct, volume: record.flights, volumeLabel: "Uçuş", numerator: record.safetyCount, denominator: record.flights }));
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>SAFETY & OPERASYON</span><h2>Yer operasyonu aksaklıkları</h2><p>Emniyet raporlama adedi performans cezası olarak renklendirilmez; ayrı bağlamda gösterilir.</p></div></div>
      <section className="metrics-grid compact"><MetricCard label="Toplam aksaklık" value={formatNumber(data.reduce((a, b) => a + b.totalCount, 0))} unit="adet" detail="ESB ve SAW doğrulanmış kapsam" icon={ShieldCheck} tone="navy" /><MetricCard label="Safety" value={formatNumber(reportedFieldSum(records,"safetyCount"))} unit="adet" detail="Kaynak oranlarıyla mutabık" icon={AlertCircle} /><MetricCard label="Emniyet Raporlaması" value={formatNumber(aggregateMetric(records, "safetyReports"))} unit="adet" detail="Nötr izleme metriği" icon={FileText} tone="soft" /></section>
<section className="metrics-grid compact">{(["gseDamageReports"] as TrendMetric[]).map(metric=><MetricCard key={metric} label={KPI_LABELS[metric as keyof typeof KPI_LABELS] ?? metricCatalog[metric].label} value={formatMetricValue(metric,aggregateMetric(records,metric))} unit={metricCatalog[metric].unit === "count" ? "adet" : undefined} coverage={`${metricCoverage(records,metric)}/${records.length} istasyon`} detail={METRIC_METHODS[metric]} icon={FileText} />)}</section>
      <section className="dashboard-grid two-one"><article className="panel chart-panel"><SectionHeader eyebrow="UÇUŞ BAŞINA" title="Safety ve Safety Dışı İstasyon Karşılaştırması" /><p className="chart-description">Oranlar aynı yatay ölçekte gösterilir; emniyet raporu adedi bu grafiğe dahil edilmez.</p><VisualizationEngine metric="safety" secondaryMetric="nonSafety" data={safetyData} requestedVariant="dumbbell" height="large" /></article><article className="panel"><SectionHeader eyebrow="VERİ KAPSAMI" title="İstasyon Bazında Metrik Varlığı" /><div className="coverage-list station-coverage">{records.map((record) => { const available = [record.safetyPct, record.nonSafetyPct, record.safetyReports].filter((value) => value !== null).length; return <div key={record.id}><span>{record.stationCode}</span><strong>{available}/3 metrik mevcut</strong><i><b style={{ width: `${available / 3 * 100}%` }} /></i><small>{available === 3 ? "Tam" : available > 0 ? "Kısmi" : MISSING_VALUE_LABEL}</small></div>; })}</div></article></section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL EĞİLİM" title="Safety / Safety Dışı Dönemsel Eğilimi" /><PeriodTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} defaultMetric="safety" metrics={["safety", "nonSafety","safetyReports","gseDamageReports"]} compact /></section>
    </div>
  );
}

function ComplaintPerformance({ records, comparison, history, currentPeriod, comparisonPeriod, onStation }: { records: StationRecord[]; comparison: StationRecord[]; history: StationRecord[]; currentPeriod: string; comparisonPeriod: string; onStation: (record: StationRecord) => void }) {
  const data = [...records].filter((record) => record.complaintDays !== null).sort((a, b) => (b.complaintDays ?? 0) - (a.complaintDays ?? 0));
  const complaintData: VisualizationDatum[] = data.map((record) => ({ id: record.id, label: record.stationName, stationCode: record.stationCode, ...visualizationContext(record), value: record.complaintDays, previous: comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.complaintDays, target: 2 }));
  const fastest = [...data].sort((a, b) => (a.complaintDays ?? 99) - (b.complaintDays ?? 99))[0];
  const closest = [...data].sort((a, b) => Math.abs((a.complaintDays ?? 99) - 2) - Math.abs((b.complaintDays ?? 99) - 2))[0];
  const improved = [...data].map((record) => ({ record, delta: (record.complaintDays ?? 0) - (comparison.find((item) => item.stationCode === record.stationCode && item.provider === record.provider)?.complaintDays ?? record.complaintDays ?? 0) })).sort((a, b) => a.delta - b.delta)[0];
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>HEDEF ≤ 2 GÜN</span><h2>Şikâyet Dönüş Süresi</h2><p>Kaynak veride şikâyet hacmi bulunmadığı için yalnız dönüş süresi değerlendirilir.</p></div></div>
      <section className="dashboard-grid two-one"><article className="panel chart-panel"><SectionHeader eyebrow="HEDEF KARŞILAŞTIRMASI" title="Şikâyet Dönüş Süresi" /><VisualizationEngine metric="complaint" data={complaintData} requestedVariant="bullet" height="large" onSelect={(datum) => { const record = records.find((item) => item.id === datum.id); if (record) onStation(record); }} /></article><article className="panel complaint-insights"><SectionHeader eyebrow="YÖNETİCİ İÇGÖRÜSÜ" title="Hedef ve Öncelikler" /><div className="insight-metrics"><div><span>Hedefte</span><strong>{data.filter((record) => (record.complaintDays ?? 99) <= 2).length}/{data.length}</strong></div><div><span>Hedef dışı</span><strong>{data.filter((record) => (record.complaintDays ?? 0) > 2).length}</strong></div><div><span>En hızlı</span><strong>{fastest?.stationCode ?? MISSING_VALUE_LABEL}</strong><small>{formatMetricValue("complaint", fastest?.complaintDays)}</small></div><div><span>Hedefe en yakın</span><strong>{closest?.stationCode ?? MISSING_VALUE_LABEL}</strong><small>{formatMetricValue("complaint", closest?.complaintDays)}</small></div><div><span>Medyan</span><strong>{formatMetricValue("complaint", median(data.map((record) => record.complaintDays!).filter(Number.isFinite)))}</strong></div><div><span>En çok iyileşen</span><strong>{improved?.record.stationCode ?? MISSING_VALUE_LABEL}</strong><small>{improved ? `${formatNumber(Math.abs(improved.delta), 2)} gün` : MISSING_VALUE_LABEL}</small></div></div></article></section>
      <section className="panel chart-panel"><SectionHeader eyebrow="DÖNEMSEL EĞİLİM" title="Dönem Değişimi ve Hedef Mesafesi" /><PeriodTrend current={records} comparison={comparison} history={history} currentPeriod={currentPeriod} comparisonPeriod={comparisonPeriod} defaultMetric="complaint" metrics={["complaint"]} compact /><div className="insight-strip"><span><b>{data[0]?.stationCode ?? MISSING_VALUE_LABEL}</b> en uzun dönüş süresi</span><span><b>{data[data.length - 1]?.stationCode ?? MISSING_VALUE_LABEL}</b> en hızlı dönüş</span><span><b>{data.filter((record) => (record.complaintDays ?? 99) <= 2).length}/{data.length}</b> hedef içinde</span></div></section>
    </div>
  );
}

function DataQuality({ records, issues, history, quality, setView }: { records: StationRecord[]; issues: QualityIssue[]; history: ImportEntry[]; quality: DashboardPayload["quality"]; setView: (view: ViewKey) => void }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  const infos = issues.filter((issue) => issue.level === "info").length;
  const coverageFields: Array<{ label: string; value: (record: StationRecord) => unknown }> = [
    { label: "DELAY", value: (record) => record.delayMinutes }, { label: "DOC", value: (record) => record.docRatePct },
    { label: "IRSAFE", value: (record) => record.safetyPct }, { label: "NIRSAFE", value: (record) => record.nonSafetyPct },
    { label: "SAFE", value: (record) => record.safetyReports }, { label: "OTP", value: (record) => record.otp },
    { label: "OTA", value: (record) => record.ota }, { label: "COMP", value: (record) => record.complaintDays },
  ];
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>VERİ GÜVENİ</span><h2>Veri Kalitesi</h2><p>Doğrulama sonuçları, uyarılar ve dönüşümler satır bazında izlenir.</p></div><button className="primary-button" onClick={() => setView("upload")}><Plus size={16} /> Veri Yükle</button></div>
      <button className="quality-score-panel panel quality-score-button" onClick={() => setShowBreakdown((value) => !value)} aria-expanded={showBreakdown}><div className="quality-score"><div><strong>{quality.score ?? MISSING_VALUE_LABEL}</strong><span>/ 100</span></div><small>Kalite skoru</small></div><div className="quality-summary"><h3>Aktif filtre kapsamı açıklanabilir kalite modeliyle değerlendirildi</h3><p>Tamlık %40, geçerlilik %30, benzersizlik %20 ve tutarlılık %10 ağırlıkla hesaplanır.</p><div><span><Check size={15} /> {records.length} geçerli</span><span><AlertCircle size={15} /> {warnings} uyarı</span><span><Info size={15} /> {infos} dönüşüm</span></div></div><div className="quality-gauge"><i><b style={{ width: `${quality.score ?? 0}%` }} /></i><span>{showBreakdown ? "Kırılımı kapat" : "Kırılımı görüntüle"} · Hedef ≥ 90</span></div></button>
      {showBreakdown && <section className="panel quality-breakdown"><div><SectionHeader eyebrow="SKOR FORMÜLÜ" title="Ağırlıklı Kalite Kırılımı" /><div className="quality-components">{[["Tamlık", "completeness", 40], ["Geçerlilik", "validity", 30], ["Benzersizlik", "uniqueness", 20], ["Tutarlılık", "consistency", 10]].map(([label, key, weight]) => { const value = Number(quality.components?.[String(key)] ?? 0); return <div key={String(key)}><span>{label} · %{weight}</span><strong>{formatNumber(value, 1)}</strong><i><b style={{ width: `${Math.min(value, 100)}%` }} /></i><small>{formatNumber(value * Number(weight) / 100, 1)} puan katkı</small></div>; })}</div></div><div className="lineage-card"><span>VERİ KAYNAĞI VE HESAPLAMA</span><h3>Skoru Üreten Kaynaklar</h3><dl><div><dt>Veri Yükleme</dt><dd>{Array.from(new Set(records.map((record) => record.uploadId))).filter(Boolean).join(", ") || MISSING_VALUE_LABEL}</dd></div><div><dt>Sütun Eşleştirme</dt><dd>{Array.from(new Set(records.map((record) => record.mappingVersion))).join(", ") || MISSING_VALUE_LABEL}</dd></div><div><dt>Hesaplama</dt><dd>{Array.from(new Set(records.map((record) => record.calculationVersion))).join(", ") || MISSING_VALUE_LABEL}</dd></div><div><dt>Kaynak Dosya</dt><dd>{Array.from(new Set(records.map((record) => record.sourceFile))).join(", ") || MISSING_VALUE_LABEL}</dd></div></dl></div></section>}
      <section className="metrics-grid compact"><MetricCard label="Geçerli kayıt" value={formatNumber(records.filter((r) => r.validationStatus !== "error").length)} detail="Aktif filtre kapsamı" icon={BadgeCheck} tone="navy" /><MetricCard label="Hata" value={formatNumber(errors)} detail="İçe aktarımı engeller" icon={X} tone={errors ? "warning" : "soft"} /><MetricCard label="Uyarı" value={formatNumber(warnings)} detail="İnceleme önerilir" icon={AlertCircle} tone="warning" /><MetricCard label="Mükerrer" value="0" detail="Handling Provider + istasyon + dönem" icon={RefreshCw} tone="soft" /></section>
      <section className="panel coverage-heatmap"><SectionHeader eyebrow="VERİ KAPSAMI" title="İstasyon × Kaynak Alanı Kapsamı" /><p className="chart-description">Eksik değer sıfır kabul edilmez; her hücre durum etiketiyle açıklanır.</p><div className="heatmap-scroll"><div className="coverage-grid" style={{ gridTemplateColumns: `80px repeat(${coverageFields.length}, minmax(72px, 1fr))` }}><b>İstasyon</b>{coverageFields.map((field) => <b key={field.label}>{field.label}</b>)}{records.map((record) => <Fragment key={record.id}><strong>{record.stationCode}</strong>{coverageFields.map((field) => { const value = field.value(record); const missing = value === null || value === undefined; const state = missing ? "missing" : record.validationStatus === "error" ? "invalid" : record.validationStatus === "warning" ? "warning" : "available"; return <span key={field.label} className={state} title={missing ? MISSING_VALUE_TOOLTIP : `${record.stationCode} · ${field.label}: Doğrulandı`}><i>{missing ? "—" : state === "warning" ? "!" : state === "invalid" ? "×" : "✓"}</i><small>{missing ? "Kaynakta Raporlanmamış" : state === "warning" ? "Uyarı Var" : state === "invalid" ? "Geçersiz Değer" : "Doğrulandı"}</small></span>; })}</Fragment>)}</div></div></section>
      <section className="dashboard-grid two-one"><article className="panel issue-panel"><SectionHeader eyebrow="SON KONTROLLER" title="Kalite Bulguları" /><div className="issue-list">{issues.map((issue, index) => <div key={`${issue.row}-${issue.field}-${index}`} className={issue.level}><span>{issue.level === "error" ? <X size={16} /> : issue.level === "warning" ? <AlertCircle size={16} /> : <Info size={16} />}</span><div><strong>{issue.field}{issue.row ? ` · Satır ${issue.row}` : " · Master Veri Eşleştirme"}</strong><p>{issue.message}</p>{issue.field === "station_code" && <button className="text-button" onClick={() => { window.location.hash = "airport-master"; setView("admin"); }}>Havalimanı Eşleştirme Ekranına Git <ArrowRight size={14} /></button>}</div><i>{issue.level === "error" ? "Geçersiz Değer" : issue.level === "warning" ? "Uyarı Var" : "Bilgi"}</i></div>)}</div></article><article className="panel"><SectionHeader eyebrow="YÜKLEME GEÇMİŞİ" title="Son İşlemler" /><div className="history-list">{history.slice(0, 4).map((entry) => <div key={entry.id}><span className="file-icon"><FileSpreadsheet size={18} /></span><div><strong>{entry.provider} · {formatPeriod(entry.period)}</strong><small>{entry.rows} satır · {entry.createdAt}</small></div><StatusPill status={entry.errors ? "error" : entry.warnings ? "warning" : "valid"} /></div>)}</div></article></section>
    </div>
  );
}

function ReportCenter({ records, exports, printReport, exportCsv, exportExcel, onChanged, setToast }: { records: StationRecord[]; exports: DashboardPayload["exports"]; printReport: (scope: ReportScope) => void; exportCsv: () => void; exportExcel: () => void; onChanged: () => void; setToast: (value: string) => void }) {
  const reports = [
    ...PDF_OPTIONS.map(option=>({title:option.label,description:option.scope === "summary" ? "Veri kümesi başlığı, aktif filtreler, tüm KPI değerleri ve kısa karşılaştırma özeti." : "Tüm metrikler, tarihsel eğilimler, istasyon tabloları, veri kapsamı ve aktif karşılaştırma.",icon:option.scope === "summary"?CircleGauge:BookOpenCheck,action:()=>printReport(option.scope),label:option.label})),
    { title:"Filtrelenmiş Excel", description:"Aktif kapsamın tüm metrikleri, kaynak başlıkları ve birimleri.",icon:FileSpreadsheet,action:exportExcel,label:"Excel’e Aktar" },
    { title:"Filtrelenmiş CSV",description:"UTF-8, noktalı virgül ayrımlı aktif kapsam.",icon:Download,action:exportCsv,label:"CSV indir" },
  ];
  const summarizeFilters = (entry: DashboardPayload["exports"][number]) => {
    try {
      const filters = JSON.parse(entry.filterState) as Record<string, string>;
      const parts = [filters.providerFilter !== "Tümü" ? filters.providerFilter : null, filters.stationFilter !== "Tümü" ? filters.stationFilter : null, filters.dataStatusFilter !== "Tümü" ? filters.dataStatusFilter : null].filter(Boolean);
      return parts.length ? parts.join(" · ") : "Tüm kapsam";
    } catch { return "Tüm kapsam"; }
  };
  const exportPeriod = (entry: DashboardPayload["exports"][number]) => {
    try { return formatPeriod((JSON.parse(entry.filterState) as Record<string, string>).periodFilter || records[0]?.period || "2026-06"); }
    catch { return formatPeriod(records[0]?.period || "2026-06"); }
  };
  const deleteReport = async (id: string) => {
    const response = await fetch("/api/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete_export", id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setToast(result.error || "Rapor kaydı silinemedi"); return; }
    setToast("Rapor geçmişten kaldırıldı"); onChanged();
  };
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>RAPOR MERKEZİ</span><h2>Genel Bakış ile Aynı KPI Tanımları</h2><p>Çıktılar aktif filtreleri ve dönem bağlamını korur.</p></div></div>
      <section className="report-grid">{reports.map((report) => { const Icon = report.icon; const period = records[0]?.period ?? "2026-06"; return <article key={report.title} className="panel report-card"><span><Icon size={23} /></span><div><small>{formatPeriod(period).toLocaleUpperCase("tr-TR")} · TGS</small><h3>{report.title}</h3><p>{report.description}</p></div><div className="report-meta"><span>{records.length} istasyon</span></div><button className="primary-button" onClick={report.action}>{report.label} <ArrowRight size={16} /></button></article>; })}</section>
      <article className="panel report-preview"><div><span>PDF ÖNİZLEME</span><h3>TGS · {formatPeriod(records[0]?.period ?? "2026-06")} Performans Özeti</h3><p>AJet kurumsal renkleri, Hizmete Özel etiketi, aktif filtreler, seçili trend ve port KPI kutucukları sunuma uygun sayfalarda gösterilir.</p><button className="secondary-button" onClick={() => printReport("summary")}><FileOutput size={16} /> Hızlı PDF</button></div><div className="mini-report"><div className="mini-report-head"><img src="/ajet-logo.png" alt="AJet" /><span>Hizmete Özel</span></div><h4>İstasyon Performans Özeti</h4><small>{formatPeriod(records[0]?.period ?? "2026-06")} · TGS · {records.length} istasyon</small><div className="mini-kpis"><i /><i /><i /><i /></div><div className="mini-chart"><b /><b /><b /><b /><b /></div></div></article>
      <article className="panel history-panel report-history"><SectionHeader eyebrow="RAPOR GEÇMİŞİ" title="Son Dışa Aktarımlar" /><div className="table-scroll"><table className="data-table"><thead><tr><th>Dosya</th><th>Tür</th><th>Kullanıcı</th><th>Dönem</th><th>Filtre Özeti</th><th>Oluşturma</th><th>Durum</th><th>Boyut</th><th>İşlemler</th></tr></thead><tbody>{exports.length ? exports.map((entry) => <tr key={entry.id}><td><b>{entry.fileName}</b></td><td>{entry.exportType.toLocaleUpperCase("tr-TR")}</td><td>{entry.userName}</td><td>{exportPeriod(entry)}</td><td>{summarizeFilters(entry)}</td><td>{formatDateTime(entry.createdAt)}</td><td><span className="version-pill">{formatProcessStatus(entry.status, "Hazır")}</span></td><td>{formatBytes(entry.sizeBytes)}</td><td><div className="row-actions compact-actions"><button onClick={() => entry.exportType === "excel" ? exportExcel() : entry.exportType === "csv" ? exportCsv() : printReport(entry.fileName.includes("_full") ? "full" : "summary")}>Yeniden Oluştur</button><button className="danger" onClick={() => deleteReport(entry.id)}>Sil</button></div></td></tr>) : <tr><td colSpan={9}><b>Henüz rapor oluşturulmadı.</b><small>Aktif filtrelerle bir rapor oluşturabilirsiniz.</small></td></tr>}</tbody></table></div></article>
    </div>
  );
}

function Management({ history, session, audit, onChanged }: { history: ImportEntry[]; session: SessionUser; audit: DashboardPayload["audit"]; onChanged: () => void }) {
  const kpis = [
    ["OTP", "STD +15 kalkış oranı", "%", "Yüksek iyi", "KPI-v1.0"],
    ["OTA", "STA +15 varış oranı", "%", "Yüksek iyi", "KPI-v1.0"],
    ["DAM_PCT", "Yolcu başına hasarlı bagaj yüzdesi", "%", "Düşük iyi", "KPI-v2.0"],
    ["LOST_PCT", "Yolcu başına kayıp bagaj yüzdesi", "%", "Düşük iyi", "KPI-v2.0"],
    ["DELAY_100F", "100 uçuş başına tehir dakikası", "dk", "Düşük iyi", "KPI-v1.0"],
  ];
  void onChanged;
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span>YÖNETİM</span><h2>KPI, Sütun Eşleştirme ve Hesaplama Yönetimi</h2><p>Performans göstergelerinin tanımlarını, veri eşleştirmelerini ve hesaplama sürümlerini yönetin.</p></div></div>
      <section className="dashboard-grid two-one"><article className="panel table-panel"><SectionHeader eyebrow="MERKEZİ HESAPLAMA" title="KPI Kataloğu" /><div className="table-scroll"><table className="data-table"><thead><tr><th>Kod</th><th>İş Tanımı</th><th>Birim</th><th>Yön</th><th>Sürüm</th></tr></thead><tbody>{kpis.map((row) => <tr key={row[0]}><td><b>{row[0]}</b></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><span className="version-pill">{row[4]}</span></td></tr>)}</tbody></table></div></article><article className="panel"><SectionHeader eyebrow="YÖNETİM KAPSAMI" title="Sütun Eşleştirme ve Hesaplama" /><div className="role-card"><span>{initials(session.fullName)}</span><div><strong>{session.fullName}</strong><small>{roleLabel(session.roleCode)}</small></div></div><ul className="permission-list"><li><Check size={15} /> TGS-v1.0 sütun eşleştirme profili</li><li><Check size={15} /> KPI-v1.0 ve KPI-v2.0 hesaplama sürümleri</li><li><Check size={15} /> Kaynak sütun veri sözlüğü</li><li><Check size={15} /> Değişiklikler aktivite kaydına bağlı</li></ul><div className="security-note"><ShieldCheck size={18} /><p>Kullanıcı ve erişim işlemleri Kullanıcı ve Erişim Yönetimi ekranından yönetilir.</p></div></article></section>
      <article className="panel"><SectionHeader eyebrow="AKTİVİTE KAYDI" title="Son Aktiviteler" /><div className="timeline">{audit.length ? audit.map((entry) => <div key={entry.id}><span><BookOpenCheck size={16} /></span><div><strong>{formatAuditAction(entry.action)}</strong><p>{formatAuditTarget(entry.targetType)} · {entry.targetId}</p></div><small>{formatDateTime(entry.createdAt)}</small></div>) : history.map((entry) => <div key={entry.id}><span><FileSpreadsheet size={16} /></span><div><strong>{entry.fileName}</strong><p>{entry.provider} · {formatPeriod(entry.period)} · {entry.rows} kayıt</p></div><small>{entry.createdAt}</small></div>)}</div></article>
    </div>
  );
}

function StationDrawer({ record, onClose, onPrint }: { record: StationRecord; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}><aside className="station-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span>{record.stationCode}</span><div><small>Handling Provider: {record.provider} · {formatPeriod(record.period)} </small><h2>{record.airportName ?? record.stationName}</h2></div></div><button onClick={onClose} aria-label="Kapat"><X size={20} /></button></div><div className="drawer-body"><div className="drawer-actions"><StatusPill status={record.validationStatus} /><button className="secondary-button" onClick={onPrint}><FileOutput size={15} /> Hızlı PDF</button></div><section className="drawer-kpis"><div><span>{KPI_LABELS.flights}</span><strong>{formatNumber(record.flights)}</strong></div><div><span>{KPI_LABELS.passengers}</span><strong>{formatNumber(record.passengers)}</strong></div><div><span>OTP</span><strong>{formatRate(record.otp, 0)}</strong></div><div><span>OTA</span><strong>{formatRate(record.ota, 0)}</strong></div><div><span>{KPI_LABELS.delay}</span><strong title={record.delayMinutes === null ? MISSING_VALUE_TOOLTIP : undefined}>{record.delayMinutes === null ? MISSING_VALUE_LABEL : `${formatNumber(record.delayMinutes)} dk`}</strong></div><div><span>{KPI_LABELS.complaint}</span><strong title={record.complaintDays === null ? MISSING_VALUE_TOOLTIP : undefined}>{record.complaintDays === null ? MISSING_VALUE_LABEL : `${formatNumber(record.complaintDays, 2)} gün`}</strong></div></section><section className="drawer-section"><SectionHeader eyebrow="BAGAJ" title="Yolcu Başına Yüzde Oranları" /><div className="comparison-bars"><div><span>{KPI_LABELS.damaged}</span><strong>{formatPercentRatio(record.damagedRate)}</strong><i><b style={{ width: `${Math.min((record.damagedRate ?? 0) * 10000, 100)}%` }} /></i><small>{formatNumber(record.damagedCount)} doğrulanmış vaka</small></div><div><span>{KPI_LABELS.lost}</span><strong>{formatPercentRatio(record.lostRate)}</strong><i><b style={{ width: `${Math.min((record.lostRate ?? 0) * 30000, 100)}%` }} /></i><small>{formatNumber(record.lostCount)} doğrulanmış vaka</small></div></div></section><section className="drawer-section"><SectionHeader eyebrow="TÜM GÖSTERGELER" title="Metrik Dökümü" /><div className="kpi-history-list">{MAIN_METRICS.map(metric=><div key={metric}><span>{KPI_LABELS[metric as keyof typeof KPI_LABELS] ?? metricCatalog[metric].label}</span><strong>{formatMetricValue(metric,metricRecordValue(record,metric))}</strong></div>)}</div></section><section className="drawer-section source-lineage"><SectionHeader eyebrow="VERİ KAYNAĞI" title="Kaynak ve Master Veri" /><dl><div><dt>Havalimanı</dt><dd>{record.stationCode} — {record.airportName ?? record.stationName}</dd></div><div><dt>Şehir / Ülke / Bölge</dt><dd>{record.city ?? MISSING_VALUE_LABEL} · {record.country ?? MISSING_VALUE_LABEL} · {record.region ?? MISSING_VALUE_LABEL}</dd></div><div><dt>Kaynak Dosya</dt><dd>{record.sourceFile}</dd></div><div><dt>Çalışma Sayfası / Satır</dt><dd>{record.sourceSheet} · {record.sourceRow}</dd></div><div><dt>Sütun Eşleştirme</dt><dd>{record.mappingVersion}</dd></div><div><dt>Hesaplama</dt><dd>{record.calculationVersion}</dd></div></dl></section></div></aside></div>
  );
}
