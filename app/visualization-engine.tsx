"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  ChartVariant, formatMetricDelta, formatMetricValue, metricCatalog, metricDeltaStatus, MetricKey,
  selectChartVariant, VisualizationContext,
} from "@/lib/visualization-engine";
import { MISSING_VALUE_LABEL, MISSING_VALUE_TOOLTIP } from "@/lib/corporate-language";

export type VisualizationDatum = {
  id: string;
  label: string;
  stationCode?: string;
  airportName?: string | null;
  city?: string | null;
  country?: string | null;
  provider?: string;
  period?: string;
  value: number | null;
  value2?: number | null;
  previous?: number | null;
  target?: number;
  volume?: number;
  volumeLabel?: string;
  numerator?: number | null;
  denominator?: number | null;
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number;
  isTestData?: boolean;
  isCurrent?: boolean;
  isComparison?: boolean;
  stationCoverage?: number;
  rawRecordCount?: number;
};

type EngineProps = {
  metric: MetricKey;
  secondaryMetric?: MetricKey;
  data: VisualizationDatum[];
  periodCount?: number;
  hasPreviousPeriod?: boolean;
  hasDenominator?: boolean;
  hasVolume?: boolean;
  exportMode?: boolean;
  requestedVariant?: ChartVariant;
  height?: "compact" | "standard" | "large";
  ranking?: "performance" | "worst-first";
  maxItems?: number;
  emptyMessage?: string;
  onSelect?: (datum: VisualizationDatum) => void;
};

function plotValue(metric: MetricKey, value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return value * metricCatalog[metric].displayMultiplier;
}

function TooltipDetails({ datum, metric, secondaryMetric }: { datum: VisualizationDatum & { rawValue?: number | null; rawValue2?: number | null }; metric: MetricKey; secondaryMetric?: MetricKey }) {
  const current = datum.rawValue === undefined ? datum.value : datum.rawValue;
  const secondary = datum.rawValue2 === undefined ? datum.value2 : datum.rawValue2;
  const target = datum.target ?? metricCatalog[metric].target;
  return <>
    <strong>{datum.stationCode ? `${datum.stationCode} — ${datum.airportName ?? datum.label}` : datum.label}</strong>
    {(datum.city || datum.country) && <small>{[datum.city, datum.country].filter(Boolean).join(" · ")}</small>}
    {datum.provider && <div>Handling Provider: <b>{datum.provider}</b></div>}
    {datum.period && <div>Dönem: <b>{longPeriod(datum.period)}</b></div>}
    <div><span style={{ background: metricCatalog[metric].color }} />{metricCatalog[metric].shortLabel}: <b>{formatMetricValue(metric, current)}</b></div>
    {secondaryMetric && <div><span style={{ background: metricCatalog[secondaryMetric].color }} />{metricCatalog[secondaryMetric].shortLabel}: <b>{formatMetricValue(secondaryMetric, secondary)}</b></div>}
    {datum.previous !== undefined && <div>Karşılaştırma: <b>{formatMetricValue(metric, datum.previous)}</b></div>}
    {datum.previous !== undefined && <div>Değişim: <b>{formatMetricDelta(metric, current, datum.previous)}</b></div>}
    {datum.previous !== undefined && <div>Durum: <b className={`trend-status-${metricDeltaStatus(metric, current, datum.previous)}`}>{metricDeltaStatus(metric, current, datum.previous) === "improved" ? "İyileşme" : metricDeltaStatus(metric, current, datum.previous) === "worsened" ? "Kötüleşme" : "Değişmedi"}</b></div>}
    {datum.stationCoverage !== undefined && <div>İstasyon kapsamı: <b>{datum.stationCoverage}</b></div>}
    {target !== undefined && <div>Hedef: <b>{formatMetricValue(metric, target)}</b></div>}
    {datum.volume !== undefined && <div>{datum.volumeLabel ?? "Hacim"}: <b>{new Intl.NumberFormat("tr-TR").format(datum.volume)}</b></div>}
    {datum.numerator !== undefined && <div title={datum.numerator === null ? MISSING_VALUE_TOOLTIP : undefined}>Pay: <b>{datum.numerator ?? MISSING_VALUE_LABEL}</b></div>}
    {datum.denominator !== undefined && <div title={datum.denominator === null ? MISSING_VALUE_TOOLTIP : undefined}>Payda: <b>{datum.denominator ?? MISSING_VALUE_LABEL}</b></div>}
    {datum.sourceFile && <div className="tooltip-source">Kaynak: <b>{datum.sourceFile}{datum.sourceSheet ? ` · ${datum.sourceSheet}` : ""}{datum.sourceRow ? ` · satır ${datum.sourceRow}` : ""}</b></div>}
  </>;
}

const monthShort: Record<string, string> = { "01": "Oca", "02": "Şub", "03": "Mar", "04": "Nis", "05": "May", "06": "Haz", "07": "Tem", "08": "Ağu", "09": "Eyl", "10": "Eki", "11": "Kas", "12": "Ara" };
const monthLong: Record<string, string> = { "01": "Ocak", "02": "Şubat", "03": "Mart", "04": "Nisan", "05": "Mayıs", "06": "Haziran", "07": "Temmuz", "08": "Ağustos", "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık" };

function longPeriod(period?: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period ?? "";
  const [year, month] = period.split("-");
  return `${monthLong[month] ?? month} ${year}`;
}

function shortPeriod(period?: string, fallback?: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return fallback ?? "";
  const [year, month] = period.split("-");
  return `${monthShort[month] ?? month} ${year.slice(2)}`;
}

function FinancialLine({ metric, data, height, onSelect }: { metric: MetricKey; data: Array<VisualizationDatum & { rawValue: number | null; plotValue: number | null }>; height: EngineProps["height"]; onSelect?: (datum: VisualizationDatum) => void }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const definition = metricCatalog[metric];
  const points = data.filter((datum) => datum.plotValue !== null);
  if (points.length < 2) return <div className="chart-empty">Dönemsel eğilim için en az iki dönem gereklidir.</div>;
  const width = 960; const chartHeight = height === "compact" ? 270 : 320;
  const pad = { left: 64, right: 28, top: 42, bottom: 52 };
  const plottedValues = points.map((point) => point.plotValue as number);
  const dataMin = Math.min(...plottedValues); const dataMax = Math.max(...plottedValues);
  const focused = definition.focusedDomain;
  let min = focused ? Math.min(focused[0], dataMin) : dataMin;
  let max = focused ? Math.max(focused[1], dataMax) : dataMax;
  const target = definition.target === undefined ? null : definition.target * definition.displayMultiplier;
  if (target !== null) { min = Math.min(min, target); max = Math.max(max, target); }
  const spread = Math.max(max - min, Math.max(Math.abs(max), 1) * 0.08);
  if (!focused) { min = Math.max(0, min - spread * 0.12); max += spread * 0.12; }
  const innerW = width - pad.left - pad.right; const innerH = chartHeight - pad.top - pad.bottom;
  const x = (index: number) => pad.left + index / Math.max(points.length - 1, 1) * innerW;
  const y = (value: number) => pad.top + (max - value) / Math.max(max - min, 0.000001) * innerH;
  const tickValues = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4).reverse();
  const axisValue = (value: number) => {
    if (definition.displayUnit === "percent") return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: definition.precision > 1 ? 2 : 1 }).format(value)}`;
    if (Math.abs(value) >= 1000) return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1000)}K`;
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
  };
  const largestBreakIndex = points.slice(1).reduce((best, point, index) => {
    const delta = Math.abs((point.plotValue ?? 0) - (points[index].plotValue ?? 0));
    const bestDelta = best < 1 ? -1 : Math.abs((points[best].plotValue ?? 0) - (points[best - 1].plotValue ?? 0));
    return delta > bestDelta ? index + 1 : best;
  }, -1);
  const active = activeIndex === null ? null : points[activeIndex];
  const areaPoints = `${x(0)},${pad.top + innerH} ${points.map((point, index) => `${x(index)},${y(point.plotValue as number)}`).join(" ")} ${x(points.length - 1)},${pad.top + innerH}`;
  return <div className={`financial-line engine-${height ?? "standard"}`} onMouseLeave={() => setActiveIndex(null)}>
    <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`${definition.label} 12 aylık dönemsel performansı`}>
      {tickValues.map((tick) => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="financial-grid" /><text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="financial-axis-label">{axisValue(tick)}</text></g>)}
      <polygon points={areaPoints} className="financial-area" />
      {target !== null && <g><line x1={pad.left} x2={width - pad.right} y1={y(target)} y2={y(target)} className="financial-target" /><text x={width - pad.right} y={y(target) - 7} textAnchor="end" className="financial-target-label">Hedef {axisValue(target)}</text></g>}
      {points.slice(1).map((point, index) => {
        const previous = points[index]; const status = metricDeltaStatus(metric, point.rawValue, previous.rawValue);
        return <line key={`${previous.id}-${point.id}`} x1={x(index)} y1={y(previous.plotValue as number)} x2={x(index + 1)} y2={y(point.plotValue as number)} className={`financial-segment ${status}`} />;
      })}
      {activeIndex !== null && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={pad.top} y2={pad.top + innerH} className="financial-crosshair" />}
      {points.map((point, index) => {
        const px = x(index); const py = y(point.plotValue as number); const highlighted = point.isCurrent || point.isComparison;
        return <g key={point.id} className="financial-point" tabIndex={0} role="button" aria-label={`${point.label}: ${formatMetricValue(metric, point.rawValue)}`} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} onClick={() => onSelect?.(point)}>
          {point.isCurrent && <circle cx={px} cy={py} r="10" className="financial-current-ring" />}
          <circle cx={px} cy={py} r={highlighted ? 6 : 4.5} className={point.isComparison ? "financial-marker comparison" : "financial-marker"} />
          {(point.isCurrent || point.isComparison) && <text x={px} y={py - 15} textAnchor={index > points.length - 3 ? "end" : index < 2 ? "start" : "middle"} className="financial-value-label">{formatMetricValue(metric, point.rawValue)}</text>}
          <text x={px} y={chartHeight - 22} textAnchor="middle" className="financial-x-label">{shortPeriod(point.period, point.label)}</text>
        </g>;
      })}
      {largestBreakIndex > 0 && points.length >= 6 && <g className="financial-break"><line x1={x(largestBreakIndex)} x2={x(largestBreakIndex)} y1={pad.top + 2} y2={y(points[largestBreakIndex].plotValue as number) - 12} /><text x={x(largestBreakIndex)} y={pad.top - 10} textAnchor="middle">En büyük kırılım · {shortPeriod(points[largestBreakIndex].period)}</text></g>}
    </svg>
    {active && <div className={`financial-hover-card chart-tooltip engine-tooltip ${activeIndex !== null && activeIndex > points.length / 2 ? "align-right" : ""}`} style={{ left: `${x(activeIndex ?? 0) / width * 100}%` }}><TooltipDetails datum={active} metric={metric} /></div>}
  </div>;
}

function EngineTooltip({ active, payload, metric, secondaryMetric }: { active?: boolean; payload?: Array<{ payload: VisualizationDatum & { rawValue: number | null; rawValue2?: number | null } }>; metric: MetricKey; secondaryMetric?: MetricKey }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip engine-tooltip"><TooltipDetails datum={payload[0].payload} metric={metric} secondaryMetric={secondaryMetric} /></div>;
}

function Dumbbell({ metric, secondaryMetric, data, onSelect }: { metric: MetricKey; secondaryMetric: MetricKey; data: VisualizationDatum[]; onSelect?: (datum: VisualizationDatum) => void }) {
  const primary = metricCatalog[metric];
  const secondary = metricCatalog[secondaryMetric];
  const values = data.flatMap((datum) => [plotValue(metric, datum.value), plotValue(secondaryMetric, datum.value2)]).filter((value): value is number => value !== null);
  const domain = primary.focusedDomain ?? [Math.min(...values, 0), Math.max(...values, 1)] as [number, number];
  const position = (value: number | null | undefined) => value === null || value === undefined ? 0 : Math.max(0, Math.min(100, (plotValue(metric, value)! - domain[0]) / (domain[1] - domain[0]) * 100));
  return <div className="dumbbell-chart" role="img" aria-label={`${primary.shortLabel} ve ${secondary.shortLabel} istasyon karşılaştırması`}>
    <div className="dumbbell-axis"><span>%{domain[0]}</span><span>Hedef %{primary.target ?? 90} · düşük OTP üstte</span><span>%{domain[1]}</span></div>
    {data.map((datum) => {
      const first = position(datum.value); const second = position(datum.value2); const left = Math.min(first, second); const width = Math.abs(first - second);
      return <button type="button" className="dumbbell-row" key={datum.id} onClick={() => onSelect?.(datum)}>
        <b>{datum.stationCode ?? datum.label}</b><span className="dumbbell-track"><i className="dumbbell-link" style={{ left: `${left}%`, width: `${width}%` }} /><i className="dumbbell-point primary" style={{ left: `${first}%`, background: primary.color }} /><i className="dumbbell-point secondary" style={{ left: `${second}%`, background: secondary.color }} />{primary.target !== undefined && <i className="dumbbell-target" style={{ left: `${position(primary.target)}%` }} />}</span><span><strong><i style={{ background: primary.color }} />{primary.shortLabel} {formatMetricValue(metric, datum.value)}</strong><small><i style={{ background: secondary.color }} />{secondary.shortLabel} {formatMetricValue(secondaryMetric, datum.value2)}</small></span>
        <span className="dumbbell-hover-tooltip chart-tooltip engine-tooltip" role="tooltip"><TooltipDetails datum={datum} metric={metric} secondaryMetric={secondaryMetric} /></span>
      </button>;
    })}
    <div className="engine-legend"><span><i style={{ background: primary.color }} />{primary.shortLabel}</span><span><i style={{ background: secondary.color }} />{secondary.shortLabel}</span>{primary.target !== undefined && <span><i className="target" />Hedef %{primary.target}</span>}</div>
  </div>;
}

function Slope({ metric, data }: { metric: MetricKey; data: VisualizationDatum[] }) {
  const definition = metricCatalog[metric];
  const points = data.filter((datum) => datum.value !== null).slice(0, 2);
  if (points.length < 2) return <div className="chart-empty">Karşılaştırılabilir dönem bulunamadı.</div>;
  const values = points.map((datum) => plotValue(metric, datum.value) ?? 0);
  const domain = definition.focusedDomain ?? [Math.min(...values) * .95, Math.max(...values) * 1.05 || 1] as [number, number];
  const y = (value: number) => 112 - (value - domain[0]) / Math.max(domain[1] - domain[0], 1) * 72;
  return <div className="slope-chart" role="img" aria-label={`${definition.label} dönemsel değişimi`}>
    <svg viewBox="0 0 560 150" preserveAspectRatio="xMidYMid meet">
      <line x1="110" y1={y(values[0])} x2="450" y2={y(values[1])} stroke={definition.color} strokeWidth="4" />
      {points.map((point, index) => <g key={point.id}><circle cx={index ? 450 : 110} cy={y(values[index])} r="8" fill={definition.color}><title>{point.label}: {formatMetricValue(metric, point.value)}</title></circle><text x={index ? 450 : 110} y="140" textAnchor="middle">{point.label}</text><text x={index ? 450 : 110} y={y(values[index]) - 16} textAnchor="middle" className="slope-value">{formatMetricValue(metric, point.value)}</text></g>)}
    </svg>
    <strong className="slope-delta">{formatMetricDelta(metric, points[1].value, points[0].value)}</strong>
  </div>;
}

export function VisualizationEngine({ metric, secondaryMetric, data, periodCount = 1, hasPreviousPeriod = false, hasDenominator = false, hasVolume = false, exportMode = false, requestedVariant, height = "standard", ranking = "performance", maxItems, emptyMessage = "Seçilen filtrelerle eşleşen veri bulunamadı.", onSelect }: EngineProps) {
  const context: VisualizationContext = { metric, stationCount: data.length, periodCount, hasTarget: metricCatalog[metric].target !== undefined, hasDenominator, hasVolume, hasPreviousPeriod, comparisonSeries: Boolean(secondaryMetric), exportMode, requestedVariant };
  const variant = selectChartVariant(context);
  const definition = metricCatalog[metric];
  const secondary = secondaryMetric ? metricCatalog[secondaryMetric] : null;
  const prepared = useMemo(() => data.map((datum) => ({ ...datum, rawValue: datum.value, rawValue2: datum.value2, plotValue: plotValue(metric, datum.value), plotValue2: secondaryMetric ? plotValue(secondaryMetric, datum.value2) : null })), [data, metric, secondaryMetric]);
  const ranked = useMemo(() => [...prepared].filter((datum) => datum.plotValue !== null).sort((a, b) => {
    if (ranking === "worst-first") return definition.direction === "higher-better" ? (a.plotValue ?? 0) - (b.plotValue ?? 0) : (b.plotValue ?? 0) - (a.plotValue ?? 0);
    return definition.direction === "higher-better" ? (b.plotValue ?? 0) - (a.plotValue ?? 0) : (a.plotValue ?? 0) - (b.plotValue ?? 0);
  }), [prepared, definition.direction, ranking]);
  const bounded = maxItems ? ranked.slice(0, maxItems) : ranked;
  const visible = variant === "top-bottom" ? [...bounded.slice(0, 5), ...bounded.slice(-5)] : bounded;

  if (variant === "empty" || !prepared.some((datum) => datum.value !== null)) return <div className="chart-empty">{emptyMessage}</div>;
  if (variant === "single") {
    const datum = prepared[0];
    return <div className="single-metric-visual"><span>{datum.stationCode ?? datum.label}</span><strong>{formatMetricValue(metric, datum.rawValue)}</strong><small>{datum.previous === undefined ? "Tek istasyon görünümü" : formatMetricDelta(metric, datum.rawValue, datum.previous)}</small>{definition.target !== undefined && <i>Hedef {formatMetricValue(metric, definition.target)}</i>}</div>;
  }
  if (variant === "dumbbell" && secondaryMetric) return <Dumbbell metric={metric} secondaryMetric={secondaryMetric} data={data} onSelect={onSelect} />;
  if (variant === "slope") return <Slope metric={metric} data={data} />;
  if (variant === "scatter" && secondaryMetric) return <div className={`engine-chart engine-${height}`}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 24, bottom: 16, left: 4 }}><CartesianGrid stroke="#e7eef3" /><XAxis type="number" dataKey="plotValue" name={definition.shortLabel} unit={definition.displayUnit === "percent" ? "%" : ""} /><YAxis type="number" dataKey="plotValue2" name={secondary?.shortLabel} unit={secondary?.displayUnit === "percent" ? "%" : ""} /><ZAxis type="number" dataKey="volume" range={[70, 380]} /><Tooltip content={<EngineTooltip metric={metric} secondaryMetric={secondaryMetric} />} /><Scatter data={prepared} fill={definition.color} onClick={(datum) => onSelect?.(datum as VisualizationDatum)}>{prepared.map((datum) => <Cell key={datum.id} fill={datum.stationCode === "SAW" ? "#002554" : definition.color} />)}</Scatter></ScatterChart></ResponsiveContainer></div>;
  if (variant === "line") return <FinancialLine metric={metric} data={prepared} height={height} onSelect={onSelect} />;

  return <div className={`engine-chart engine-${height} ${variant === "scrollable-ranking" ? "engine-scroll" : ""}`} data-variant={variant}><ResponsiveContainer width="100%" height="100%"><BarChart data={visible} layout="vertical" margin={{ top: 8, right: 42, bottom: 8, left: 0 }}><CartesianGrid stroke="#e7eef3" horizontal={false} /><XAxis type="number" unit={definition.displayUnit === "percent" ? "%" : ""} /><YAxis type="category" dataKey="stationCode" width={48} /><Tooltip content={<EngineTooltip metric={metric} />} />{definition.target !== undefined && <ReferenceLine x={plotValue(metric, definition.target) ?? definition.target} stroke="#b66c13" strokeDasharray="4 4" label={{ value: "Hedef", position: "top", fill: "#8c681f", fontSize: 10 }} />}<Bar dataKey="plotValue" name={definition.shortLabel} fill={definition.color} radius={[0, 7, 7, 0]} onClick={(datum) => onSelect?.(datum as VisualizationDatum)} isAnimationActive={!exportMode}>{visible.map((datum) => <Cell key={datum.id} fill={definition.direction === "higher-better" ? definition.color : (datum.target ?? definition.target) !== undefined && (datum.rawValue ?? 0) > (datum.target ?? definition.target ?? Infinity) ? "#c74b4b" : definition.color} />)}</Bar></BarChart></ResponsiveContainer></div>;
}
