export type MetricKey =
  | "flights" | "passengers" | "otp" | "ota" | "delay" | "delayPer100"
  | "damaged" | "lost" | "documents" | "safety" | "nonSafety" | "complaint" | "quality"
  | "unreadDocuments" | "visaPassportIssues" | "safetyReports" | "gseDamageReports" | "digitalBoarding";

export type MetricDirection = "higher-better" | "lower-better" | "neutral";
export type MetricUnit = "count" | "percent" | "ratio-percent" | "minutes" | "days" | "score";
export type MetricSourceScale = "absolute" | "ratio" | "percentage-points";
export type ChartVariant =
  | "empty" | "single" | "compact-comparison" | "ranked-bar" | "scrollable-ranking"
  | "top-bottom" | "dumbbell" | "slope" | "line" | "heatmap" | "scatter" | "bullet";

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: MetricUnit;
  storageUnit: "count" | "ratio" | "percentage-points" | "minutes" | "days" | "score";
  sourceScale: MetricSourceScale;
  displayUnit: "number" | "percent" | "minutes" | "days";
  displayMultiplier: number;
  precision: number;
  direction: MetricDirection;
  target?: number;
  focusedDomain?: [number, number];
  color: string;
  comparisonColor: string;
};

export const metricCatalog: Record<MetricKey, MetricDefinition> = {
  unreadDocuments: { key:'unreadDocuments',label:'Extgoms–Okunmayan Doküman Sayısı',shortLabel:'Extgoms–Okunmayan Doküman Sayısı',unit:'count',storageUnit:'count',sourceScale:'absolute',displayUnit:'number',displayMultiplier:1,precision:0,direction:'lower-better',color:'#002554',comparisonColor:'#7f91a0' },
  visaPassportIssues: { key:'visaPassportIssues',label:'Vize Pasaport Doküman Aksaklıkları',shortLabel:'Vize Pasaport Doküman Aksaklıkları',unit:'count',storageUnit:'count',sourceScale:'absolute',displayUnit:'number',displayMultiplier:1,precision:0,direction:'lower-better',color:'#008fda',comparisonColor:'#7f91a0' },
  safetyReports: { key:'safetyReports',label:'Emniyet Raporlaması',shortLabel:'Emniyet Raporlaması',unit:'count',storageUnit:'count',sourceScale:'absolute',displayUnit:'number',displayMultiplier:1,precision:0,direction:'neutral',color:'#002554',comparisonColor:'#7f91a0' },
  gseDamageReports: { key:'gseDamageReports',label:'Hasar Raporlama GSE',shortLabel:'Hasar Raporlama GSE',unit:'count',storageUnit:'count',sourceScale:'absolute',displayUnit:'number',displayMultiplier:1,precision:0,direction:'neutral',color:'#008fda',comparisonColor:'#7f91a0' },
  digitalBoarding: { key:'digitalBoarding',label:'Dijital Biniş Kartı Kullanım Oranı',shortLabel:'Dijital Biniş Kartı Kullanım Oranı',unit:'ratio-percent',storageUnit:'ratio',sourceScale:'ratio',displayUnit:'percent',displayMultiplier:100,precision:1,direction:'higher-better',color:'#19896a',comparisonColor:'#8bc9b8' },
  flights: { key: "flights", label: "Toplam Uçuş", shortLabel: "Uçuş", unit: "count", storageUnit: "count", sourceScale: "absolute", displayUnit: "number", displayMultiplier: 1, precision: 0, direction: "neutral", color: "#002554", comparisonColor: "#7f91a0" },
  passengers: { key: "passengers", label: "Yolcu Sayısı", shortLabel: "Yolcu", unit: "count", storageUnit: "count", sourceScale: "absolute", displayUnit: "number", displayMultiplier: 1, precision: 0, direction: "neutral", color: "#008fda", comparisonColor: "#7f91a0" },
  otp: { key: "otp", label: "Zamanında Kalkış", shortLabel: "OTP", unit: "percent", storageUnit: "percentage-points", sourceScale: "percentage-points", displayUnit: "percent", displayMultiplier: 1, precision: 1, direction: "higher-better", target: 90, focusedDomain: [75, 100], color: "#008fda", comparisonColor: "#81c9ee" },
  ota: { key: "ota", label: "Zamanında Varış", shortLabel: "OTA", unit: "percent", storageUnit: "percentage-points", sourceScale: "percentage-points", displayUnit: "percent", displayMultiplier: 1, precision: 1, direction: "higher-better", target: 90, focusedDomain: [75, 100], color: "#002554", comparisonColor: "#7f91a0" },
  delay: { key: "delay", label: "Toplam Tehir", shortLabel: "Tehir", unit: "minutes", storageUnit: "minutes", sourceScale: "absolute", displayUnit: "minutes", displayMultiplier: 1, precision: 0, direction: "lower-better", color: "#b66c13", comparisonColor: "#e7b36b" },
  delayPer100: { key: "delayPer100", label: "100 Uçuş Başına Tehir", shortLabel: "Tehir / 100", unit: "minutes", storageUnit: "minutes", sourceScale: "absolute", displayUnit: "minutes", displayMultiplier: 1, precision: 1, direction: "lower-better", color: "#008fda", comparisonColor: "#81c9ee" },
  damaged: { key: "damaged", label: "Hasarlı Bagaj Oranı", shortLabel: "Hasarlı Bagaj %", unit: "ratio-percent", storageUnit: "ratio", sourceScale: "ratio", displayUnit: "percent", displayMultiplier: 100, precision: 2, direction: "lower-better", color: "#008fda", comparisonColor: "#81c9ee" },
  lost: { key: "lost", label: "Kayıp Bagaj Oranı", shortLabel: "Kayıp Bagaj %", unit: "ratio-percent", storageUnit: "ratio", sourceScale: "ratio", displayUnit: "percent", displayMultiplier: 100, precision: 2, direction: "lower-better", color: "#002554", comparisonColor: "#7f91a0" },
  documents: { key: "documents", label: "Doküman Hata Oranı", shortLabel: "Doküman", unit: "percent", storageUnit: "percentage-points", sourceScale: "percentage-points", displayUnit: "percent", displayMultiplier: 1, precision: 3, direction: "lower-better", color: "#002554", comparisonColor: "#7f91a0" },
  safety: { key: "safety", label: "Safety %", shortLabel: "Safety %", unit: "percent", storageUnit: "percentage-points", sourceScale: "percentage-points", displayUnit: "percent", displayMultiplier: 1, precision: 2, direction: "lower-better", color: "#008fda", comparisonColor: "#81c9ee" },
  nonSafety: { key: "nonSafety", label: "Safety Dışı Oran", shortLabel: "Safety Dışı", unit: "percent", storageUnit: "percentage-points", sourceScale: "percentage-points", displayUnit: "percent", displayMultiplier: 1, precision: 2, direction: "lower-better", color: "#002554", comparisonColor: "#7f91a0" },
  complaint: { key: "complaint", label: "Şikâyet Dönüş Süresi", shortLabel: "Şikâyet Dönüş Süresi", unit: "days", storageUnit: "days", sourceScale: "absolute", displayUnit: "days", displayMultiplier: 1, precision: 2, direction: "lower-better", target: 2, color: "#19896a", comparisonColor: "#8bc9b8" },
  quality: { key: "quality", label: "Veri Kalitesi", shortLabel: "Kalite", unit: "score", storageUnit: "score", sourceScale: "absolute", displayUnit: "number", displayMultiplier: 1, precision: 0, direction: "higher-better", target: 90, color: "#19896a", comparisonColor: "#8bc9b8" },
};

export type VisualizationContext = {
  metric: MetricKey;
  stationCount: number;
  periodCount: number;
  hasTarget?: boolean;
  hasDenominator?: boolean;
  hasVolume?: boolean;
  hasPreviousPeriod?: boolean;
  dataCompleteness?: number;
  exportMode?: boolean;
  comparisonSeries?: boolean;
  requestedVariant?: ChartVariant;
};

export function selectChartVariant(context: VisualizationContext): ChartVariant {
  if (context.requestedVariant) return context.requestedVariant;
  if (context.stationCount === 0) return "empty";
  if (context.periodCount >= 3) return "line";
  if (context.periodCount === 2 && context.hasPreviousPeriod && context.stationCount <= 1) return "slope";
  if (context.comparisonSeries && context.stationCount >= 2) return "dumbbell";
  if (context.metric === "complaint" && context.hasTarget) return "bullet";
  if (context.hasVolume && context.hasDenominator && context.stationCount >= 3) return "scatter";
  if (context.stationCount === 1) return "single";
  if (context.stationCount === 2) return "compact-comparison";
  if (context.stationCount <= 8) return "ranked-bar";
  if (context.stationCount <= 20) return "scrollable-ranking";
  return "top-bottom";
}

export function formatLocalizedNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING_VALUE_LABEL;
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPercentage(value: number | null | undefined, digits = 2, sourceScale: MetricSourceScale = "percentage-points") {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING_VALUE_LABEL;
  return `%${formatLocalizedNumber(value * (sourceScale === "ratio" ? 100 : 1), digits)}`;
}

export function formatMetricValue(metric: MetricKey, value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING_VALUE_LABEL;
  const definition = metricCatalog[metric];
  const formatted = formatLocalizedNumber(value * definition.displayMultiplier, definition.precision);
  if (definition.displayUnit === "percent") return `%${formatted}`;
  if (definition.displayUnit === "minutes") return `${formatted} dk`;
  if (definition.displayUnit === "days") return `${formatted} gün`;
  return formatted;
}

export function metricStatus(metric: MetricKey, value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "missing" as const;
  const definition = metricCatalog[metric];
  if (definition.target === undefined || definition.direction === "neutral") return "neutral" as const;
  const targetPassed = definition.direction === "higher-better" ? value >= definition.target : value <= definition.target;
  if (targetPassed) return "good" as const;
  const distance = Math.abs(value - definition.target) / Math.max(Math.abs(definition.target), 1);
  return distance <= 0.1 ? "warning" as const : "critical" as const;
}

export function formatMetricDelta(metric: MetricKey, current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return "Karşılaştırılabilir dönem bulunamadı.";
  const difference = current - previous;
  const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
  const definition = metricCatalog[metric];
  const magnitude = Math.abs(difference * definition.displayMultiplier);
  const unit = definition.displayUnit === "percent" ? " puan" : definition.displayUnit === "minutes" ? " dk" : definition.displayUnit === "days" ? " gün" : "";
  return `${sign}${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: definition.precision }).format(magnitude)}${unit}`;
}

export function metricDeltaStatus(metric: MetricKey, current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined || current === previous) return "neutral" as const;
  const direction = metricCatalog[metric].direction;
  if (direction === "neutral") return "neutral" as const;
  if (direction === "lower-better") return current < previous ? "improved" as const : "worsened" as const;
  return current > previous ? "improved" as const : "worsened" as const;
}

export function boundedBubbleRadius(value: number, minValue: number, maxValue: number, minRadius = 7, maxRadius = 24) {
  if (!Number.isFinite(value) || maxValue <= minValue) return minRadius;
  const ratio = Math.sqrt(Math.max(0, value - minValue) / (maxValue - minValue));
  return minRadius + ratio * (maxRadius - minRadius);
}
import { MISSING_VALUE_LABEL } from "@/lib/corporate-language";
