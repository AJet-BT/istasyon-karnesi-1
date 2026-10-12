import {historicalMetricValue, MAIN_METRICS, type PerformanceMetric, type PerformanceRecord} from './performance-metrics';
import {metricCatalog,formatMetricValue} from './visualization-engine';
import {KPI_LABELS} from './corporate-language';

export type OverviewTrendMetric='otpOta'|PerformanceMetric;
export const OVERVIEW_TREND_METRICS:PerformanceMetric[]=[...MAIN_METRICS,'delayPer100','nonSafety'];
export const trendLabel=(metric:OverviewTrendMetric)=>metric==='otpOta'?'OTP / OTA':KPI_LABELS[metric as keyof typeof KPI_LABELS]??metricCatalog[metric].label;
export const trendUnit=(metric:PerformanceMetric)=>metricCatalog[metric].displayUnit==='percent'?'%':metricCatalog[metric].displayUnit==='minutes'?'dk':metricCatalog[metric].displayUnit==='days'?'gün':metric==='flights'?'uçuş':metric==='passengers'?'yolcu':'adet';
export const trendValueLabel=(metric:PerformanceMetric,value:number|null)=>value===null?formatMetricValue(metric,value):`${formatMetricValue(metric,value)}${metricCatalog[metric].unit==='count'?` ${trendUnit(metric)}`:''}`;
export function overviewTrendData(records:PerformanceRecord[],history:PerformanceRecord[],period:string,selection:OverviewTrendMetric='otpOta') {
  const match=/^(\d{4})-(\d{2})$/.exec(period);
  if(!match)return {periods:[] as string[],series:[] as Array<{metric:PerformanceMetric;values:Array<number|null>}>};
  const end=Number(match[1])*12+Number(match[2])-1;
  const periods=Array.from({length:12},(_,i)=>{const n=end-11+i;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;});
  const identities=new Set(records.map(row=>`${row.provider}|${row.stationCode}`));
  const scoped=history.filter(row=>identities.has(`${row.provider}|${row.stationCode}`));
  const metrics:PerformanceMetric[]=selection==='otpOta'?['otp','ota']:[selection];
  const series=metrics.map(metric=>({metric,values:periods.map(p=>historicalMetricValue(p===period?records:scoped.filter(row=>row.period===p),records,metric))}));
  return {periods,series};
}
